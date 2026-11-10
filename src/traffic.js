import {playTrafficHorn} from './engine-audio.js';
import {SpatialIndex} from './road-network.js';
import * as THREE from 'three';
import {makeCar,updateCar} from './actors.js';
import {inBuilding} from './world-math.js';
export function makeTraffic(scene,world,network,ready,processionBlocked=()=>false,count=6){
 const mainRoad=r=>/provinciale|\bsp\s*\d|via del sole|via roma/i.test(r.name||'');
 const roads=network.roads.filter(r=>r.length>22&&(r.width||4)>=2.65&&!/scal[ei]|gradini|sentiero|pedonale/i.test(r.name||'')),pool=[];
 const colors=['#b6b3a4','#526b7e','#8d3439','#586a58','#a68e67','#8b8e91'];
 for(const [i,color] of colors.slice(0,count).entries()){
  const car=makeCar(scene,'punto',color),id='traffic-'+i;
  car.spec={...car.spec,id};
  const rambo=makeCar(scene,'rambo'),compact=new THREE.Group();
  compact.add(...car.body.children.slice());
  car.body.add(compact,rambo.body);
  car.root.add(...rambo.wheels);
  scene.remove(rambo.root);
  car.variants=[
   {body:compact,wheels:car.wheels,brakeMat:car.brakeMat,spec:car.spec},
   {body:rambo.body,wheels:rambo.wheels,brakeMat:rambo.brakeMat,spec:{...rambo.spec,id}},
  ];
  rambo.body.visible=false;
  for(const wheel of rambo.wheels)wheel.visible=false;
  car.root.visible=false;
  pool.push(Object.assign(car,{traffic:true,local:i<2,spawnDelay:0,stalled:0,autonomous:true,slip:0,road:null,s:0,direction:i%2?1:-1,cruise:i<2?3.6+i*.45:5+(i-2)*.48}));
 }
 function point(car,s){const r=car.road;let i=1;while(i<r.sections.length-1&&r.sections[i].s<s)i++;const a=r.sections[i-1],b=r.sections[i],t=Math.max(0,Math.min(1,(s-a.s)/(b.s-a.s||1))),dx=(b.x-a.x)*car.direction,dz=(b.z-a.z)*car.direction,len=Math.hypot(dx,dz)||1;const lane=Math.max(0,Math.min(.95,(r.width||4)*.5-1.02));return {x:a.x+(b.x-a.x)*t-dz/len*lane,z:a.z+(b.z-a.z)*t+dx/len*lane,yaw:Math.atan2(dx,dz)};}
 const spots=new SpatialIndex(32),buildings=new SpatialIndex(24);
 for(const b of world.buildings)buildings.insert(b,b.bounds);
 const inBuildingAt=p=>buildings.point(p.x,p.z).some(b=>inBuilding([p.x,p.z],b));
 for(const road of roads)for(let s=5;s<road.length-5;s+=13){const p=point({road,direction:1},s);spots.insert({road,s,...p,main:mainRoad(road)},[p.x,p.z,p.x,p.z]);}
 function spawn(car,player){
  const radius=car.local?74:155,target=car.local?36:87,candidates=[];
  for(const spot of spots.box([player.x-radius,player.z-radius,player.x+radius,player.z+radius])){
   const d=Math.hypot(spot.x-player.x,spot.z-player.z);if(d<(car.local?20:34)||d>radius)continue;
   if(pool.some(c=>c!==car&&c.root.visible&&c.road===spot.road&&Math.abs(c.s-spot.s)<30))continue;
   const score=Math.abs(d-target)+(spot.main===car.local?32:0);
   candidates.push({spot,score});
  }
  const [compact,offroad]=car.variants;
  for(const {spot} of candidates.sort((a,b)=>a.score-b.score)){
   const a=point({road:spot.road,direction:1},spot.s+4),b=point({road:spot.road,direction:-1},spot.s-4);
   const direction=Math.hypot(a.x-player.x,a.z-player.z)<Math.hypot(b.x-player.x,b.z-player.z)?1:-1;
   const p=point({road:spot.road,direction},spot.s);
   if(!ready(p.x,p.z)||!network.pavementAt(p.x,p.z)||inBuildingAt(p)||processionBlocked({...p,spec:compact.spec})||pool.some(c=>c!==car&&c.root.visible&&Math.hypot(c.x-p.x,c.z-p.z)<12))continue;
   const rambo=(spot.road.width||4)>=3.1&&Math.random()<.15&&!processionBlocked({...p,spec:offroad.spec});
   setVariant(car,Number(rambo));
   Object.assign(car,p,{road:spot.road,s:spot.s,direction});return true;
  }
  return false;
 }
 function setVariant(car,index){
  const variant=car.variants[index];
  for(const model of car.variants){
   model.body.visible=model===variant;
   for(const wheel of model.wheels)wheel.visible=model===variant;
  }
  Object.assign(car,{spec:variant.spec,wheels:variant.wheels,brakeMat:variant.brakeMat});
  car.root.name=variant.spec.label;
 }
 function reroute(car){
  car.root.visible=false;car.road=null;car.speed=0;car.stalled=0;car.spawnDelay=3;
 }
 return {vehicles:pool,setVariant,reset(){for(const car of pool){reroute(car);car.spawnDelay=0;}},take(car){car.autonomous=false;car.speed=0;car.parked=false;},update(dt,player){for(const car of pool){if(!car.autonomous||car.destroyed)continue;
 if(car.root.visible&&processionBlocked(car)){reroute(car);continue;}
 car.speed=car.cruise;
 if(!car.road||Math.hypot(car.x-player.x,car.z-player.z)>(car.local?126:210)){
  car.root.visible=false;car.road=null;car.stalled=0;car.spawnDelay-=dt;if(car.spawnDelay>0)continue;car.spawnDelay=.8;
  if(!spawn(car,player))continue;
 }
 if(car.stalled<5&&car.stalled+dt>=5&&Math.random()<.62)playTrafficHorn(Math.hypot(car.x-player.x,car.z-player.z));
 car.stalled+=dt;
 if(car.stalled>=14){reroute(car);continue;}
 const next=car.s+car.direction*car.speed*dt;if(next<2||next>car.road.length-2){const end=car.road.sections[car.direction>0?car.road.sections.length-1:0];let link=null;for(const r of roads){if(r===car.road)continue;for(const direction of [1,-1]){const p=r.sections[direction>0?0:r.sections.length-1];if(Math.hypot(p.x-end.x,p.z-end.z)<1.5){link={r,direction};break;}}if(link)break;}if(link){car.road=link.r;car.direction=link.direction;car.s=link.direction>0?2:link.r.length-2;}else{car.direction*=-1;car.s=Math.max(2,Math.min(car.road.length-2,car.s));}continue;}
 const p=point(car,next),blocked=Math.hypot(p.x-player.x,p.z-player.z)<6||pool.some(c=>c!==car&&c.root.visible&&Math.hypot(p.x-c.x,p.z-c.z)<4);if(blocked||processionBlocked({...p,spec:car.spec})||!ready(p.x,p.z)||!network.pavementAt(p.x,p.z)||inBuildingAt(p))continue;
 car.stalled=0;car.s=next;Object.assign(car,p);car.root.visible=true;updateCar(car,world.terrain,dt);
 }} };
}
