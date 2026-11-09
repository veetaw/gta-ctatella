import assert from 'node:assert/strict';
import {launchMazzuoccolo,advanceMazzuoccolo,mazzuoccoloWallContact} from '../src/mazzuoccolo-physics.js';
const flat={height:()=>0,onRoad:()=>true};
function run(body,surface=flat){for(let i=0;i<3000&&body.status==='rolling';i++)advanceMazzuoccolo(body,1/90,surface);assert.notEqual(body.status,'rolling');assert.ok([body.x,body.y,body.z,body.distance,body.orientation.length()].every(Number.isFinite));assert.ok(Math.abs(body.orientation.length()-1)<1e-6);return body;}
const weak=run(launchMazzuoccolo(0,0,0,.1)),strong=run(launchMazzuoccolo(0,0,0,1));
assert.equal(strong.status,'stopped');assert.ok(strong.distance>weak.distance);assert.ok(strong.bounces>0);assert.ok(strong.path>=strong.distance);
const uphill=run(launchMazzuoccolo(0,0,0,.6),{...flat,height:(x,z)=>z*.06}),downhill=run(launchMazzuoccolo(0,0,0,.6),{...flat,height:(x,z)=>-z*.06});assert.ok(downhill.distance>uphill.distance);
const offRoad=run(launchMazzuoccolo(0,0,Math.PI/2,1),{...flat,onRoad:x=>Math.abs(x)<2});assert.equal(offRoad.status,'stopped');assert(offRoad.x>2);
const wall={bounds:[-100,4,100,4.12],rings:[[[-100,4],[100,4],[100,4.12],[-100,4.12],[-100,4]]]};
const rebound=launchMazzuoccolo(0,0,0,1);let maxZ=0,reflected=false;
const walls={...flat,contact:(body,x,z)=>mazzuoccoloWallContact(body,x,z,[wall])};
for(let i=0;i<3000&&rebound.status==='rolling';i++){advanceMazzuoccolo(rebound,1/90,walls);maxZ=Math.max(maxZ,rebound.z);if(rebound.vz<0)reflected=true;}
assert.ok(reflected,'wall must reverse the normal velocity');assert.ok(maxZ<4,'no tunnelling through a 12cm wall');assert.equal(rebound.status,'stopped');assert.ok(rebound.bounces>0);
const curb=launchMazzuoccolo(0,0,0,.05);curb.vy=0;let kerbBounce=false;
for(let i=0;i<3000&&curb.status==='rolling';i++){advanceMazzuoccolo(curb,1/90,{...flat,height:(x,z)=>z>=2?.18:0});if(curb.vz<0)kerbBounce=true;}
assert.ok(kerbBounce,'a low rolling body must rebound at a raised kerb');
assert.equal(run(launchMazzuoccolo(0,0,0,1),{...flat,ready:(x,z)=>z<3}).status,'lost');
assert.equal(launchMazzuoccolo(0,0,0,10).vz,19);
console.log('Mazzuoccolo: forma asimmetrica, pendenze, rimbalzi, muro sottile, cordolo, arresto e fuori strada verificati.');
