export const LAN_LIMIT = 6;
const MAX_PENDING_BYTES = 4096;
const HANDSHAKE_TIMEOUT = 18000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const events = ['client-joined', 'webrtc-offer', 'webrtc-answer', 'ice-candidate', 'room-full'];

export function makeRoomCode() {
 return Array.from(crypto.getRandomValues(new Uint8Array(6)), value => CODE_CHARS[value & 31]).join('');
}

export function validRoomCode(code) {
 return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

export function createLanRoom(supabase, {code, host, onStatus}) {
 const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('');
 const peers = new Map();
 const channel = supabase.channel('lobby-' + code);
 let signaling = channel, closed = false, joined = false, hostId, joinTimer, retry, receive;
 let remoteCount = 0;

 const openPeers = () => [...peers.values()].filter(peer => peer.ready);
 const status = (message = '') => onStatus({message, count: host ? 1 + openPeers().length : remoteCount,
  accepting: host && joined && !!signaling, connected: !closed && (host ? joined : openPeers().length > 0)});
 const signal = (event, to, data) => signaling?.send({type:'broadcast', event, payload:{version:1, from:id, to, data}});
 function stopSignaling() {
  clearInterval(retry);
  if (!signaling) return;
  signaling = null;
  void supabase.removeChannel(channel);
 }
 function publishCount() {
  const connected = openPeers();
  for (const peer of connected) {
   if (peer.control.readyState === 'open') peer.control.send(JSON.stringify({count:connected.length + 1}));
  }
 }
 function removePeer(peer) {
  if (!peers.delete(peer.id)) return;
  clearTimeout(peer.timer);
  peer.pc.close();
  if (host && !closed) {
   publishCount();
   status();
  } else if (!host && !closed) {
   close(peer.ready ? 'Connessione con l’host interrotta.' : 'Collegamento LAN non riuscito.');
  }
 }
 function close(message = '') {
  if (closed) return;
  closed = true;
  clearTimeout(joinTimer);
  stopSignaling();
  for (const peer of peers.values()) removePeer(peer);
  remoteCount = 0;
  status(message);
 }
 function bind(peer, dc) {
  const key = dc.label === 'gameData' ? 'game' : dc.label === 'roomControl' ? 'control' : null;
  if (!key || peer[key]) { dc.close(); return; }
  peer[key] = dc;
  function ready() {
   if (peer.ready || peer.game?.readyState !== 'open' || peer.control?.readyState !== 'open') return;
   peer.ready = true;
   clearTimeout(peer.timer);
   if (host) publishCount();
   else { clearTimeout(joinTimer); remoteCount = Math.max(2, remoteCount); stopSignaling(); }
   status();
  }
  dc.onopen = ready;
  dc.onclose = () => removePeer(peer);
  dc.onmessage = ({data}) => {
   if (typeof data !== 'string' || data.length > 8192) return;
   try {
    const packet = JSON.parse(data);
    if (key === 'game') receive?.(packet, peer.id);
    else if (!host && Number.isInteger(packet?.count) && packet.count >= 2 && packet.count <= LAN_LIMIT) {
     remoteCount = packet.count;
     status();
    }
   } catch {}
  };
  ready();
 }
 function createPeer(remoteId) {
  const pc = new RTCPeerConnection({iceServers:[]});
  const peer = {id:remoteId, pc, pendingIce:[], ready:false};
  peers.set(remoteId, peer);
  peer.timer = setTimeout(() => removePeer(peer), HANDSHAKE_TIMEOUT);
  pc.onconnectionstatechange = () => {
   if (['failed', 'closed'].includes(pc.connectionState)) removePeer(peer);
   if (pc.connectionState === 'disconnected' && peer.ready) {
    clearTimeout(peer.timer);
    peer.timer = setTimeout(() => removePeer(peer), 7000);
   }
   if (pc.connectionState === 'connected' && peer.ready) clearTimeout(peer.timer);
  };
  pc.onicecandidate = ({candidate}) => {
   if (candidate) void signal('ice-candidate', remoteId, candidate.toJSON());
  };
  pc.ondatachannel = ({channel:dc}) => bind(peer, dc);
  return peer;
 }
 async function setRemote(peer, description) {
  await peer.pc.setRemoteDescription(description);
  for (const candidate of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(candidate);
 }
 const earlyIce = new Map();
 async function handle(event, payload) {
  if (!signaling || payload?.version !== 1 || typeof payload.from !== 'string' || !/^[a-f0-9]{24}$/.test(payload.from) || payload.from === id) return;
  if (event !== 'client-joined' && payload.to !== id) return;
  const {from, data} = payload;
  let peer = peers.get(from);
  try {
   if (host && event === 'client-joined' && !peer) {
    if (peers.size >= LAN_LIMIT - 1) { await signal('room-full', from); return; }
    peer = createPeer(from);
    bind(peer, peer.pc.createDataChannel('gameData', {ordered:false, maxRetransmits:0}));
    bind(peer, peer.pc.createDataChannel('roomControl'));
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    await signal('webrtc-offer', from, peer.pc.localDescription.toJSON());
   } else if (!host && event === 'webrtc-offer' && !hostId) {
    hostId = from;
    clearInterval(retry);
    peer = createPeer(from);
    peer.pendingIce = earlyIce.get(from) || [];
    earlyIce.clear();
    await setRemote(peer, data);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    await signal('webrtc-answer', from, peer.pc.localDescription.toJSON());
   } else if (host && event === 'webrtc-answer' && peer && !peer.pc.remoteDescription) {
    await setRemote(peer, data);
   } else if (event === 'ice-candidate') {
    if (peer?.pc.remoteDescription) await peer.pc.addIceCandidate(data);
    else if (peer && peer.pendingIce.length < 32) peer.pendingIce.push(data);
    else if (!host && !hostId && earlyIce.size < 8) {
     const pending = earlyIce.get(from) || [];
     if (pending.length < 32) pending.push(data);
     earlyIce.set(from, pending);
    }
   } else if (!host && !hostId && event === 'room-full') close('La stanza è piena.');
  } catch {
   if (peer) removePeer(peer);
   else if (!host) close('Collegamento LAN non riuscito.');
  }
 }
 for (const event of events) channel.on('broadcast', {event}, ({payload}) => void handle(event, payload));
 joinTimer = setTimeout(() => close(host ? 'Servizio lobby non raggiungibile.' : 'Stanza non raggiungibile. Controlla il codice e la Wi-Fi.'), HANDSHAKE_TIMEOUT);
 channel.subscribe(result => {
  if (!signaling || closed) return;
  if (result === 'SUBSCRIBED') {
   if (joined) return;
   joined = true;
   if (host) { clearTimeout(joinTimer); status(); }
   else {
    void signal('client-joined');
    retry = setInterval(() => void signal('client-joined'), 1500);
   }
  } else if (result === 'CHANNEL_ERROR' || result === 'TIMED_OUT' || result === 'CLOSED') {
   if (host && joined) { stopSignaling(); status('Inviti chiusi. I giocatori connessi possono continuare.'); }
   else close('Servizio lobby non raggiungibile.');
  }
 });
 return {
  id, host, code, close,
  stopAccepting() {
   if (!host || openPeers().length !== peers.size) return false;
   stopSignaling();
   status();
   return true;
  },
  hasPeer(peerId) { return peers.get(peerId)?.ready === true; },
  sendGameData(data) {
   const connected = openPeers();
   if (!connected.length) return;
   const wire = JSON.stringify(data);
   for (const {game} of connected) {
    if (game.readyState === 'open' && game.bufferedAmount < MAX_PENDING_BYTES) game.send(wire);
   }
  },
  onGameDataReceived(callback) { receive = callback; },
 };
}
