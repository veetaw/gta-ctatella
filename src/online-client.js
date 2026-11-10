import {POSE_BYTES, ROOM_SIZE, readPose, writePose} from './online-wire.js';
import {supabase} from './supabase.js';

const slotId = slot => slot.toString(16).padStart(24,'0');
const endpoint = import.meta.env.VITE_ONLINE_URL ||
 (import.meta.env.DEV ? `ws://${location.hostname}:8080/online`
  : 'wss://ctatella-online.redbush-c0f2ce6d.francecentral.azurecontainerapps.io/online');
export const onlineAvailable = !!endpoint && !!supabase;

export async function openOnlineRoom(request, {onStatus,onEvent}){
 const {data} = await supabase.auth.getSession();
 if(!data.session)throw Error('Accedi di nuovo per giocare online.');
 let socket, attemptTimer, retryTimer;
 let receive, sequence=0, slot, connected=false, done=false, lastSend=0, lastPose;
 const send = payload => {
  if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(payload));
 };
 function close(){
  done=true;
  clearTimeout(timeout);
  clearTimeout(attemptTimer);
  clearTimeout(retryTimer);
  socket?.close();
 }
 function finish(message){
  if(done)return;
  close();
  onStatus({message});
 }
 const timeout=setTimeout(()=>finish('Il server online non risponde.'),60000);
 function connect(){
  let attempt;
  try{attempt=new WebSocket(endpoint);}
  catch{finish('Indirizzo del server online non valido.');return;}
  socket=attempt;
  attempt.binaryType='arraybuffer';
  let opened=false;
  function retry(){
   if(done||socket!==attempt)return;
   clearTimeout(attemptTimer);
   socket=null;
   attempt.close();
   onStatus({starting:true});
   retryTimer=setTimeout(connect,1500);
  }
  attemptTimer=setTimeout(retry,8000);
  attempt.onopen=()=>{
   if(done||socket!==attempt)return;
   opened=true;
   clearTimeout(attemptTimer);
   send({type:'auth',token:data.session.access_token});
  };
  attempt.onclose=()=>{
   if(done||socket!==attempt)return;
   if(opened)finish(connected?'Connessione online interrotta.':'Collegamento online rifiutato.');
   else retry();
  };
  attempt.onmessage=({data:packet})=>{
   if(!done&&socket===attempt)receivePacket(packet);
  };
 }
 function receivePacket(packet){
  if(typeof packet!=='string'){
   if(!connected||packet.byteLength%(POSE_BYTES+1)||packet.byteLength>ROOM_SIZE*(POSE_BYTES+1))return;
   const frame=new DataView(packet),players=[];
   for(let i=0;i<frame.byteLength;i+=POSE_BYTES+1){
    const pose=readPose(frame,i+1),id=frame.getUint8(i);
    if(pose&&id<ROOM_SIZE)players.push([slotId(id),pose]);
   }
   receive?.({seq:sequence++,players});
   return;
  }
  const msg=JSON.parse(packet);
  if(msg.type==='ready')send({type:'room',...request});
  else if(msg.type==='room'){
   clearTimeout(timeout);connected=true;slot=msg.slot;
   onStatus(msg);
  } else if(msg.type==='error')finish(msg.message);
  else if(connected)onEvent(msg);
 }
 connect();
 return {
  get id(){return slotId(slot);},host:false,online:true,send,
  close,
  onGameDataReceived(callback){receive=callback;},
  sendGameData({player}){
   const now=performance.now();
   if(!connected||socket.readyState!==WebSocket.OPEN||socket.bufferedAmount>256||now-lastSend<45)return;
   const signature=player.join(',');
   if(lastPose===signature&&now-lastSend<1000)return;
   lastSend=now;lastPose=signature;
   const frame=new ArrayBuffer(POSE_BYTES);
   writePose(new DataView(frame),0,player);
   socket.send(frame);
  },
 };
}
