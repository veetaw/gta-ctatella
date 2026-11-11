import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import WebSocket from 'ws';
import {createOnlineServer} from '../server/online.mjs';
import {POSE_BYTES,writePose} from '../src/online-wire.js';
const terrain={minX:-500,maxX:500,minZ:-500,maxZ:500,cols:2,rows:2,cell:1000,heights:[0,0,0,0]};
const server=createOnlineServer({terrain,garageCenter:{x:100,z:100},solidsNear:()=>[],authenticate:async id=>({id,user_metadata:{adult:true,username:id,gta_progress_v2:{economy:{rp:1000}}}})});
server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
const ws=new WebSocket('ws://127.0.0.1:'+server.http.address().port+'/online'),messages=[];
ws.on('message',(data,binary)=>{if(!binary)messages.push(JSON.parse(data));});await once(ws,'open');
const send=(type,value={})=>ws.send(JSON.stringify({type,...value}));
async function message(type,check=()=>true){for(let i=0;i<100;i++){const index=messages.findIndex(m=>m.type===type&&check(m));if(index>=0)return messages.splice(index,1)[0];await sleep(10);}throw Error('Missing '+type);}
function pose(kind,x,z){const data=new ArrayBuffer(POSE_BYTES);writePose(new DataView(data),0,[kind,x,0,z,0,0]);ws.send(data);}
try{
 send('auth',{token:'driver',sharedGarage:true,sharedParking:true,vehicleHandoff:true});await message('ready');send('room',{mode:'private'});await message('room');await message('parking');
 for(const [kind,x,z] of [['panda',80,91],['helicopter',100,100]]){
  if(kind==='helicopter'){send('leave');await sleep(40);messages.length=0;send('room',{mode:'private'});await message('room');await message('parking');await sleep(40);}
  pose('foot',x,z);await sleep(65);send('drive-parked',{id:'garage:'+kind});const claimed=await message('drive-parked');await message('parking',m=>!m.vehicles.some(([id])=>id==='garage:'+kind));
  // This packet was sent while the boarding reply was still in flight.
  await sleep(35);pose('foot',x,z);await sleep(65);
  const stale=messages.filter(m=>m.type==='parking'&&m.vehicles.some(([id])=>id==='garage:'+kind));
  assert.equal(stale.length,0,'stale pre-boarding foot packet must not park a duplicate '+kind);
  assert.ok(claimed.handoff,'boarding has a server transaction token');send('vehicle-ready',{id:claimed.id,handoff:claimed.handoff});await sleep(30);pose(kind,x,z);await sleep(65);
  assert.ok(!messages.some(m=>m.type==='vehicle'),'same vehicle identity remains owned');
  pose('foot',x+2,z);const parked=await message('parking',m=>m.vehicles.some(([id])=>id===claimed.id));assert.equal(parked.vehicles.filter(([id])=>id===claimed.id).length,1);
  console.log('PASS: stale boarding packet ignored; exactly one '+kind+' after drive and dismount.');await sleep(40);
 }
}finally{ws.close();server.close();}
