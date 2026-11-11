import * as THREE from 'three';
import {makeCar,updateCar} from './actors.js';
import {makePatrolOfficer} from './procession-people.js';
import {trafficPathBlocked} from './vehicle-physics.js';
import {makeTeglieRace} from './teglie-race.js';
import {worldLocation} from './game-locations.js';
import {nearest,resolveCollision} from './world-math.js';
import {traceCover} from './combat-geometry.js';
import {playGunSound,updateTeglieEngine} from './engine-audio.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const pointAt=(road,s)=>{
 let low=0,high=road.sections.length-1;
 while(high-low>1){const mid=(low+high)>>1;if(road.sections[mid].s<=s)low=mid;else high=mid;}
 const a=road.sections[low],b=road.sections[high],t=(s-a.s)/(b.s-a.s||1);
 return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:Math.atan2(b.x-a.x,b.z-a.z)};
};

export function makeTeglieDistrict(scene,zone,{terrain,player,solidsNear,damage,actions,adult,toast,vehicles,clear:clearSpace=()=>true,refill=()=>{},complete=()=>{}}){
 const root=new THREE.Group();scene.add(root);
 root.visible=false;
 const button=document.createElement('button');
 button.type='button';button.textContent='Identificati';button.hidden=true;actions.append(button);
 const day={background:scene.background,fog:scene.fog,lights:scene.children.filter(o=>o.isDirectionalLight||o.isHemisphereLight).map(light=>[light,light.intensity,light.color.clone(),light.groundColor?.clone()]),sky:scene.children.find(o=>o.isSky)};
 const moonlight=new THREE.Color('#a5b9ff'),night=new THREE.Color('#202d47'),fog=new THREE.Fog('#303f59',100,360);
 let active=false,identified=false,warning=0,alert=false,clock=0;

 const streets=zone.roads.flatMap(road=>{
  const ranges=[];let start=null,last=null;
  for(const point of road.sections){
   if(zone.contains(point.x,point.z)){start??=point.s;last=point.s;}
   else if(start!==null){if(last-start>=24)ranges.push({road,start,end:last});start=null;}
  }
  if(start!==null&&last-start>=24)ranges.push({road,start,end:last});
  return ranges;
 }).sort((a,b)=>(b.end-b.start)-(a.end-a.start));
 const patrols=[],robbers=[],reinforcements=[],cars=[],lamps=[];
 const allVehicles=vehicles??(()=>cars),dayReflections=new Map();
 const gate=zone.gate||zone.center;
 function nearPoint(point){
  return streets.flatMap(range=>range.road.sections.filter(p=>p.s>=range.start&&p.s<=range.end)
   .map(p=>({range,p,d:distance(p,point)}))).sort((a,b)=>a.d-b.d)[0];
 }
 const entrance=nearPoint(gate),village=nearPoint(zone.center);
 if(!streets.length)return {vehicles:cars,update(){},clear(){},take(){},targets:()=>[]};
 const bulbShape=new THREE.BoxGeometry(.2,.025,.32);
 const glowSize=64,canvas=document.createElement('canvas');
 canvas.width=canvas.height=glowSize;
 const context=canvas.getContext('2d'),radial=context.createRadialGradient(32,32,0,32,32,32);
 radial.addColorStop(0,'rgba(255,215,142,.44)');
 radial.addColorStop(.45,'rgba(255,199,106,.20)');
 radial.addColorStop(1,'rgba(255,199,106,0)');
 context.fillStyle=radial;context.fillRect(0,0,64,64);
 const glowTexture=new THREE.CanvasTexture(canvas);
 glowTexture.colorSpace=THREE.SRGBColorSpace;
 const poolMaterial=new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,blending:THREE.AdditiveBlending});
 const bulbMaterial=new THREE.MeshBasicMaterial({color:'#ffe8bb'});
 for(const {x,z,y,nx,nz,height} of zone.nightLamps){
  const p={x:x+nx*3,z:z+nz*3};
  const ground=new THREE.PlaneGeometry(12,12,6,6);ground.rotateX(-Math.PI/2);
  const vertices=ground.attributes.position;
  for(let i=0;i<vertices.count;i++){
   const px=vertices.getX(i)+p.x,pz=vertices.getZ(i)+p.z;
   vertices.setXYZ(i,px,zone.height(px,pz)+.08,pz);
  }
  const pool=new THREE.Mesh(ground,poolMaterial);root.add(pool);
  const bulb=new THREE.Mesh(bulbShape,bulbMaterial);
  bulb.position.set(x+nx*.64,y+height-.232,z+nz*.64);
  bulb.rotation.y=Math.atan2(nx,nz);root.add(bulb);
  lamps.push({x,z,bulb,pool,seed:lamps.length*2.713});
 }

 const gunMat=new THREE.MeshLambertMaterial({color:'#20262d'});
 const receiver=new THREE.BoxGeometry(.12,.12,.66),barrel=new THREE.BoxGeometry(.055,.055,.57);
 const banner=document.createElement('div');
 banner.className='teglie-mission-status';banner.hidden=true;banner.setAttribute('role','status');document.body.append(banner);
 const status=message=>{banner.hidden=false;if(banner.textContent!==message)banner.textContent=message;};
 const raceStart=zone.network?.world?.origin
  ?worldLocation(zone.network.world.origin,{lat:40.671095,lon:15.348095}):zone.center;
 const race=makeTeglieRace(scene,root,streets,{terrain,height:zone.height,pointAt,startPoint:raceStart,actions,status,toast,complete,clear:clearSpace});
 const battleButton=document.createElement('button');
 battleButton.type='button';battleButton.textContent='spara a i mariuol a la teglia';battleButton.hidden=true;actions.append(battleButton);
 const battleSpot=village.p;
 let battle=false,reinforcementWave=0,nextWave=0,reinforcementFire=0;
 function arm(figure){
  const rifle=new THREE.Group(),body=new THREE.Mesh(receiver,gunMat),tube=new THREE.Mesh(barrel,gunMat);
  tube.position.z=.47;rifle.add(body,tube);rifle.position.set(.23,.97,.31);figure.root.add(rifle);
 }
 function hit(actor,amount){
  if(!actor.active)return;
  actor.hp-=amount;
  if(actor.hp<=0){actor.active=false;actor.root.visible=false;}
  if(actor.militia){
   identified=false;warning=0;alert=true;
   if(!reinforcementWave&&!nextWave){nextWave=1.6;toast('La milizia chiama rinforzi');}
   if(battle){endBattle();toast('Missione fallita · Hai colpito la milizia');}
  }
 }
 const count=adult?14:10;
 for(let i=0;i<count;i++){
  const placement=i<3?entrance:i<6?village:null;
  const range=placement?{
   ...placement.range,start:Math.max(placement.range.start,placement.p.s-12),
   end:Math.min(placement.range.end,placement.p.s+26),
  }:streets[i%Math.min(streets.length,8)];
  const officer=makePatrolOfficer(root,i,{cowboy:true});
  if(adult)arm(officer);
  const p=pointAt(range.road,range.start+(range.end-range.start)*((i*.381+.13)%1));
  const guard={...officer,...range,seed:i*1.87,x:p.x,z:p.z,cooldown:0,militia:true,hp:80,active:true};
  guard.hit=amount=>hit(guard,amount);
  patrols.push(guard);
 }
 if(adult)for(let i=0;i<5;i++){
  const figure=makePatrolOfficer(root,i+17);
  arm(figure);
  const robber={...figure,hp:80,active:false,cooldown:0};
  robber.hit=amount=>hit(robber,amount);
  robbers.push(robber);
 }
 if(adult)for(let i=0;i<18;i++){
  const figure=makePatrolOfficer(root,i+31,{cowboy:true});
  arm(figure);
  const guard={...figure,active:false,militia:true,seed:i*.93};
  guard.hit=amount=>hit(guard,amount);
  reinforcements.push(guard);
 }
 const roadsideSpawns=adult?streets.flatMap(({road,start,end})=>{
  const spots=[];
  for(let s=start+3;s<end;s+=13){
   const point=pointAt(road,s);
   for(const side of [-1,1]){
    const offset=side*(road.width/2+.55);
    const x=point.x+Math.cos(point.yaw)*offset,z=point.z-Math.sin(point.yaw)*offset;
    if(zone.contains(x,z))spots.push({x,z,y:zone.height(x,z),yaw:point.yaw});
   }
  }
  return spots;
 }):[];
 function spawnWave(p){
  const available=reinforcements.filter(guard=>!guard.active);
  if(!available.length)return false;
  const occupied=reinforcements.filter(guard=>guard.active);
  const slots=[];
  function pick(spots,count,balcony){
   const min=balcony?16:32,max=balcony?78:105;
   const nearby=spots.map(spot=>({spot,d:distance(p,spot)}))
    .filter(({d})=>d>=min&&d<=max).sort((a,b)=>a.d-b.d);
   for(const {spot} of nearby){
    if(count<=0||slots.length>=available.length)break;
    if([...occupied,...slots].some(other=>distance(spot,other)<(balcony?3:5)))continue;
    if(balcony?!seesPlayer(spot,p):!clearSpace(spot.x,spot.z,.38))continue;
    slots.push({...spot,balcony});count--;
   }
  }
  pick(zone.balconies??[],Math.min(3,reinforcementWave+1),true);
  pick(roadsideSpawns,5+Math.min(3,reinforcementWave),false);
  for(const [i,spot] of slots.entries()){
   const guard=available[i];
   Object.assign(guard,spot,{hp:75,active:true,cooldown:1.4+i*.25});
   guard.root.position.set(guard.x,guard.y,guard.z);
   guard.root.rotation.y=guard.yaw;guard.root.visible=true;
  }
  if(!slots.length)return false;
  reinforcementWave++;
  toast('Rinforzi della milizia · Ondata '+reinforcementWave);
  return true;
 }
 function updateReinforcements(dt,p){
  if(!reinforcementWave&&!nextWave)return;
  nextWave-=dt;
  if(nextWave<=0)nextWave=spawnWave(p)?10:2;
  reinforcementFire=Math.max(0,reinforcementFire-dt);
  for(const guard of reinforcements){
   if(!guard.active)continue;
   const d=distance(p,guard);
   if(d>135){guard.active=false;guard.root.visible=false;continue;}
   guard.cooldown=Math.max(0,guard.cooldown-dt);
   const yaw=Math.atan2(p.x-guard.x,p.z-guard.z);
   guard.root.rotation.y=yaw;
   const range=guard.balcony?65:36;
   const sight=d<=range&&seesPlayer(guard,p);
   const moving=!guard.balcony&&d>8&&(d>22||!sight);
   if(moving){
    const step=dt*3.1;
    const next=resolveCollision([guard.x,guard.z],[Math.sin(yaw)*step,Math.cos(yaw)*step],.33,solidsNear(guard.x,guard.z,2),terrain);
    if(zone.contains(...next)){
     [guard.x,guard.z]=next;guard.y=zone.height(guard.x,guard.z);
     guard.root.position.set(guard.x,guard.y,guard.z);
    }
   }
   guard.legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(clock*10+guard.seed+i*Math.PI)*.45:0);
   if(!sight||guard.cooldown||reinforcementFire>0||p.dead)continue;
   guard.cooldown=2.4;reinforcementFire=.8;
   fire(guard,p,d);hurtPlayer(p,6);
  }
 }
 function endBattle(){
  battle=false;
  for(const robber of robbers){robber.active=false;robber.root.visible=false;}
 }
 battleButton.onclick=()=>{
  const p=player();
  if(battleButton.hidden||!active||!p.onFoot||alert||race?.active)return;
  const {road,start,end}=village.range,anchor=village.p.s,direction=end-anchor>=anchor-start?1:-1;
  const slots=[];
  for(let d=14;d<46&&slots.length<robbers.length;d+=4){
   const s=anchor+direction*d;
   if(s<start||s>end)break;
   const q=pointAt(road,s);
   for(const side of [-1,1]){
    const x=q.x+Math.cos(q.yaw)*side*1.1,z=q.z-Math.sin(q.yaw)*side*1.1;
    if(clearSpace(x,z,.42)&&distance({x,z},p)>8&&slots.length<robbers.length)slots.push({x,z});
   }
  }
  if(slots.length<3){toast('Zona occupata · Riprova tra poco');return;}
  battle=true;identified=true;warning=0;refill();battleButton.hidden=true;
  for(const [i,slot] of slots.entries()){
   const robber=robbers[i];
   Object.assign(robber,slot,{y:zone.height(slot.x,slot.z),hp:85,active:true,cooldown:2+i*.65});
   robber.root.position.set(robber.x,robber.y,robber.z);robber.root.visible=true;
  }
  toast('spara a i mariuol a la teglia');
 };
 const trafficStreets=streets.filter(({start,end})=>end-start>=80);
 const routes=trafficStreets.length?trafficStreets:streets;
 const trafficSpots=streets.flatMap(range=>{
  const spots=[];
  for(let s=range.start+5;s<range.end-5;s+=10)spots.push({range,s,...pointAt(range.road,s)});
  return spots;
 });
 function trafficPose(road,s,direction){
  const pose=pointAt(road,s),lane=Math.max(0,Math.min(1.14,road.width/2-1.15));
  pose.x-=Math.cos(pose.yaw)*direction*lane;
  pose.z+=Math.sin(pose.yaw)*direction*lane;
  if(direction<0)pose.yaw+=Math.PI;
  return pose;
 }
 const trafficClearance=p=>Math.max(28,Math.abs(p.vehicle?.speed??0)*2.2+12);
 function spawnTraffic(car,p){
  const clearance=trafficClearance(p);
  const spots=trafficSpots.map(spot=>({spot,d:distance(spot,p)}))
   .filter(({d})=>d>=clearance&&d<=Math.max(112,clearance+42))
   .sort((a,b)=>Math.abs(a.d-clearance-14)-Math.abs(b.d-clearance-14));
  for(const {spot} of spots){
   const ahead=(p.x-spot.x)*Math.sin(spot.yaw)+(p.z-spot.z)*Math.cos(spot.yaw);
   const direction=(ahead>=0?1:-1)*(p.vehicle&&Math.abs(p.vehicle.speed)>12?-1:1);
   const pose=trafficPose(spot.range.road,spot.s,direction);
   if(!zone.contains(pose.x,pose.z)||distance(pose,p)<clearance||
    trafficPathBlocked(car,pose,allVehicles())||!clearSpace(pose.x,pose.z,car.spec.width/2,car))continue;
   Object.assign(car,spot.range,pose,{s:spot.s,direction,speed:car.cruise,stalled:0});
   car.root.visible=true;updateCar(car,terrain,0);return;
  }
 }
 for(let i=0;i<3;i++){
  const range=routes[i%routes.length];
  const model=i<2?'corvette':'ferrari';
  const car=makeCar(scene,model,['#ffc640','#f1a619','#e93226'][i],{convertible:model==='corvette'});
  car.root.name='Teglie · '+(model==='corvette'?'Corvette dorata':'Ferrari');
  car.root.visible=false;
  const neon=new THREE.Group();
  const glow=new THREE.MeshBasicMaterial({color:i%2?'#fa52ff':'#53edff'});
  for(const side of [-1,1]){
   const strip=new THREE.Mesh(new THREE.BoxGeometry(.06,.035,3.38),glow);
   strip.position.set(side*.82,-.11,0);neon.add(strip);
  }
  const spill=new THREE.Mesh(new THREE.PlaneGeometry(2.55,3.9),new THREE.MeshBasicMaterial({color:glow.color,transparent:true,opacity:.21,depthWrite:false,blending:THREE.AdditiveBlending}));
  spill.rotation.x=-Math.PI/2;spill.position.y=-.24;neon.add(spill);car.root.add(neon);
  Object.assign(car,{...range,neon,teglieTraffic:true,autonomous:true,direction:1,s:range.start+(range.end-range.start)*(.22+i*.18),cruise:23+i*1.8,stalled:0,spawnDelay:i*.55});
  Object.assign(car,pointAt(car.road,car.s));updateCar(car,terrain,0);
  cars.push(car);
 }
 const beamGeometry=new THREE.BufferGeometry();
 const beamPoints=new Float32Array(6);
 beamGeometry.setAttribute('position',new THREE.BufferAttribute(beamPoints,3));
 const beam=new THREE.Line(beamGeometry,new THREE.LineBasicMaterial({color:'#ffb369',transparent:true,opacity:.85}));
 beam.frustumCulled=false;beam.visible=false;root.add(beam);
 let flash=0;

 function setNight(on){
  active=on;root.visible=on;
  scene.background=on?night:day.background;scene.fog=on?fog:day.fog;
  if(day.sky)day.sky.visible=!on;
  for(const [light,intensity,color,groundColor] of day.lights){
   light.intensity=on?intensity*(light.isDirectionalLight?.19:.64):intensity;
   light.color.copy(on?moonlight:color);
   if(groundColor)light.groundColor.copy(on?moonlight:groundColor);
  }

  if(on){
   for(const vehicle of allVehicles())vehicle.root.traverse(object=>{
    const materials=Array.isArray(object.material)?object.material:[object.material];
    for(const material of materials){
     if(!material?.envMap||dayReflections.has(material))continue;
     dayReflections.set(material,material.envMapIntensity);
     material.envMapIntensity*=.35;
    }
   });
  }else{
   for(const [material,intensity] of dayReflections)material.envMapIntensity=intensity;
   dayReflections.clear();
  }

 }
 function clear(){
  identified=alert=false;warning=0;flash=0;beam.visible=false;button.hidden=true;
  endBattle();race?.cancel();battleButton.hidden=true;banner.hidden=true;
  reinforcementWave=nextWave=reinforcementFire=0;
  for(const guard of reinforcements){guard.active=false;guard.root.visible=false;}
  for(const guard of patrols){guard.active=true;guard.hp=80;guard.cooldown=0;}
 }
 button.onclick=()=>{
  if(!active||!warning||alert)return;
  identified=true;warning=0;button.hidden=true;
  toast('Identità confermata · Puoi passare');
 };

 function moveCars(dt,p,trafficEnabled){
  let loudest=null,range=Infinity;
  for(const car of cars){
   if(car.autonomous&&(!active||!trafficEnabled)){
    car.root.visible=false;car.speed=0;car.stalled=0;car.spawnDelay=cars.indexOf(car)*.55;
    continue;
   }
   if(car.destroyed)continue;
   if(!car.autonomous){
    car.neon.visible=zone.contains(car.x,car.z);
   }else if(!car.root.visible){
    car.spawnDelay-=dt;
    if(car.spawnDelay<=0){spawnTraffic(car,p);car.spawnDelay=.8;}
   }else if(distance(car,p)>Math.max(155,trafficClearance(p)+60)){
    car.root.visible=false;car.speed=0;car.spawnDelay=.5;
   }else{
    const proposed=car.s+car.direction*car.cruise*dt;
    const next=THREE.MathUtils.clamp(proposed,car.start,car.end);
    const direction=next===car.s&&next!==proposed?-car.direction:car.direction;
    const q=trafficPose(car.road,next,direction);
    if((p.onFoot&&distance(q,p)<4)||trafficPathBlocked(car,q,allVehicles())){
     car.speed=0;
     car.stalled+=dt;
     if(car.stalled>9&&distance(car,p)>60){
      car.root.visible=false;
      car.spawnDelay=.5;
      car.stalled=0;
     }
    }else{
     Object.assign(car,q,{s:next,direction,speed:direction===car.direction?car.cruise:0,stalled:0});
     car.root.visible=true;
     updateCar(car,terrain,dt);
    }
   }
   if(active&&car.autonomous&&car.root.visible&&car.speed>2){
    const d=distance(p,car);
    if(d<range){loudest=car;range=d;}
   }
  }
  updateTeglieEngine(loudest?range:Infinity,loudest?.speed||0);
 }

 function update(dt,trafficEnabled=true){
  const p=player(),inZone=!p.dead&&zone.contains(p.x,p.z);
  if(inZone!==active){setNight(inZone);clear();if(inZone)toast('Teglie · Zona notturna');}
  banner.hidden=true;
  race?.update(dt,p,active&&!battle&&!alert);
  moveCars(dt,p,trafficEnabled&&!race?.active);
  if(!active)return;
  battleButton.hidden=!adult||battle||!!race?.active||alert||!p.onFoot||distance(p,battleSpot)>28||
   !patrols.some(guard=>guard.active&&distance(p,guard)<45);
  if(battle&&distance(p,battleSpot)>90){endBattle();toast('Hai lasciato la zona della missione');}
  clock+=dt;flash=Math.max(0,flash-dt);beam.visible=flash>0;
  for(const lamp of lamps){
   const phase=(clock+lamp.seed)%6.4;
   lamp.bulb.visible=phase>.7||(phase>.21&&phase<.43);
   lamp.pool.visible=lamp.bulb.visible&&distance(p,lamp)<105;
  }
  updateReinforcements(dt,p);
  let nearest=Infinity,shots=0;
  for(const guard of patrols){
   if(!guard.active)continue;
   const duration=(guard.end-guard.start)/1.05,phase=(clock+guard.seed*12)%(duration*2);
   const s=guard.start+(phase<duration?phase:2*duration-phase)*1.05;
   const q=pointAt(guard.road,s);
   const yaw=q.yaw+(phase>=duration?Math.PI:0);
   const side=guard.road.width*.5+.45;
   const x=q.x+Math.cos(q.yaw)*side,z=q.z-Math.sin(q.yaw)*side,y=zone.height(x,z);
   if(!zone.contains(x,z)){guard.root.visible=false;continue;}
   Object.assign(guard,{x,y,z});
   guard.root.position.set(x,y,z);
   const d=distance(p,{x,z});guard.root.visible=d<115;
   nearest=Math.min(nearest,d);
   guard.root.rotation.y=alert&&d<38?Math.atan2(p.x-x,p.z-z):yaw;
   guard.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(clock*7+i*Math.PI+guard.seed)*.3);
   guard.cooldown=Math.max(0,guard.cooldown-dt);
   if(!adult||guard.cooldown||shots>=2)continue;
   if(battle){
    const target=robbers.find(robber=>robber.active&&distance(guard,robber)<45&&clearShot(guard,robber));
    if(target){
     guard.root.rotation.y=Math.atan2(target.x-x,target.z-z);
     fire(guard,{x:target.x,y:target.y+1.26,z:target.z},d);
     guard.cooldown=3.8;shots++;target.hit(9);
    }
   }else if(alert&&d<36){
    const from={x,y:y+1.26,z},cover=traceCover(from,p,solidsNear,zone.height);
    if(cover.fraction<.995&&(!p.vehicle||cover.solid?.vehicle!==p.vehicle))continue;
    guard.cooldown=2.8+Math.random()*2;shots++;fire(guard,p,d);hurtPlayer(p,8);
   }
  }
  if(battle){
   const alive=robbers.filter(robber=>robber.active);
   if(!alive.length){endBattle();complete('teglieMilitia','spara a i mariuol a la teglia',18000,100);}
   else{
    status('spara a i mariuol a la teglia · '+alive.length+' rimasti');
    for(const robber of alive){
     robber.cooldown=Math.max(0,robber.cooldown-dt);
     const d=distance(p,robber);
     robber.root.rotation.y=Math.atan2(p.x-robber.x,p.z-robber.z);
     if(robber.cooldown||d>37||shots>=2)continue;
     const cover=traceCover({x:robber.x,y:robber.y+1.26,z:robber.z},p,solidsNear,zone.height);
     if(cover.fraction<.995&&(!p.vehicle||cover.solid?.vehicle!==p.vehicle))continue;
     robber.cooldown=3.4;shots++;fire(robber,p,d);hurtPlayer(p,7);
    }
   }
  }
  if(adult&&!battle&&!race?.active&&!identified&&!alert){
   if(!warning&&nearest<=24){warning=7;toast('Pattuglia di Teglie · Identificati entro 7 secondi');}
   else if(warning){
    warning=Math.max(0,warning-dt);
    if(!warning){alert=true;toast('Pattuglia ostile · Cerca riparo');}
   }
  }
  button.hidden=!adult||!warning||nearest>24||p.dead;
 }
 function seesPlayer(from,p){
  const cover=traceCover({x:from.x,y:from.y+1.26,z:from.z},p,solidsNear,zone.height);
  return cover.fraction>=.995||!!p.vehicle&&cover.solid?.vehicle===p.vehicle;
 }
 function clearShot(a,b){
  return traceCover({x:a.x,y:a.y+1.26,z:a.z},{x:b.x,y:b.y+1.26,z:b.z},solidsNear,zone.height).fraction>=.995;
 }
 function fire(from,to,distance){
  beamPoints.set([from.x,from.y+1.26,from.z,to.x,to.y,to.z]);
  beamGeometry.attributes.position.needsUpdate=true;flash=.085;
  playGunSound(true,distance,'smg');
 }
 function hurtPlayer(p,amount){
  if(p.vehicle&&p.vehicle.spec.id!=='helicopter')damage()?.damageVehicle(p.vehicle,6);
  else damage()?.hitPlayer(amount);
 }
 function ram(car,previous,speed){
  if(!active||!adult||speed<4||!zone.contains(car.x,car.z))return;
  if(Math.hypot(car.x-previous.x,car.z-previous.z)<.002)return;
  const direction=(car.x-previous.x)*Math.sin(car.yaw)+(car.z-previous.z)*Math.cos(car.yaw)<0?-1:1;
  const front=car.spec.length/2-.2;
  const dx=Math.sin(car.yaw)*front*direction,dz=Math.cos(car.yaw)*front*direction;
  const from=[previous.x+dx,previous.z+dz],to=[car.x+dx,car.z+dz];
  for(const guard of [...patrols,...reinforcements]){
   if(!guard.active||!guard.root.visible||guard.balcony)continue;
   if(Math.abs(guard.y-zone.height(car.x,car.z))>1.3)continue;
   if(nearest([guard.x,guard.z],from,to).d<car.spec.width/2+.28)hit(guard,Math.max(80,speed*6));
  }
 }
 return {vehicles:race?[...cars,race.opponent]:cars,update,clear,ram,
  targets:()=>active&&adult?[...patrols,...reinforcements,...robbers].filter(actor=>actor.active&&actor.root.visible):[],
  battleSpot,raceSpot:race?.origin,get racing(){return !!race?.active;},get stagingRace(){return !!race?.staging;},get combatAim(){return active&&adult;},
  take(car){car.autonomous=false;car.speed=0;}};
}
