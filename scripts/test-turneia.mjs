import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {createTurneiaScore} from '../src/turneia-score.js';
import {makeTurneia,turneiaLocation} from '../src/turneia.js';
import {makePerson} from '../src/actors.js';
import {resolveCollision,inBuilding,nearest} from '../src/world-math.js';
const center={x:0,z:0},point=(a,r=20)=>({x:Math.cos(a)*r,z:Math.sin(a)*r,onFoot:true}),score=createTurneiaScore(center);
score.start(point(0));assert.equal(score.jump(),0);
let a=0;const dt=1/60;
function advance(seconds,{herd=true,sprint=false,direction=1,radius=20}={}){let result;for(let i=0;i<seconds*60;i++){a+=direction*(sprint?6:3)*dt/radius;result=score.update(point(a,radius),dt,herd,sprint);}return result;}
advance(1);const walking=score.state().points;assert.ok(walking>=2);assert.equal(score.jump(),50);assert.equal(score.jump(),0);advance(2,{sprint:true});assert.equal(score.jump(),100);
let before=score.state();advance(3,{herd:false});assert.equal(score.state().points,before.points);assert.equal(score.state().winding,before.winding);assert.equal(score.jump(),0);
score.start(point(0));a=0;advance(1);advance(1,{direction:-1});assert.ok(score.state().winding<.001,'reversing must cancel angular progress');
score.start(point(0));a=0;score.update(point(1),dt,true,true);assert.equal(score.state().points,0,'teleport must not award points');
score.start(point(0));a=0;let completed=false;for(let i=0;i<5000&&!completed;i++){a+=6*dt/20;completed=score.update(point(a),dt,true,true).complete;}assert.equal(completed,true);assert.equal(score.state().laps,3);assert.ok(score.state().points>2250);assert.equal(score.state().active,false);
score.start(point(0,1));score.update(point(.1,1),1,true,false);assert.equal(score.state().points,0,'crossing the center cannot score');
// Regression: circle the real, narrow San Vito footprint rather than its forecourt GPS.
const world=JSON.parse(fs.readFileSync(new URL('../public/world-data.json',import.meta.url))),church=world.buildings.find(b=>b.church?.variant==='san-vito'),location=turneiaLocation(world.origin,world.buildings),mobileLocation=turneiaLocation(world.origin,world.buildings.map(({id,name,bounds})=>({id,name,bounds})));
assert.deepEqual(location.center,mobileLocation.center,'mobile collider metadata must identify the same church');
assert(Math.hypot(location.center.x-location.anchor.x,location.center.z-location.anchor.z)>15,'forecourt is outside the church');
const [x0,z0,x1,z1]=church.bounds,outline=[{x:x0-1.2,z:z0-1.2,onFoot:true},{x:x1+1.2,z:z0-1.2,onFoot:true},{x:x1+1.2,z:z1+1.2,onFoot:true},{x:x0-1.2,z:z1+1.2,onFoot:true}];
for(const reverse of [false,true]){const route=reverse?[...outline].reverse():outline,real=createTurneiaScore(location.center);real.start(route[0]);for(let lap=0;lap<3;lap++)for(let edge=0;edge<4;edge++){const from=route[edge],to=route[(edge+1)%4],steps=Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.07);for(let i=1;i<=steps;i++)real.update({x:from.x+(to.x-from.x)*i/steps,z:from.z+(to.z-from.z)*i/steps,onFoot:true},dt,true,false);}assert.equal(real.state().laps,3,`real church perimeter ${reverse?'clockwise':'anticlockwise'} must complete 3 laps`);}
// A short step in the opposite direction at the start must not lock the entire run.
const reversedStart=createTurneiaScore(center);reversedStart.start(point(0));reversedStart.update(point(-.005),dt,true,false);for(let angle=0;angle<=Math.PI*2+.01;angle+=.005)reversedStart.update(point(angle),dt,true,false);assert.equal(reversedStart.state().laps,1);
console.log('PASS real San Vito: correct center on desktop/mobile, tight wall perimeter, both directions and initial direction reversal.');
// Exercise actual herd, UI and mission completion, including escape/recall.
const nodes=new Map();globalThis.document={body:{append(){}},createElement(tag){if(tag==='canvas')return createCanvas(1,1);return {setAttribute(){},querySelector(s){if(!nodes.has(s))nodes.set(s,{hidden:false,textContent:''});return nodes.get(s);}};}};globalThis.window={};
const scene=new THREE.Scene();const person=makePerson(scene);assert.ok(person.root.getObjectByName('Maglia · BACCANALIA'));assert.ok(person.root.getObjectByName('Maglia · ctatella'));
let p={x:0,z:0,onFoot:true,sprinting:true},win=null;const mission=makeTurneia(scene,{origin:{x:0,y:0},player:()=>p,height:()=>0,ready:()=>true,clear:()=>true,move:(x,z,dx,dz)=>[x+dx,z+dz],toast(){},onWin:points=>win=points});const c=mission.center;p={...p,x:mission.home.x,z:mission.home.z};mission.start();assert.equal(mission.stats().active,true);
for(let i=0;i<780;i++)mission.update(dt);assert.equal(mission.stats().fleeing,true);const stopped=mission.stats().points;mission.update(dt);assert.equal(mission.stats().points,stopped);mission.call();assert.equal(mission.stats().fleeing,false);
let theta=Math.atan2(p.z-c.z,p.x-c.x),r=20; // Reach the valid ring before starting measured laps.
p={...p,x:c.x+Math.cos(theta)*r,z:c.z+Math.sin(theta)*r};
for(let i=0;i<10000&&win===null;i++){theta+=5*dt/r;p={...p,x:c.x+Math.cos(theta)*r,z:c.z+Math.sin(theta)*r};mission.update(dt);if(mission.stats().fleeing)mission.call();}
assert.ok(win>1500,'real flock must keep up and allow three laps');assert.equal(mission.stats().laps,3);assert.equal(mission.stats().animals.length,26);
const herd=scene.getObjectByName('Turneia · 2 Lu Muanz tricolore e 24 pecore');assert.equal(herd.children.length,7);assert.ok(herd.children.every(m=>m.isInstancedMesh));
const oxMatrix=new THREE.Matrix4(),sheepMatrix=new THREE.Matrix4();herd.children[2].getMatrixAt(0,oxMatrix);herd.children[0].getMatrixAt(0,sheepMatrix);herd.children[2].geometry.computeBoundingBox();herd.children[0].geometry.computeBoundingBox();const oxHeight=herd.children[2].geometry.boundingBox.clone().applyMatrix4(oxMatrix).getSize(new THREE.Vector3()).y,sheepHeight=herd.children[0].geometry.boundingBox.clone().applyMatrix4(sheepMatrix).getSize(new THREE.Vector3()).y;assert(oxHeight>sheepHeight&&oxHeight<sheepHeight*1.5,'manzi must be only slightly larger than the sheep');
console.log('PASS Turneia: 3 laps, reversal/teleport/radius guards, sprint, jump cooldown, fleeing, recall, flock following, completion, 26 instanced animals and both shirt labels.');

// Integration on the real church walls and neighbouring buildings: leaders must
// stay close enough through the narrow corners for scoring to resume after calls.
const nearby=world.buildings.filter(b=>b.bounds[0]<x1+30&&b.bounds[2]>x0-30&&b.bounds[1]<z1+30&&b.bounds[3]>z0-30);
const realMove=(x,z,dx,dz,r)=>resolveCollision([x,z],[dx,dz],r,nearby,world.terrain);
const realClear=(x,z,r)=>!nearby.some(b=>inBuilding([x,z],b)||b.rings.some(ring=>ring.slice(1).some((v,i)=>nearest([x,z],ring[i],v).d<r)));
let walker={onFoot:true,sprinting:false,x:0,z:0};let realWin=null;
const churchMission=makeTurneia(new THREE.Scene(),{origin:world.origin,buildings:world.buildings,player:()=>walker,height:()=>0,ready:()=>true,clear:realClear,move:realMove,toast(){},onWin:points=>realWin=points});
walker={...walker,...churchMission.home};churchMission.start();
function walkTo(target){const from={...walker},steps=Math.ceil(Math.hypot(target.x-from.x,target.z-from.z)/.05);for(let i=1;i<=steps;i++){const destination={x:from.x+(target.x-from.x)*i/steps,z:from.z+(target.z-from.z)*i/steps};const [x,z]=realMove(walker.x,walker.z,destination.x-walker.x,destination.z-walker.z,.32);assert(Math.hypot(x-destination.x,z-destination.z)<.01,'test route must walk outside real walls');walker={...walker,x,z};churchMission.update(dt);if(churchMission.stats().fleeing)churchMission.call();}}
walkTo(outline[3]);for(let lap=0;lap<5&&realWin===null;lap++)for(const target of outline)walkTo(target);
assert.equal(churchMission.stats().laps,3,'real walls and compact flock must allow completion');assert(realWin>1500);
console.log('PASS actual church mission with real neighbouring colliders, tight corners, fleeing/recall and three counted laps.');
