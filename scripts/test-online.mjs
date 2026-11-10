import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import WebSocket from 'ws';
import {createRoomTraffic} from '../server/online-traffic.mjs';
import {rememberVehicle,sampleVehicle} from '../src/online-motion.js';
import {createActivities} from '../server/online-activities.mjs';
import {createOnlineServer} from '../server/online.mjs';
import {POSE_BYTES,writePose,readPose} from '../src/online-wire.js';

const terrain={minX:-500,maxX:500,minZ:-500,maxZ:500,cols:2,rows:2,cell:1000,heights:[0,0,0,0]};
const wall={bounds:[-2,4,2,4.2],rings:[[[-2,4],[2,4],[2,4.2],[-2,4.2],[-2,4]]],roofY:3};
let blocked=false;
const server=createOnlineServer({terrain,solidsNear:()=>blocked?[wall]:[],
 authenticate:async token=>token?{id:token,user_metadata:{adult:true,username:token}}:null});
server.http.listen(0,'127.0.0.1');
await once(server.http,'listening');
const url='ws://127.0.0.1:'+server.http.address().port+'/online';

async function client(name){
 const socket=new WebSocket(url),messages=[],frames=[];
 socket.on('message',(data,binary)=>binary?frames.push(data):messages.push(JSON.parse(data)));
 await once(socket,'open');
 const send=(type,extra={})=>socket.send(JSON.stringify({type,...extra}));
 async function wait(read){
  for(let i=0;i<250;i++){const value=read();if(value)return value;await sleep(10);}
  throw Error('Missing server response for '+name);
 }
 const message=(type,predicate=()=>true)=>wait(()=>{
  const index=messages.findIndex(item=>item.type===type&&predicate(item));
  return index>=0?messages.splice(index,1)[0]:null;
 });
 send('auth',{token:name,combatVisuals:name==='guest',sharedParking:name==='guest'});
 await message('ready');
 return {socket,send,message,wait,messages,frames,pose(kind,x,z,yaw=0,weapon,speed=0){
  const frame=new ArrayBuffer(POSE_BYTES);
  writePose(new DataView(frame),0,[kind,x,0,z,yaw,speed,weapon]);
  socket.send(frame);
 }};
}

try{
 const [host,guest,publicPlayer]=await Promise.all(['host','guest','public'].map(client));
 host.send('room',{mode:'private'});
 const {code}=await host.message('room');
 publicPlayer.send('room',{mode:'public'});
 assert.notEqual((await publicPlayer.message('room')).code,code);
 guest.send('room',{mode:'join',code});
 assert.equal((await guest.message('room')).count,2);
 await host.message('room',item=>item.count===2);
 host.pose('foot',0,0);
 guest.pose('punto',0,8);
 await host.wait(()=>host.frames.some(frame=>frame.length===18&&readPose(new DataView(frame.buffer,frame.byteOffset,frame.length),1)[0]==='punto'));
 await sleep(60);
 guest.pose('foot',0,8);
 await host.wait(()=>host.frames.some(frame=>frame.length===18&&readPose(new DataView(frame.buffer,frame.byteOffset,frame.length),1)[0]==='foot'));
 blocked=true;
 const shot=()=>host.send('fire',{weapon:'pistol',direction:[0,0,1]});
 shot();
 host.send('fire',{weapon:'pistol',direction:[0,0,1],seq:1});
 assert.equal((await host.message('ammo',item=>item.seq===1)).clip,11);
 await sleep(250);
 assert(!guest.messages.some(item=>item.type==='health'));
 const visual=await guest.message('shot');
 assert.equal(visual.slot,0);
 assert(visual.endpoints[0][2]>3&&visual.endpoints[0][2]<4.5,'tracer stops at the wall');
 blocked=false;
 for(const health of [68,36,4,0]){
  shot();
  assert.equal((await guest.message('health')).value,health);
  await host.message('hit',item=>item.down===(health===0));
  await sleep(235);
 }
 await sleep(1020);
 guest.send('respawn');
 assert.equal((await guest.message('health')).value,100);
 const more=await Promise.all(['third','fourth','fifth','sixth','overflow'].map(client));
 for(let i=0;i<4;i++){
  more[i].send('room',{mode:'join',code});
  assert.equal((await more[i].message('room')).count,3+i);
 }
 more[4].send('room',{mode:'join',code});
 assert.match((await more[4].message('error')).message,/piena/);
 more[0].send('leave');
 await host.message('room',item=>item.count===5);
 more[4].send('room',{mode:'join',code});
 assert.equal((await more[4].message('room')).count,6);
 const riders=[guest,more[1],more[2],more[3],more[4]];
 for(const kind of ['punto','helicopter','rambo']){
  const capacity=kind==='punto'?4:kind==='helicopter'?2:6;
  host.pose(kind,0,0);
  riders.forEach(rider=>rider.pose('foot',0,4));
  await sleep(75);
  for(const [i,rider] of riders.entries()){
   rider.send('board',{slot:0});
   if(i<capacity-1)assert.equal((await rider.message('seat')).driver,0);
   else assert.match((await rider.message('notice')).message,/posti/);
  }
  await sleep(30);
  host.pose('foot',0,0);
  for(const rider of riders.slice(0,capacity-1))await rider.message('seat',event=>event.driver===null);
  await sleep(30);
 }
 host.pose('rambo',0,0);
 await sleep(60);
 guest.send('board',{slot:0});
 await guest.message('seat',event=>event.driver===0);
 host.send('local-death');
 assert.equal((await guest.message('health')).value,0);
 await sleep(1250);
 host.send('respawn');
 guest.send('respawn');
 assert.equal((await host.message('health')).value,100);
 assert.equal((await guest.message('health')).value,100);

 host.pose('rambo',0,0);
 guest.pose('foot',0,4,0,'smg');
 await sleep(75);
 guest.send('board',{slot:0});
 await guest.message('seat',event=>event.driver===0);
 guest.pose('foot',12,12);
 await guest.message('seat',event=>event.driver===0&&event.pose[0]==='rambo');
 await sleep(30);
 host.pose('foot',0,0);
 await guest.message('seat',event=>event.driver===null);
 const parking=await guest.message('parking',event=>event.vehicles.some(([,pose])=>pose[0]==='rambo'&&pose[1]===0));
 const [parkedId]=parking.vehicles.find(([,pose])=>pose[0]==='rambo'&&pose[1]===0);
 guest.send('drive-parked',{id:parkedId});
 assert.equal((await guest.message('drive-parked')).id,parkedId);
 await guest.message('parking',event=>!event.vehicles.some(([id])=>id===parkedId));

 // Run the timed phase at explicit server timestamps to cover round outcomes without sleeping.
 const makePlayer=(kind,x)=>({pose:[kind,x,0,0,0,0],messages:[]});
 const seeker=makePlayer('foot',40), first=makePlayer('punto',0), second=makePlayer('punto',12);
 seeker.pose[4]=-Math.PI/2;
 const activityRoom={players:new Map([[0,seeker],[1,first],[2,second]])};
 let sight=true;
 const activities=createActivities({send:(player,msg)=>player.messages.push(msg),height:()=>0,
  spawn:{x:0,z:0},viewDistance:230,canSee:()=>sight});
 const armedPose=new DataView(new ArrayBuffer(POSE_BYTES));
 writePose(armedPose,0,['foot',0,0,0,0,0,'smg']);
 assert.equal(readPose(armedPose)[6],'smg');
 writePose(armedPose,0,['foot',0,0,0,0,0,'smg'],false);
 assert.equal(readPose(armedPose).length,6);
 const now=performance.now();
 activities.start(activityRoom,seeker,now);
 assert.equal(seeker.messages.at(-1).role,'seeker');
 assert.equal(first.messages.at(-1).seconds,10);
 activities.update(activityRoom,now+9999);
 assert.equal(activityRoom.hide.phase,'escape');
 activities.update(activityRoom,now+10000);
 assert.equal(activityRoom.hide.phase,'search');
 first.pose[0]='foot';
 activities.save(activityRoom,first);
 assert.match(first.messages.at(-1).message,/ti vede/);
 sight=false;
 activities.save(activityRoom,first);
 assert.equal(first.messages.at(-1).role,'saved');
 assert.equal(second.messages.at(-1).role,'hider');
 assert.equal(second.messages.at(-1).remaining,1);
 sight=true;
 seeker.pose[1]=13;
 activities.update(activityRoom,now+10050);
 assert.match(first.messages.at(-1).result,/salvato/);
 assert.match(second.messages.at(-1).result,/scoperto/);
 assert.equal(activityRoom.hide,null);
 const church={x:40,z:0,yaw:-Math.PI/2};
 const churchRound=createActivities({send:(player,msg)=>player.messages.push(msg),height:()=>0,
  startPoint:church,viewDistance:230,canSee:()=>true});
 churchRound.start(activityRoom,seeker,now);
 assert.match(seeker.messages.at(-1).message,/chiesa/);
 seeker.pose=['foot',39,0,0,0,0];
 churchRound.start(activityRoom,seeker,now);
 assert.deepEqual(seeker.messages.at(-1).counting,{...church,y:0});
 assert.equal(seeker.pose[4],church.yaw);
 const [driver,pedestrian]=await Promise.all(['ram-driver','ram-pedestrian'].map(client));
 driver.send('room',{mode:'private'});
 const ramRoom=await driver.message('room');
 pedestrian.send('room',{mode:'join',code:ramRoom.code});
 await pedestrian.message('room');
 pedestrian.pose('foot',0,4);
 driver.pose('punto',0,0);
 await sleep(75);
 driver.pose('punto',0,3,0,undefined,20);
 assert.equal((await pedestrian.message('health')).value,0);
 assert.equal((await driver.message('hit')).down,true);
 assert.deepEqual(await pedestrian.message('death-log'),{
  type:'death-log',victim:'ram-pedestrian',killer:'ram-driver',
 });

 const [otherDriver,rider]=await Promise.all(['ram-other','ram-rider'].map(client));
 for(const participant of [otherDriver,rider]){
  participant.send('room',{mode:'join',code:ramRoom.code});
  await participant.message('room');
 }
 otherDriver.pose('rambo',0,8);
 rider.pose('foot',0,10);
 await sleep(65);
 rider.send('board',{slot:2});
 await rider.message('seat',event=>event.driver===2);
 driver.pose('punto',0,7,0,undefined,26);
 assert.equal((await rider.message('health')).value,0);
 assert.equal((await otherDriver.message('health')).value,0);

 const samples=[];
 rememberVehicle(samples,['punto',0,0,0,0,10],100);
 rememberVehicle(samples,['punto',0,0,1,0,10],200);
 assert.equal(sampleVehicle(samples,225)[3],.5);
 assert.equal(sampleVehicle(samples,1000)[3],1.55);

 const mockTraffic=createRoomTraffic({roads:[{points:[[0,0],[0,100]]}],height:()=>0,
  send:(player,msg)=>player.messages.push(msg),spawn:{x:0,z:0}});
 const observers=[{trafficEnabled:true,ws:{bufferedAmount:0},messages:[]},{trafficEnabled:true,ws:{bufferedAmount:0},messages:[]}];
 const trafficRoom={players:new Map(observers.map((player,i)=>[i,player]))};
 mockTraffic.update(trafficRoom,100);
 assert.deepEqual(observers[0].messages.at(-1),observers[1].messages.at(-1));
 mockTraffic.take(trafficRoom,0,110,pose=>pose[0]==='punto');
 assert.equal(observers[1].messages.at(-1).vehicles[0],null);
 console.log('PASS: rooms, seats (4/2/6), parking, PvP including vehicle hits, shared traffic, interpolation, and hide-and-seek.');
}finally{
 server.close();
}
