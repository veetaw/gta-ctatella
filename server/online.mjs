import {createActivities} from './online-activities.mjs';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {WebSocketServer, WebSocket} from 'ws';
import {ROOM_SIZE, POSE_BYTES, readPose, writePose, WEAPONS, hideSavePoint, hideStartPoint} from '../src/online-wire.js';
import {bodyHit, traceCover} from '../src/combat-geometry.js';
import {gunzipSync} from 'node:zlib';
import {createTeglieRoadNetwork} from '../src/teglie-terrain.js';
import {elevation, installRoadSurface} from '../src/world-math.js';
import {SpatialIndex} from '../src/road-network.js';
import {buildingCollisionParts} from '../src/punto-location.js';
import {extraColliders} from '../src/dbt-plan.js';

const RANGE = 90, VIEW_DISTANCE = 230, MAX_CONNECTIONS = 180;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const send = (client, payload) => {
 if(client.ws.readyState===WebSocket.OPEN)client.ws.send(JSON.stringify(payload));
};

export function createOnlineServer({terrain, solidsNear, authenticate, spawn, startPoint, origins = []}){
 const rooms = new Map();
 const height = (x,z) => elevation(terrain,x,z);
 const activities=createActivities({send,height,spawn,startPoint,viewDistance:VIEW_DISTANCE,canSee(a,b){
  const point=pose=>({x:pose[1],y:pose[2]+1.25,z:pose[3]});
  return traceCover(point(a),point(b),solidsNear,height).fraction>=.99;
 }});
 const http = createServer((req,res) => {
  res.writeHead(req.url==='/health' ? 200 : 404,{'Content-Type':'application/json'});
  res.end(req.url==='/health' ? '{"ok":true,"activities":true,"combatVisuals":true,"sharedParking":true}' : '{}');
 });
 const sockets = new WebSocketServer({noServer:true, maxPayload:4096, perMessageDeflate:false});
 http.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/online' || sockets.clients.size>=MAX_CONNECTIONS ||
     (origins.length && !origins.includes(req.headers.origin))){
   socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
  }
  sockets.handleUpgrade(req,socket,head,ws=>sockets.emit('connection',ws));
 });

 function roster(room){
  for(const client of room.players.values())send(client,{type:'room',code:room.code,count:room.players.size,private:room.private,slot:client.slot,activities:true,combatVisuals:true,sharedParking:true});
 }
 function sendParking(room,recipient){
  const message={type:'parking',vehicles:[...room.parked]};
  for(const client of recipient?[recipient]:room.players.values())if(client.sharedParking)send(client,message);
 }
 function park(client){
  const {pose,vehicleId,room}=client;
  client.vehicleId=null;
  if(!pose||!vehicleId||(pose[0]==='helicopter'&&pose[2]-height(pose[1],pose[3])>2))return;
  room.parked.set(vehicleId,[...pose.slice(0,5),0]);
  if(room.parked.size>24)room.parked.delete(room.parked.keys().next().value);
  sendParking(room);
 }
 function driveParked(client,id,now){
  const room=client.room,pose=room.parked.get(id),player=client.pose;
  if(client.driver||client.deadAt||player?.[0]!=='foot'||
    (room.hide?.phase==='escape'&&room.hide.seeker===client))return;
  if(!pose||Math.hypot(player[1]-pose[1],player[2]-pose[2],player[3]-pose[3])>6.5){
   send(client,{type:'notice',message:'Il veicolo non è più disponibile qui.'});return;
  }
  room.parked.delete(id);
  client.vehicleId=id;client.pose=pose;client.moveAt=now;
  send(client,{type:'drive-parked',id,pose});
  sendParking(room);
 }
 function leave(client){
  const room=client.room;
  if(!room)return;
  room.players.delete(client.slot);
  activities.release(client);
  park(client);
  activities.leave(room,client);
  client.room=null;
  client.pose=null;
  if(room.players.size)roster(room);
  else rooms.delete(room.code);
 }
 function join(client,mode,code){
  if(client.room)return;
  let room;
  if(mode==='join'){
   room=rooms.get(code);
   if(!room){send(client,{type:'error',message:'Stanza inesistente.'});return;}
  } else if(mode==='public'){
   room=[...rooms.values()].find(entry=>!entry.private&&entry.players.size<ROOM_SIZE);
  } else if(mode!=='private')return;
  if(!room){
   do{code=Array.from(randomBytes(6),n=>alphabet[n&31]).join('');}while(rooms.has(code));
   room={code,private:mode==='private',players:new Map(),parked:new Map(),nextVehicleId:1};
   rooms.set(code,room);
  }
  if(room.players.size>=ROOM_SIZE){send(client,{type:'error',message:'La stanza è piena.'});return;}
  client.slot=Array.from({length:ROOM_SIZE},(_,i)=>i).find(i=>!room.players.has(i));
  client.room=room;
  client.pose=null;client.vehicleId=null;
  client.driver=null;client.passengers=new Set();
  client.health=100;
  client.deadAt=0;
  client.protectedUntil=0;
  client.lastFrame=null;
  client.visiblePoses=new Map();
  client.shotAt=0;
  client.reloads=new Map();
  client.ammo=new Map(Object.entries(WEAPONS).map(([key,value])=>[key,{clip:value.cap,reserve:value.reserve}]));
  room.players.set(client.slot,client);
  roster(room);
  if(room.hide)activities.publish(room);
  activities.crews(room);
  sendParking(room,client);
 }
 function move(client,data,now){
  if(!client.room || client.driver || client.deadAt || data.length!==POSE_BYTES || now-client.moveAt<23)return;
  const p=readPose(new DataView(data.buffer,data.byteOffset,data.byteLength));
  if(!p)return;
  if(!client.adult||!client.combatVisuals)p.length=6;
  const [kind,x,y,z,yaw,speed]=p,ground=height(x,z);
  if(x<terrain.minX||x>terrain.maxX||z<terrain.minZ||z>terrain.maxZ||
     y<ground-5||y>ground+(kind==='helicopter'?550:12)||Math.abs(yaw)>3.15||Math.abs(speed)>130)return;
  const previous=client.pose;
  if(previous){
   const distance=Math.hypot(x-previous[1],z-previous[3]);
   const limit=kind==='foot'&&previous[0]==='foot'?9:115;
   if(distance>(kind===previous[0]?3:7)+limit*Math.min(2,(now-client.moveAt)/1000))return;
  }
  const game=client.room.hide;
  if(game?.phase==='escape'&&game.seeker===client)return;
  if(previous&&previous[0]!=='foot'&&kind!==previous[0]){
   activities.release(client);
   park(client);
  }
  if(kind!=='foot'&&!client.vehicleId){
   client.vehicleId=String(client.room.nextVehicleId++);
   if(client.sharedParking)send(client,{type:'vehicle',id:client.vehicleId,kind});
  }
  client.pose=p;
  client.moveAt=now;
 }
 function syncAmmo(client,msg,ammo){
  if(ammo&&Number.isSafeInteger(msg.seq))send(client,{type:'ammo',weapon:msg.weapon,seq:msg.seq,...ammo});
 }
 function fire(client,msg,now){
  const spec=Object.hasOwn(WEAPONS,msg.weapon)?WEAPONS[msg.weapon]:null;
  const ammo=client.ammo?.get(msg.weapon);
  if(!spec||!ammo)return;
  if(client.room.hide||client.driver||!client.adult||client.deadAt||client.pose?.[0]!=='foot'||
     now+35<client.shotAt||now+35<(client.reloads.get(msg.weapon)||0)||!ammo.clip||
     !Array.isArray(msg.direction)||msg.direction.length!==3||!msg.direction.every(Number.isFinite)){
   syncAmmo(client,msg,ammo);return;
  }
  const length=Math.hypot(...msg.direction);
  if(length<.95||length>1.05){syncAmmo(client,msg,ammo);return;}
  client.shotAt=Math.max(now,client.shotAt)+spec.delay*1000-20;
  ammo.clip--;
  const [,x,y,z]=client.pose, [dx,dy,dz]=msg.direction;
  const a={x,y:y+1.27,z};
  const endpoints=[];
  const witnesses=[...client.room.players.values()].filter(player=>{
   const pose=player.driver?.pose??player.pose;
   return player===client||pose&&Math.hypot(x-pose[1],z-pose[3])<RANGE;
  });
  for(let pellet=0;pellet<spec.pellets;pellet++){
   const b={x:a.x+(dx+(Math.random()-.5)*spec.spread)*RANGE,
    y:a.y+(dy+(Math.random()-.5)*spec.spread)*RANGE,z:a.z+(dz+(Math.random()-.5)*spec.spread)*RANGE};
   let fraction=traceCover(a,b,solidsNear,height).fraction, target;
   for(const player of client.room.players.values()){
    if(player===client||!player.adult||!player.pose||player.deadAt||now<player.protectedUntil)continue;
    const [,px,py,pz]=(player.driver?.pose??player.pose);
    let hit=bodyHit(a,b,px,py,pz);
    const viewed=client.visiblePoses.get(player);
    if(viewed&&now-viewed.at<=180){
     const [,vx,vy,vz]=viewed.pose;
     if(Math.hypot(vx-px,vy-py,vz-pz)<=2)hit=Math.min(hit,bodyHit(a,b,vx,vy,vz));
    }
    if(hit<fraction){fraction=hit;target=player;}
   }
   endpoints.push([a.x+(b.x-a.x)*fraction,a.y+(b.y-a.y)*fraction,a.z+(b.z-a.z)*fraction].map(value=>Math.round(value*100)/100));
   if(!target)continue;
   target.health=Math.max(0,target.health-spec.damage);
   if(!target.health){activities.release(target);target.deadAt=now;target.pose=null;target.vehicleId=null;}
   send(target,{type:'health',value:target.health});
   send(client,{type:'hit',down:!target.health});
  }
  for(const player of witnesses){
   if(player.combatVisuals)send(player,{
    type:'shot',weapon:msg.weapon,x,y:a.y,z,slot:client.slot,self:player===client,endpoints,
   });
   else if(player!==client)send(player,{type:'shot',weapon:msg.weapon,x,z});
  }
 }

 sockets.on('connection',ws=>{
  const client={ws,moveAt:0,windowAt:0,messages:0};
  const timeout=setTimeout(()=>ws.close(1008,'Authentication required'),8000);
  ws.on('error',()=>{});
  ws.on('close',()=>{clearTimeout(timeout);leave(client);});
  ws.on('message',async(data,binary)=>{
   const now=performance.now();
   if(now-client.windowAt>1000){client.windowAt=now;client.messages=0;}
   if(++client.messages>75){ws.close(1008,'Rate limit');return;}
   if(binary){if(client.user)move(client,data,now);return;}
   let msg;
   try{msg=JSON.parse(data.toString());}catch{return;}
   if(!msg||typeof msg.type!=='string')return;
   if(!client.user){
    if(client.authenticating||msg.type!=='auth'||typeof msg.token!=='string')return;
    client.authenticating=true;
    const user=await Promise.resolve().then(()=>authenticate(msg.token)).catch(()=>null);
    if(ws.readyState!==WebSocket.OPEN)return;
    if(!user?.id){ws.close(1008,'Authentication failed');return;}
    clearTimeout(timeout);
    client.user=user.id;
    client.combatVisuals=msg.combatVisuals===true;
    client.sharedParking=msg.sharedParking===true;
    client.adult=user.user_metadata?.adult===true;
    send(client,{type:'ready'});
    return;
   }
   if(msg.type==='room')join(client,msg.mode,msg.code);
   if(!client.room)return;
   if(msg.type==='leave')leave(client);
   else if(msg.type==='hide-start')activities.start(client.room,client,now);
   else if(msg.type==='hide-save')activities.save(client.room,client);
   else if(msg.type==='drive-parked')driveParked(client,msg.id,now);
   else if(msg.type==='board')activities.board(client,msg.slot);
   else if(msg.type==='dismount'&&client.driver){
    const pose=client.driver.pose;
    if(pose&&Math.abs(pose[5])<=3&&(pose[0]!=='helicopter'||pose[2]-height(pose[1],pose[3])<2))activities.release(client);
    else send(client,{type:'notice',message:'Aspetta che il veicolo si fermi o atterri.'});
   } else if(msg.type==='local-death'&&!client.deadAt){
    const victims=[client,...client.passengers];
    activities.release(client);
    for(const player of victims){
     player.health=0;player.deadAt=now;player.pose=null;player.vehicleId=null;
     if(player!==client)send(player,{type:'health',value:0});
    }
   }
   else if(msg.type==='fire')fire(client,msg,now);
   else if(msg.type==='reload'){
    const ammo=client.ammo.get(msg.weapon), spec=Object.hasOwn(WEAPONS,msg.weapon)?WEAPONS[msg.weapon]:null;
    if(!spec||!ammo)return;
    const count=Math.min(spec.cap-ammo.clip,ammo.reserve);
    if(count>0&&now>=(client.reloads.get(msg.weapon)||0)){
     ammo.clip+=count;ammo.reserve-=count;client.reloads.set(msg.weapon,now+1250);
    }else syncAmmo(client,msg,ammo);
   } else if(msg.type==='respawn'&&client.deadAt&&now-client.deadAt>=1200){
    client.health=100;client.deadAt=0;client.protectedUntil=now+2500;
    send(client,{type:'health',value:100});
   }
  });
 });

 const snapshot=setInterval(()=>{
  for(const room of rooms.values()){
   activities.update(room,performance.now());
   for(const client of room.players.values()){
    if(client.ws.readyState!==WebSocket.OPEN||client.ws.bufferedAmount>1024)continue;
    const pose=client.driver?.pose??client.pose;
    const nearby=[...room.players.values()].filter(other=>other!==client&&!other.driver&&other.pose&&pose&&
     (other===client.driver||Math.hypot(other.pose[1]-pose[1],other.pose[3]-pose[3])<VIEW_DISTANCE)&&
     !(room.hide?.phase==='escape'&&room.hide.seeker===client&&room.hide.hiders.has(other)));
    const frame=Buffer.allocUnsafe(nearby.length*(POSE_BYTES+1));
    const view=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
    nearby.forEach((other,i)=>{
     const offset=i*(POSE_BYTES+1);view.setUint8(offset,other.slot);writePose(view,offset+1,other.pose,client.combatVisuals);
    });
    if(client.lastFrame?.equals(frame))continue;
    client.lastFrame=frame;
    client.visiblePoses.clear();
    const at=performance.now();
    for(const player of nearby)client.visiblePoses.set(player,{pose:player.pose,at});
    client.ws.send(frame);
   }
  }
 },50);
 const heartbeat=setInterval(()=>{
  for(const ws of sockets.clients){
   if(!ws.onlineAlive){ws.terminate();continue;}
   ws.onlineAlive=false;ws.ping();
  }
 },15000);
 sockets.on('connection',ws=>{ws.onlineAlive=true;ws.on('pong',()=>{ws.onlineAlive=true;});});
 http.on('close',()=>{clearInterval(snapshot);clearInterval(heartbeat);});
 return {http,close(){for(const ws of sockets.clients)ws.terminate();sockets.close();http.close();}};
}

if(process.argv[1] && import.meta.url===new URL(process.argv[1],'file:').href){
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key)throw Error('Configura SUPABASE_URL e SUPABASE_ANON_KEY.');
 const origins=(process.env.ONLINE_ORIGINS||'http://localhost:5191,http://127.0.0.1:5191').split(',').map(value=>value.trim()).filter(Boolean);
 const load=async name=>JSON.parse(await readFile(new URL('../public/'+name+'.json',import.meta.url),'utf8'));
 const [world,extras]=await Promise.all([load('world-data'),load('dbt-extras')]);
 const index=new SpatialIndex(24);
 for(const solid of [...world.buildings.flatMap(buildingCollisionParts),...extraColliders(extras.features)])index.insert(solid,solid.bounds);
 const packed=await readFile(new URL('../public/teglie/world.pack',import.meta.url)).catch(error=>{
  if(error.code!=='ENOENT')throw error;
 });
 let terrain=world.terrain;
 if(packed){
  const zone=JSON.parse(gunzipSync(packed));
  const base=world.terrain;
  const original={elevationAt:(x,z)=>elevation(base,x,z)};
  const extension=createTeglieRoadNetwork(world,zone,original);
  terrain={...base,minX:zone.terrain.minX,minZ:zone.terrain.minZ};
  installRoadSurface(terrain,{elevationAt:(x,z)=>x>=base.minX&&z>=base.minZ?
   elevation(base,x,z):extension.elevationAt(x,z)});
  for(const solid of zone.buildings.flatMap(buildingCollisionParts))index.insert(solid,solid.bounds);
 }
 const server=createOnlineServer({terrain,spawn:hideSavePoint(world),startPoint:hideStartPoint(world),origins,solidsNear:(x,z,r)=>index.box([x-r,z-r,x+r,z+r]),async authenticate(token){
  const response=await fetch(new URL('/auth/v1/user',url),{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});
  return response.ok?response.json():null;
 }});
 server.http.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Online in ascolto su '+server.http.address().port));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
}
