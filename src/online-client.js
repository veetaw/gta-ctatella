import {rememberVehicle,sampleVehicle} from './online-motion.js';
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
 const poses=new Map(),motion=new Map(),traffic=new Map(),names=new Map();
 const crews=new Map(),parked=new Map();
 let activities=false,combatVisuals=false,sharedParking=false,sharedTraffic=false,sharedGarage=false;
 let receive, sequence=0, slot, connected=false, done=false, lastSend=0, lastPose;
 function publishPoses(){
  receive?.({seq:sequence++,players:Array.from(poses,([peer,pose])=>[slotId(peer),pose])});
 }
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
   send({type:'auth',token:data.session.access_token,combatVisuals:true,sharedParking:true,sharedTraffic:true,sharedGarage:true});
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
   poses.clear();
   const at=performance.now();
   for(const [id,pose] of players){
    const peer=Number.parseInt(id,16);
    poses.set(peer,pose);
    if(pose[0]==='foot')motion.delete(peer);
    else{
     if(!motion.has(peer))motion.set(peer,[]);
     rememberVehicle(motion.get(peer),pose,at);
    }
   }
   for(const peer of motion.keys())if(!poses.has(peer))motion.delete(peer);
   publishPoses();
   return;
  }
  const msg=JSON.parse(packet);
  if(msg.type==='ready')send({type:'room',...request});
  else if(msg.type==='room'){
   clearTimeout(timeout);connected=true;slot=msg.slot;
   names.clear();
   for(const [peer,name] of msg.names??[])names.set(slotId(peer),name);
   activities=msg.activities===true;combatVisuals=msg.combatVisuals===true;sharedParking=msg.sharedParking===true;sharedTraffic=msg.sharedTraffic===true;sharedGarage=msg.sharedGarage===true;onStatus(msg);
  } else if(msg.type==='error')finish(msg.message);
  else if(connected){
   if(msg.type==='drive-parked'){
    parked.delete(msg.id);
    if(Number.isInteger(msg.trafficIndex))traffic.delete(msg.trafficIndex);
   }
   if(msg.type==='crews'){crews.clear();for(const [slot,count] of msg.vehicles)crews.set(slotId(slot),count);}
   if(msg.type==='parking'){
    parked.clear();
    for(const [id,pose] of msg.vehicles)parked.set(id,pose);
    const peer=msg.departedSlot;
    const previous=poses.get(peer);
    if(previous&&previous[0]!=='foot'){
     poses.delete(peer);
     motion.delete(peer);
     publishPoses();
    }
   }
   if(msg.type==='traffic'){
    traffic.clear();
    msg.vehicles.forEach((pose,id)=>{if(pose)traffic.set(id,pose);});
   }
   onEvent(msg);
  }
 }
 connect();
 return {
  get id(){return slotId(slot);},host:false,online:true,get activities(){return activities;},get sharedParking(){return sharedParking;},get sharedTraffic(){return sharedTraffic;},get sharedGarage(){return sharedGarage;},
  send,poses,crews,parked,traffic,names,
  vehicleAt(slot,now){return sampleVehicle(motion.get(slot),now);},
  close,
  onGameDataReceived(callback){receive=callback;if(poses.size)publishPoses();},
  sendGameData({player},force=false){
   const now=performance.now();
   if(!connected||socket.readyState!==WebSocket.OPEN||socket.bufferedAmount>256||now-lastSend<(force?24:45))return;
   const signature=player.join(',');
   if(!force&&lastPose===signature&&now-lastSend<1000)return;
   lastSend=now;lastPose=signature;
   const frame=new ArrayBuffer(POSE_BYTES);
   writePose(new DataView(frame),0,player,combatVisuals);
   socket.send(frame);
  },
 };
}
