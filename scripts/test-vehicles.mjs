import assert from 'node:assert/strict';
import {advanceVehicle,VEHICLES,vehicleGear,vehicleFootprint} from '../src/vehicle-physics.js';
import {wheelPose,installRoadSurface} from '../src/world-math.js';
const terrain={cols:2,rows:2,cell:100000,minX:-50000,minZ:-50000,maxX:50000,maxZ:50000,heights:[0,0,0,0]};
for(const spec of Object.values(VEHICLES)){
 const car={spec,x:0,z:0,yaw:0,speed:0};for(let i=0;i<90*60;i++)advanceVehicle(car,{forward:1},1/90,terrain,()=>[]);
 assert.ok(Math.abs(car.speed-spec.maxSpeed)<.01,`${spec.id} reaches its declared top speed`);assert.equal(vehicleGear(car),spec.gears.length);
 const vmax=car.speed;for(let i=0;i<90*6;i++)advanceVehicle(car,{brake:true},1/90,terrain,()=>[]);assert.ok(car.speed<.01,'strong brakes stop the car');
 console.log(`${spec.label}: ${(vmax*3.6).toFixed(2)} km/h, ${spec.gears.length} marce, frenata verificata.`);
}
const wall={bounds:[-10,5,10,5.1],rings:[[[-10,5],[10,5],[10,5.1],[-10,5.1],[-10,5]]]};
for(const dt of [1/90,1/30,.08]){const car={spec:VEHICLES.ferrari,x:0,z:0,yaw:0,speed:350/3.6};for(let i=0;i<20;i++)advanceVehicle(car,{},dt,terrain,()=>[wall]);assert.ok(car.z+car.spec.length/2<5.05,'swept nose never tunnels through a 10 cm wall');assert.ok(Number.isFinite(car.z));}
installRoadSurface(terrain,{elevationAt:(x,z)=>20+Math.sin(z*.04)*3,pavementAt:()=>true});
const c={spec:VEHICLES.ferrari,x:0,z:0,yaw:0,speed:350/3.6};for(let i=0;i<1000;i++){advanceVehicle(c,{forward:1},1/90,terrain,()=>[]);const pose=wheelPose(terrain,c.x,c.z,c.yaw,c.spec);assert.equal(pose.roll,0);for(const p of pose.points)assert.ok(Math.abs(p.y-(20+Math.sin(p.z*.04)*3+c.spec.radius))<1e-9);}
console.log('Ferrari a 350 km/h: CCD muso/coda, frame da 80 ms, quattro ruote sul terreno, roll nullo: OK.');

const parked={spec:VEHICLES.ferrari,x:0,z:10,yaw:0},moving={spec:VEHICLES.panda,x:0,z:0,yaw:0,speed:20};for(let i=0;i<180;i++)advanceVehicle(moving,{forward:1},1/90,terrain,()=>[vehicleFootprint(parked)]);assert.ok(moving.z+moving.spec.length/2<=parked.z-parked.spec.length/2+.02);console.log('PASS: parked vehicles have oriented solid footprints; no overlapping cars.');
