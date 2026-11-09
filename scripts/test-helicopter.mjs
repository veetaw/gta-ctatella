import assert from 'node:assert/strict';
import {advanceHelicopter} from '../src/helicopter-physics.js';
const terrain={minX:-1000,minZ:-1000,maxX:1000,maxZ:1000};const h={x:0,z:0,y:15,yaw:0,speed:0,verticalSpeed:0};
const step=(input,n=300,near=()=>[],ready=()=>true)=>{for(let i=0;i<n;i++)advanceHelicopter(h,input,1/90,()=>0,near,terrain,ready);assert(Object.values(h).every(Number.isFinite));};
step({forward:1,turn:0,lift:1});assert(h.z>50&&h.y>25&&h.speed<=28);step({forward:0,turn:0,lift:0});assert(h.speed<.2&&Math.abs(h.verticalSpeed)<.01,'Hover stabilizes without input');
step({forward:0,turn:0,lift:-1},3000);assert.equal(h.y,-.055,'Skids remain above ground');
step({forward:0,turn:0,lift:-1},100,()=>[{bounds:[h.x-2,h.z-2,h.x+2,h.z+2],roofY:20},{}]);assert(h.y>=23.5,'Never sink into building roofs; roofless DBT colliders are safe');
const z=h.z;step({forward:1,turn:0,lift:0},100,()=>[],()=>false);assert.equal(h.z,z,'Pause horizontal motion until next neighbourhood is ready');
step({forward:0,turn:0,lift:1},3000);assert.equal(h.y,180,'Bound maximum altitude');console.log('PASS: helicopter forward flight, hover, ascent/descent, terrain/roof clearance, finite state, streaming gate and altitude ceiling.');
