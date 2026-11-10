import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import WebSocket from 'ws';
import {createOnlineServer} from '../server/online.mjs';
import {POSE_BYTES,writePose,readPose} from '../src/online-wire.js';

const terrain={minX:-500,maxX:500,minZ:-500,maxZ:500,cols:2,rows:2,cell:1000,heights:[0,0,0,0]};
const wall={bounds:[-2,4,2,4.2],rings:[[[-2,4],[2,4],[2,4.2],[-2,4.2],[-2,4]]],roofY:3};
let blocked=false;
const server=createOnlineServer({terrain,solidsNear:()=>blocked?[wall]:[],
 authenticate:async token=>token?{id:token,user_metadata:{adult:true}}:null});
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
 send('auth',{token:name});
 await message('ready');
 return {socket,send,message,wait,messages,frames,pose(kind,x,z,yaw=0){
  const frame=new ArrayBuffer(POSE_BYTES);
  writePose(new DataView(frame),0,[kind,x,0,z,yaw,0]);
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
 await sleep(250);
 assert(!guest.messages.some(item=>item.type==='health'));
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
 console.log('PASS: public/private rooms, six seats, vehicle transitions, compact poses, cover, combat and respawn.');
}finally{
 server.close();
}
