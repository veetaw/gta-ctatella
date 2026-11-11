import {processionOverlaps} from './procession-collisions.js';
import {updatePowertrain} from './powertrain.js';
import {elevation,resolveCollision} from './world-math.js';
export const VEHICLES={
 panda:{id:'panda',label:'FIAT PANDA 4X4',maxSpeed:130/3.6,acceleration:5.8,brake:11,reverse:7,wheelbase:2.16,track:1.26,radius:.30,turn:.62,gears:[0,7,14,23,30],width:1.49,length:3.38},
 punto:{id:'punto',label:'FIAT PUNTO',maxSpeed:165/3.6,acceleration:4.8,brake:12,reverse:7,wheelbase:2.45,track:1.36,radius:.29,turn:.55,gears:[0,8,16,26,37],width:1.625,length:3.76},
 rambo:{id:'rambo',label:'RAMBO 4×4',maxSpeed:40/3.6,acceleration:3.3,brake:8,reverse:4,wheelbase:2.20,track:1.18,radius:.32,turn:.66,gears:[0,3,6,8.5],width:1.54,length:4.02},
 motocross:{id:'motocross',label:'MOTO DA CROSS',maxSpeed:105/3.6,acceleration:8.3,brake:14,reverse:1.7,wheelbase:1.48,track:.24,radius:.34,turn:.62,gears:[0,4,9,15,22],width:.77,length:2.22},
 ape:{id:'ape',label:'APE',maxSpeed:55/3.6,acceleration:3.1,brake:8,reverse:4,wheelbase:1.7,track:1.02,radius:.23,turn:.68,gears:[0,4,8,12],width:1.32,length:2.65},
 offroad:{id:'offroad',label:'FUORISTRADA',maxSpeed:155/3.6,acceleration:7,brake:13,reverse:7,wheelbase:2.55,track:1.52,radius:.39,turn:.57,gears:[0,8,16,25,34],width:1.86,length:4.24},
 corvette:{id:'corvette',label:'CORVETTE',maxSpeed:296/3.6,acceleration:10.8,brake:21,reverse:8,wheelbase:2.69,track:1.60,radius:.32,turn:.46,gears:[0,13,25,39,53,67],width:1.94,length:4.48},
 armored:{id:'armored',label:'BLINDATO',maxSpeed:105/3.6,acceleration:4.7,brake:12,reverse:5,wheelbase:3.2,track:1.96,radius:.43,turn:.48,gears:[0,6,12,19,25],width:2.32,length:5.1,roof:2.1,damageScale:.25},
 tank:{id:'tank',label:'CARRO ARMATO',maxSpeed:86/3.6,acceleration:4.4,brake:13,reverse:4,wheelbase:3.6,track:2.36,radius:.42,turn:.49,gears:[0,5,11,17],width:2.95,length:6.2,roof:2.38,damageScale:.12},
 ferrari:{id:'ferrari',label:'FERRARI SUPERCAR',maxSpeed:350/3.6,acceleration:12.8,brake:24,reverse:9,wheelbase:2.65,track:1.62,radius:.32,turn:.43,gears:[0,13,25,39,53,68,83],width:1.96,length:4.48}
};
export function vehicleGear(car){return car.speed<-.1?'R':Math.abs(car.speed)<.1?'N':car.driveGear??Math.max(1,car.spec.gears.filter(v=>Math.abs(car.speed)>=v).length);}
export function advanceVehicle(car,input,dt,terrain,solidsNear,onCrush=null){
 const s=car.spec;updatePowertrain(car,dt,input.forward||0);let hit=false,impactSpeed=0;
 // Six temporal samples plus <= 0.35 m swept collision samples, including
 // the nose and tail. The broad phase covers the entire swept footprint.
 for(let i=0;i<6;i++){
  const h=dt/6,v=car.speed,previousYaw=car.yaw,forward=[Math.sin(car.yaw),Math.cos(car.yaw)];
  const y0=elevation(terrain,car.x,car.z),y1=elevation(terrain,car.x+forward[0]*1.2,car.z+forward[1]*1.2),grade=(y1-y0)/1.2;
  const throttle=input.forward||0,reversing=v*throttle<0;
  let accel=throttle*(reversing?s.brake:s.acceleration*(car.shiftRemaining>0?(s.id==='ferrari'?.45:.12):1)*(1-.35*Math.min(1,Math.abs(v)/s.maxSpeed)));
  accel-=9.81*Math.max(-.8,Math.min(.8,grade))*.7;
  accel-=v*(throttle?.008:.48);
  car.speed=Math.max(-s.reverse,Math.min(s.maxSpeed,v+accel*h));
  if(input.brake)car.speed=Math.sign(car.speed)*Math.max(0,Math.abs(car.speed)-s.brake*h);
  if(!throttle&&Math.abs(car.speed)<.035)car.speed=0;
  car.steer=input.steer||0;car.slip=(car.slip||0)+((input.handbrake&&Math.abs(car.speed)>3?car.steer*.34:0)-(car.slip||0))*(1-Math.exp(-h*(input.handbrake?3:7)));car.yaw+=car.steer*(car.speed/s.wheelbase)*Math.tan(s.turn)*(input.handbrake?1.9:1)*h/(1+(Math.abs(car.speed)/(s.id==='ferrari'?13:10))**2);
  const delta=[Math.sin(car.yaw-car.slip)*car.speed*h,Math.cos(car.yaw-car.slip)*car.speed*h],old=[car.x,car.z],radius=s.width*.49,reach=s.length/2+Math.hypot(...delta)+radius;
  const nearby=solidsNear(car.x,car.z,reach),offset=(s.length-s.width)/2;
  const crushable=onCrush&&car.speed>=4&&throttle>0
   ?nearby.filter(({vehicle})=>vehicle&&(vehicle.traffic||vehicle.teglieTraffic))
   :[];
  const solids=crushable.length?nearby.filter(solid=>!crushable.includes(solid)):nearby;
  const participants=solids.filter(b=>b.blocksVehicleFootprint);
  const touchesParticipant=(x,z)=>participants.length&&participants.some(b=>processionOverlaps(b,vehicleFootprint({...car,x,z})));
  if(touchesParticipant(old[0]+delta[0],old[1]+delta[1])){impactSpeed=Math.max(impactSpeed,Math.abs(v));car.yaw=previousYaw;car.speed=0;hit=true;continue;}
  let p=resolveCollision(old,delta,radius,solids,terrain);
  for(const end of [-1,1]){const ox=Math.sin(car.yaw)*offset*end,oz=Math.cos(car.yaw)*offset*end,from=[old[0]+ox,old[1]+oz],target=[p[0]+ox,p[1]+oz],q=resolveCollision(from,[target[0]-from[0],target[1]-from[1]],radius,solids,terrain);p=[p[0]+q[0]-target[0],p[1]+q[1]-target[1]];}
  if(touchesParticipant(p[0],p[1])){p=old;impactSpeed=Math.max(impactSpeed,Math.abs(v));car.yaw=previousYaw;car.speed=0;hit=true;}
  const expected=Math.hypot(...delta),actual=Math.hypot(p[0]-old[0],p[1]-old[1]);if(expected>.001&&actual<expected*.6){impactSpeed=Math.max(impactSpeed,Math.abs(v)*Math.min(1,1-actual/expected));car.speed*=Math.exp(-24*h);hit=true;}
  if(actual>.001&&crushable.length){
   const footprint=vehicleFootprint({...car,x:p[0],z:p[1]});
   for(const obstacle of crushable)if(processionOverlaps(obstacle,footprint))onCrush(obstacle.vehicle);
  }
  car.x=p[0];car.z=p[1];
 }
 return {hit,impactSpeed,gear:vehicleGear(car)};
}

export function vehicleFootprint(car){const c=Math.cos(car.yaw),s=Math.sin(car.yaw),ring=[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([x,z])=>[car.x+c*x*car.spec.width/2+s*z*car.spec.length/2,car.z-s*x*car.spec.width/2+c*z*car.spec.length/2]);return {id:'vehicle-'+car.spec.id,rings:[ring],bounds:[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))],roofY:(car.root?.position.y??0)+(car.spec.roof??(car.spec.id==='panda'||car.spec.id==='motocross'?1.7:1.2))};}

export function trafficPathBlocked(car,next,vehicles){
 const {width,length}=car.spec;
 const start=car.root.visible?car:next;
 const dx=next.x-start.x,dz=next.z-start.z;
 const turn=Math.atan2(Math.sin(next.yaw-start.yaw),Math.cos(next.yaw-start.yaw));
 const steps=Math.max(1,Math.ceil((Math.hypot(dx,dz)+Math.abs(turn)*length/2)/.4));
 for(const other of vehicles){
  if(other===car||!other.root.visible||other.destroyed)continue;
  if(Math.hypot(other.x-next.x,other.z-next.z)>(length+other.spec.length)/2+Math.hypot(dx,dz)+1)continue;
  const forward=[Math.sin(other.yaw),Math.cos(other.yaw)],side=[forward[1],-forward[0]];
  for(let i=1;i<=steps;i++){
   const t=i/steps,yaw=start.yaw+turn*t,x=other.x-start.x-dx*t,z=other.z-start.z-dz*t;
   const a=[Math.sin(yaw),Math.cos(yaw)],b=[a[1],-a[0]];
   const radius=(axis,f,s,l,w)=>(Math.abs(axis[0]*f[0]+axis[1]*f[1])*l+Math.abs(axis[0]*s[0]+axis[1]*s[1])*w)/2;
   if([a,b,forward,side].every(axis=>Math.abs(x*axis[0]+z*axis[1])<
     radius(axis,a,b,length,width)+radius(axis,forward,side,other.spec.length,other.spec.width)+.12))return true;
  }
 }
 return false;
}
