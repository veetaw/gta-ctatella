import {PROCESSION_SEATS,PROCESSION_JOIN_RADIUS,PROCESSION_PACE,processionBearerPose} from '../src/online-procession-pose.js';

export function createRoomProcession({route,height,send}){
 function location(meters){
  const point=route.at(meters);
  return {...point,y:height(point.x,point.z)};
 }
 const startMeters=route?Math.min(8,route.length):0;
 const start=route?location(startMeters):null;
 function publish(room,recipient,result){
  if(!route)return;
  const parade=room.procession;
  const message=parade
   ? {type:'procession',point:parade.point,seats:parade.seats.map(player=>player?.slot??null),start:recipient?start:undefined}
   : {type:'procession',point:null,seats:[],start,result};
  for(const player of recipient?[recipient]:room.players.values())if(player.processionEnabled)send(player,message);
 }
 function near(player,point){
  return !player.deadAt&&!player.driver&&player.pose?.[0]==='foot'&&
   Math.hypot(player.pose[1]-point.x,player.pose[2]-point.y,player.pose[3]-point.z)<=PROCESSION_JOIN_RADIUS;
 }
 function board(player,now,startRequest){
  if(!start||!player.processionEnabled||player.processionSeat!=null||player.room.hide)return;
  const room=player.room;
  let parade=room.procession;
  if(startRequest&&parade){publish(room,player);return;}
  if(!parade){
   if(!startRequest||!near(player,start))return;
   parade=room.procession={meters:startMeters,point:start,seats:Array(PROCESSION_SEATS).fill(null),at:now};
  }
  if(!near(player,parade.point))return;
  const seat=parade.seats.indexOf(null);
  if(seat<0){send(player,{type:'notice',message:'I quattro posti da portatore sono occupati.'});return;}
  parade.seats[seat]=player;
  player.processionSeat=seat;
  player.pose=processionBearerPose(parade.point,seat);
  player.moveAt=now;
  publish(room);
 }
 function unboard(player){
  if(player.processionSeat==null)return;
  const room=player.room,parade=room.procession;
  parade.seats[player.processionSeat]=null;
  player.processionSeat=null;
  publish(room);
 }
 function update(room,now){
  const parade=room.procession;
  if(!parade||now-parade.at<100)return;
  const dt=Math.min(.25,(now-parade.at)/1000);
  parade.at=now;
  if(!parade.seats.some(Boolean))return;
  parade.meters=Math.min(route.length,parade.meters+dt*PROCESSION_PACE);
  parade.point=location(parade.meters);
  for(const [seat,player] of parade.seats.entries())if(player){
   player.pose=processionBearerPose(parade.point,seat);player.moveAt=now;
  }
  if(parade.meters>=route.length){
   for(const player of parade.seats)if(player)player.processionSeat=null;
   room.procession=null;
   publish(room,null,'Processione arrivata alla Chiesa Madre.');
  }else publish(room);
 }
 return {publish,board,unboard,update};
}
