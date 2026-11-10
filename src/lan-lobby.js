import {createLanRoom, makeRoomCode, validRoomCode, LAN_LIMIT} from './lan-room.js';
import {supabase} from './supabase.js';

export const lanMode = new URLSearchParams(location.search).get('mode') === 'lan';

function modeURL(online) {
 const url = new URL(location.href);
 if (online) url.searchParams.set('mode', 'lan');
 else url.searchParams.delete('mode');
 return url;
}

export function installLanLobby(onPause) {
 const button = document.createElement('button');
 button.type = 'button';
 button.className = 'lan-tool';
 button.setAttribute('aria-label', 'Multiplayer LAN');
 button.title = 'Multiplayer LAN';
 button.textContent = 'LAN';
 document.querySelector('.utility').append(button);
 if (!lanMode) {
  button.onclick = () => location.assign(modeURL(true));
  return null;
 }

 const dialog = document.createElement('dialog');
 dialog.className = 'pause-screen lan-lobby';
 dialog.setAttribute('aria-labelledby', 'lan-title');
 dialog.innerHTML = `
  <header class="pause-header">
   <div><p>GTA CTATELLA <span>· PARTITA LIBERA</span></p><h1 id="lan-title">Multiplayer LAN</h1></div>
  </header>
  <p>Fino a sei giocatori sulla stessa Wi-Fi.</p>
  <div class="lan-actions">
   <button type="button" data-lan="host">Crea stanza</button>
   <form><label for="lan-code">Codice stanza</label><input id="lan-code" maxlength="11" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
   <button type="submit">Entra</button></form>
  </div>
  <div class="lan-status" role="status" aria-live="polite"></div>
  <div class="lan-actions">
   <button type="button" data-lan="lock" hidden>Chiudi inviti</button>
   <button type="button" data-lan="resume" hidden>Torna in gioco</button>
   <button type="button" data-lan="cancel" hidden>Annulla collegamento</button>
   <button type="button" data-lan="offline">Torna in singolo</button>
  </div>`;
 document.body.append(dialog);
 const action = name => dialog.querySelector(`[data-lan="${name}"]`);
 const form = dialog.querySelector('form'), input = form.querySelector('input');
 const status = dialog.querySelector('.lan-status'), setup = action('host').parentElement;
 const supported = !!supabase && typeof RTCPeerConnection === 'function';
 let room, connected = false, accepting = false, playerCount = 0;
 function show() {
  if (!dialog.open) { dialog.showModal(); onPause(true); }
 }
 function hide() {
  if (connected && dialog.open) dialog.close();
 }
 function update({message = '', count = 0, accepting:open = false, connected:active = false} = {}) {
  connected = active;
  accepting = open;
  playerCount = count;
  setup.hidden = !!room;
  action('lock').hidden = !accepting;
  action('resume').hidden = !active;
  action('cancel').hidden = !room || active;
  const text = active ? `Stanza ${room.code} · ${count}/${LAN_LIMIT} giocatori${room.host ? accepting ? ' · Inviti aperti' : ' · Inviti chiusi' : ''}` : '';
  const next = [text, message].filter(Boolean).join('. ');
  if (status.textContent !== next) status.textContent = next;
 }
 function leave(message) {
  const previous = room;
  room = null;
  previous?.close();
  update({message});
  show();
 }
 function connect(host, code) {
  if (room || !supported) return;
  let next;
  try {
   next = createLanRoom(supabase, {host, code, onStatus:state => {
    if (room !== next) return;
    if (!state.connected && state.message) { leave(state.message); return; }
    update(state);
   }});
  } catch {
   update({message:'Impossibile aprire il servizio lobby.'});
   return;
  }
  room = next;
  update({message:host ? 'Apertura della stanza…' : 'Ricerca dell’host…'});
 }
 button.onclick = show;
 dialog.onclose = () => { onPause(false); button.focus(); };
 dialog.oncancel = event => { event.preventDefault(); hide(); };
 action('host').onclick = () => connect(true, makeRoomCode());
 form.onsubmit = event => {
  event.preventDefault();
  const code = input.value.trim().toUpperCase().replace(/^ROOM-/, '');
  if (validRoomCode(code)) connect(false, code);
  else { update({message:'Inserisci il codice di sei caratteri mostrato dall’host.'}); input.focus(); }
 };
 action('resume').onclick = hide;
 action('lock').onclick = () => {
  if (!room.stopAccepting()) update({message:'Attendi il collegamento dei giocatori in ingresso.', connected, accepting, count:playerCount});
 };
 action('cancel').onclick = () => leave();
 action('offline').onclick = () => { leave(); location.replace(modeURL(false)); };
 window.addEventListener('pagehide', () => {
  const previous = room;
  room = null;
  previous?.close();
 });
 window.addEventListener('pageshow', event => { if (event.persisted) leave(); });
 if (!supported) {
  setup.hidden = true;
  status.textContent = 'Il multiplayer richiede WebRTC e la configurazione Supabase.';
 }
 show();
 return {get room() { return connected ? room : null; }, get open() { return dialog.open; }};
}
