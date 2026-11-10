import * as THREE from 'three';
import {makeCar,updateCar} from './actors.js';
import {advanceVehicle,VEHICLES} from './vehicle-physics.js';
import {nearest} from './world-math.js';

export function makeTeglieRace(scene,root,streets,{terrain,height,pointAt,startPoint,actions,status,toast,complete,clear}){
 let track=null,best=Infinity;
 for(const {road,start,end} of streets){
  if(road.width<4.65)continue;
  for(let i=1;i<road.sections.length;i++){
   const a=road.sections[i-1],b=road.sections[i];
   if(a.s<start+4||b.s>end-4)continue;
   const projection=nearest([startPoint.x,startPoint.z],[a.x,a.z],[b.x,b.z]);
   if(projection.d>24)continue;
   const s=a.s+(b.s-a.s)*projection.t;
   const origin=pointAt(road,s);
   for(const direction of [1,-1])for(let length=80;length<=136;length+=8){
    const last=s+direction*length;
    if(last<start+8||last>end-8)break;
    const finish=pointAt(road,last);
    const chord=Math.hypot(finish.x-origin.x,finish.z-origin.z);
    if(chord<length*.96)break;
    let bend=0;
    for(let d=6;d<length;d+=6){
     const p=pointAt(road,s+direction*d);
     bend=Math.max(bend,nearest([p.x,p.z],[origin.x,origin.z],[finish.x,finish.z]).d);
    }
    const score=projection.d*100-length+bend*5;
    if(bend<4.5&&score<best){
     best=score;track={road,s,length,direction,origin:{...origin,yaw:origin.yaw+(direction<0?Math.PI:0)},
      finish:{...finish,yaw:finish.yaw+(direction<0?Math.PI:0)}};
    }
   }
  }
 }
 if(!track)return null;
 const {road,s,length,direction,origin,finish}=track,lane=road.width*.25;
 const opponent=makeCar(scene,'corvette','#ffad24',{convertible:true});
 opponent.root.visible=false;
 opponent.raceOpponent=true;
 const button=document.createElement('button');
 button.type='button';button.textContent='jocat lu librett';button.hidden=true;actions.append(button);
 const lights=document.createElement('div');
 lights.className='teglie-race-countdown';lights.hidden=true;lights.setAttribute('role','status');
 const signal=document.createElement('strong'),instruction=document.createElement('span');
 lights.append(signal,instruction);document.body.append(lights);
 function showSignal(value,hint){
  lights.hidden=false;
  if(signal.textContent!==value)signal.textContent=value;
  if(instruction.textContent!==hint)instruction.textContent=hint;
 }
 const marks=new THREE.Group();
 for(const [index,point] of [origin,finish].entries()){
  for(let i=0;i<8;i++){
   const x=point.x+Math.cos(point.yaw)*road.width*(i-3.5)/8;
   const z=point.z-Math.sin(point.yaw)*road.width*(i-3.5)/8;
   const stripe=new THREE.Mesh(new THREE.BoxGeometry(road.width/8,.025,.22),
    new THREE.MeshBasicMaterial({color:i%2?'#12101c':index?'#fff7d2':'#63e2e9'}));
   stripe.position.set(x,height(x,z)+.043,z);stripe.rotation.y=point.yaw;marks.add(stripe);
  }
 }
 root.add(marks);
 const samples=Array.from({length:Math.ceil(length/2)+1},(_,i)=>pointAt(road,s+direction*Math.min(length,i*2)));
 const opponentPhysics={spec:VEHICLES.ferrari};
 const emptyRoad=()=>[];
 const reactionDelay=.42,pace=1.025,physicsStep=1/90;
 let racer=null,countdown=0,elapsed=0,opponentDistance=0,opponentTime=0,lastPlayer=null,staging=0;
 const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 const pose=(d,side)=>{
  const p=pointAt(road,s+direction*d);
  if(direction<0)p.yaw+=Math.PI;
  p.x+=Math.cos(p.yaw)*side;p.z-=Math.sin(p.yaw)*side;
  return p;
 };
 function cancel(message){
  racer=null;lights.hidden=true;opponent.root.visible=false;opponent.speed=0;
  if(message)toast(message);
 }
 button.onclick=()=>{
  const car=lastPlayer?.vehicle;
  if(button.hidden||!car||racer)return;
  racer=car;staging=.2;button.hidden=true;
  showSignal('Griglia','Rilascia l’acceleratore e aspetta il via');
 };
 function prepareGrid(car){
  const yourLane=pose(0,lane),otherLane=pose(0,-lane);
  if(!clear(yourLane.x,yourLane.z,1.2,car)||!clear(otherLane.x,otherLane.z,1.2,car)){
   cancel('Griglia occupata · Riprova tra poco');return;
  }
  countdown=3;elapsed=opponentDistance=opponentTime=0;
  Object.assign(car,yourLane,{speed:0,steer:0,slip:0,parked:true});
  Object.assign(opponent,otherLane,{speed:0});
  Object.assign(opponentPhysics,otherLane,{speed:0,slip:0,driveGear:1,shiftRemaining:0});
  updateCar(car,terrain,0);updateCar(opponent,terrain,0);
  opponent.root.visible=true;
  showSignal('3','Aspetta VAI prima di accelerare');
 }
 function update(dt,p,available){
  lastPlayer=p;
  const car=p.vehicle;
  button.hidden=!available||!!racer||!car||!car.spec?.width||car.spec.width>road.width/2||gap(p,origin)>12||Math.abs(car.speed)>2;
  if(!racer)return;
  if(p.dead||car!==racer||car.destroyed){cancel('Gara interrotta');return;}
  if(staging>0){
   staging=Math.max(0,staging-dt);
   if(!staging)prepareGrid(car);
   return;
  }
  if(countdown>0){
   if(gap(car,pose(0,lane))>.25||Math.abs(car.speed)>.8){cancel('Falsa partenza · Aspetta il via');return;}
   countdown=Math.max(0,countdown-dt);
   if(countdown>0)showSignal(String(Math.ceil(countdown)),'Aspetta VAI prima di accelerare');
   else showSignal('VAI!','Accelera');
   return;
  }
  const activeDt=Math.max(0,Math.min(dt,elapsed+dt-reactionDelay));
  elapsed+=dt;
  if(elapsed>.65)lights.hidden=true;
  if(activeDt>0){
   opponentTime+=activeDt*pace;
   while(opponentTime>=physicsStep&&opponentDistance<length){
    const startPose=pose(opponentDistance,-lane);
    Object.assign(opponentPhysics,startPose);
    advanceVehicle(opponentPhysics,{forward:1},physicsStep,terrain,emptyRoad);
    opponentDistance+=gap(opponentPhysics,startPose);
    opponentTime-=physicsStep;
   }
   opponent.speed=opponentPhysics.speed*pace;
   Object.assign(opponent,pose(Math.min(length,opponentDistance),-lane));
   updateCar(opponent,terrain,dt);
  }
  let distance=Infinity;
  for(let i=1;i<samples.length;i++){
   const a=samples[i-1],b=samples[i];
   distance=Math.min(distance,nearest([car.x,car.z],[a.x,a.z],[b.x,b.z]).d);
  }
  if(distance>road.width/2+2.5){cancel('Sei uscito dal tracciato');return;}
  const crosses=(car.x-finish.x)*Math.sin(finish.yaw)+(car.z-finish.z)*Math.cos(finish.yaw)>=0;
  if(crosses&&gap(car,finish)<8&&opponentDistance<length){
   const time=elapsed.toFixed(2);cancel();complete('teglieDrag','jocat lu librett');
   toast('Hai battuto la Corvette · '+time+' s');return;
  }
  if(opponentDistance>=length){cancel('La Corvette ha vinto · Puoi riprovare');return;}
  status('jocat lu librett · '+elapsed.toFixed(1)+' s');
 }
 return {opponent,origin,update,cancel,get staging(){return !!racer&&staging>0;},get active(){return !!racer;}};
}
