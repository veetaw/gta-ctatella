import {makePoliceEscort} from './actors.js';
import {makePatrolOfficer} from './procession-people.js';
import {roadRoute} from './procession-route.js';
import {vehicleFootprint} from './vehicle-physics.js';
import {updatePatrolSiren} from './engine-audio.js';
import {resolveCollision} from './world-math.js';

const MAX_LEVEL=3;
const RAID_IMMUNITY_MS=30_000;
const ARREST_REACH=.8,ARREST_CONTACT_SECONDS=.65;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function makeWanted(scene,{network,terrain,station,ready,height,player,clear,solidsNear,blocked,lineClear,toast,onArrest,onRelease}){
 const indicator=document.createElement('output'),screen=document.createElement('section');
 indicator.className='wanted-level';indicator.hidden=true;
 screen.className='wanted-arrest';screen.hidden=true;screen.innerHTML="<strong>T’hann nghius</strong>";
 document.body.append(indicator,screen);
 const units=Array.from({length:MAX_LEVEL},(_,index)=>({
  cruiser:makePoliceEscort(scene,index),officer:makePatrolOfficer(scene,index),
  dispatch:0,route:null,progress:0,destination:null,replan:0,contactTime:0,
 }));
 let raidImmunityUntil=0;
 let level=0,elapsed=0,lastSeen=0,nextEscalation=0,arrestTime=0,releasing=false,seenPatrol=false;
 function display(){
  indicator.hidden=!level;indicator.textContent='★'.repeat(level)+'☆'.repeat(MAX_LEVEL-level);
  indicator.setAttribute('aria-label',`Ricercato: ${level} stelle su ${MAX_LEVEL}`);
 }
 function clearPursuit(){
  if(!level)return;
  level=0;nextEscalation=0;seenPatrol=false;updatePatrolSiren(Infinity);
  for(const unit of units){
   unit.cruiser.update(null);unit.officer.root.visible=false;unit.route=null;unit.dispatch=0;unit.contactTime=0;
  }
  display();
 }
 function shot(){
  if(arrestTime>0||releasing||performance.now()<raidImmunityUntil)return;
  lastSeen=elapsed;
  if(level)return;
  level=1;units[0].dispatch=2.6;nextEscalation=elapsed+1;display();
  toast('Ricercato · I Carabinieri stanno arrivando.');
 }
 function hit(vehicle){
  if(!units.some(unit=>unit.cruiser.vehicle===vehicle))return false;
  shot();
  if(level>0&&level<MAX_LEVEL&&elapsed>=nextEscalation){
   units[level].dispatch=2.2;level++;nextEscalation=elapsed+2;display();
   toast('Carabinieri colpiti · Arrivano rinforzi.');
  }
  return true;
 }
 function plan(unit,from,target){
  try{
   const route=roadRoute(network,from,target);
   unit.route=route;unit.progress=0;unit.destination={x:target.x,z:target.z};return true;
  }catch{return false;}
 }
 function moveCruiser(unit,p,dt){
  const car=unit.cruiser.vehicle;
  if(ready(p.x,p.z))unit.cruiser.update(p,terrain,dt,elapsed);
  else{Object.assign(car,p);car.root.visible=false;}
 }
 function spawn(unit,target,index){
  if(blocked(station.x,station.z)||!plan(unit,station,target))return false;
  unit.replan=elapsed+2+index*.4;
  moveCruiser(unit,unit.route.at(0),0);
  return true;
 }
 function stepOut(unit){
  const car=unit.cruiser.vehicle,root=unit.officer.root;
  for(const side of [-1,1]){
   const x=car.x+Math.cos(car.yaw)*1.25*side,z=car.z-Math.sin(car.yaw)*1.25*side;
   if(!ready(x,z)||!clear(x,z,.32))continue;
   root.position.set(x,height(x,z),z);root.visible=true;unit.contactTime=0;car.speed=0;return;
  }
 }
 function chase(unit,target,dt,index){
  const car=unit.cruiser.vehicle,{root,legs}=unit.officer;
  if(!unit.route){
   unit.dispatch-=dt;
   if(unit.dispatch<=0&&!spawn(unit,target,index))unit.dispatch=1.1;
   return false;
  }
  if(blocked(car.x,car.z)){unit.contactTime=0;return false;}
  if(root.visible){
   const d=distance(target,root.position);
   const withinReach=target.onFoot&&d<ARREST_REACH&&
    Math.abs(target.y-(root.position.y+1.25))<1&&lineClear(root.position,target,car);
   unit.contactTime=withinReach?unit.contactTime+dt:0;
   if(unit.contactTime>=ARREST_CONTACT_SECONDS)return true;
   if(d>28){root.visible=false;unit.replan=0;return false;}
   const step=Math.min(d,dt*(level===3?5.8:4.6));
   if(d>0){
    const x=root.position.x,z=root.position.z;
    const next=resolveCollision([x,z],[(target.x-x)*step/d,(target.z-z)*step/d],.3,solidsNear(x,z,2),terrain);
    if(ready(...next)){root.rotation.y=Math.atan2(target.x-x,target.z-z);root.position.set(next[0],height(...next),next[1]);}
   }
   legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(elapsed*12+i*Math.PI)*.44;});
   return false;
  }
  if(elapsed>=unit.replan&&(!unit.route||distance(target,unit.destination)>13)){
   plan(unit,car,target);unit.replan=elapsed+2.2+index*.4;
  }
  const route=unit.route;
  if(!route)return false;
  if(distance(car,target)<7||unit.progress>=route.length-2){if(ready(car.x,car.z))stepOut(unit);return false;}
  const speed=target.onFoot?11:15+level*2;
  const next=Math.min(route.length,unit.progress+speed*dt),p=route.at(next);
  if(blocked(p.x,p.z))return false;
  car.speed=speed;unit.progress=next;moveCruiser(unit,p,dt);
  return false;
 }
 function arrest(){
  clearPursuit();arrestTime=1.35;screen.hidden=false;onArrest();
 }
 return {
  shot,hit,clear:clearPursuit,
  grantRaidImmunity(){
   raidImmunityUntil=performance.now()+RAID_IMMUNITY_MS;
   clearPursuit();
  },
  get arrested(){return arrestTime>0||releasing;},
  update(dt){
   elapsed+=dt;
   if(arrestTime>0){
    arrestTime=Math.max(0,arrestTime-dt);
    if(arrestTime<=0){releasing=true;Promise.resolve().then(onRelease).catch(()=>{}).finally(()=>{screen.hidden=true;releasing=false;});}
    return;
   }
   const target=player();
   if(!level||target.dead)return;
   let sirenDistance=Infinity;
   for(let i=0;i<level;i++){
    const unit=units[i];
    if(chase(unit,target,dt,i)){arrest();return;}
    if(unit.route){
     const d=distance(unit.cruiser.vehicle,target);
     if(!unit.officer.root.visible)sirenDistance=Math.min(sirenDistance,d);
     if(d<31||!seenPatrol&&d<70){seenPatrol=true;lastSeen=elapsed;}
    }
   }
   updatePatrolSiren(sirenDistance);
   if(elapsed-lastSeen>(seenPatrol?24:125)){clearPursuit();toast('Hai seminato i Carabinieri.');}
  },
  colliders(x,z,r,includeOfficers=false){
   const bodies=[];
   for(const {cruiser,officer} of units){
    const vehicle=cruiser.vehicle;
    if(vehicle.root.visible&&distance(vehicle,{x,z})<r+3)bodies.push({...vehicleFootprint(vehicle),vehicle});
    if(includeOfficers&&officer.root.visible&&distance(officer.root.position,{x,z})<r+1){
     const p=officer.root.position;
     bodies.push({...vehicleFootprint({x:p.x,z:p.z,yaw:0,spec:{id:vehicle.spec.id+'-officer',width:.58,length:.50}}),roofY:p.y+1.8,vehicle});
    }
   }
   return bodies;
  },
 };
}
