import * as THREE from 'three';
import {FARM_LOCATIONS,hasPlanted} from './farm-locations.js';
import {worldLocation} from './game-locations.js';
import {formatCP} from './economy.js';
import {bake} from './procession-model.js';
import {makeWheatSack} from './farm-models.js';

const MINUTE=60_000,EGG_INTERVAL=10*MINUTE,SACKS=3,CHICK_GROWTH=2*MINUTE;
const CROPS={
 potatoes:{name:'R patan',plant:'Chianta r patan',pick:'Raccogli r patan',seed:10,time:3*MINUTE,price:45},
 peppers:{name:'Papagl',plant:'Pianta i papagl',pick:'Raccogli i papagl',seed:15,time:4*MINUTE,price:90},
 wheat:{name:'Grano',plant:'Semmna r gruan',seed:15,time:5*MINUTE},
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function makeRuralEconomy(scene,{origin,network,ready,height,player,person,rambo,economy,transact,enabled,toast,celebrate,actions,guideDelivery,marketPoint,pen,obstacle,onOverlay}){
 const [,,coopLat,coopLon]=FARM_LOCATIONS[5],coop=worldLocation(origin,{lat:coopLat,lon:coopLon});
 const fieldPoint=index=>{const [,,lat,lon]=FARM_LOCATIONS[index];return worldLocation(origin,{lat,lon});};
 const field=fieldPoint(6),dryer={x:pen.x-8,z:pen.z+24};
 const plots={potatoes:field,wheat:fieldPoint(7),peppers:{x:pen.x-8,z:pen.z+12}};
 const eggBasket={x:coop.x-4.4,z:coop.z};
 const plotRadius=5;
 const mill=worldLocation(origin,{lat:40.661568,lon:15.404958});
 const millRoad=network.closestSegment(mill.x,mill.z);
 const delivery=millRoad?{x:millRoad.q[0],z:millRoad.q[1]}:mill;
 const wheat=plots.wheat,pile={x:wheat.x+6,z:wheat.z+3};
 const wheatRoad=network.closestSegment(wheat.x,wheat.z);
 const approach=wheatRoad?{x:wheatRoad.q[0],z:wheatRoad.q[1]}:{x:wheat.x,z:wheat.z-14};
 const start=wheatRoad?.segment.a||{x:approach.x,z:approach.z-10};
 const button=document.createElement('button'),status=document.createElement('output'),dialog=document.createElement('dialog');
 button.type='button';button.hidden=true;actions.append(button);
 status.className='rural-status';status.hidden=true;document.body.append(status);
 dialog.className='pause-screen economy-shop';
 dialog.innerHTML='<header class="pause-header"><h1>Mercato del patanaro</h1><button type="button" class="pause-close" aria-label="Chiudi">×</button></header><p></p><ol class="pause-scores"></ol>';
 document.body.append(dialog);dialog.querySelector('.pause-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>onOverlay(false));

 const marketItems=[
  ['potatoesStock','R patan',1,45],['cruschi','Papagl cruschi',1,90],
  ['eggs','Uova',5,40],['flour','Fariniello',1,350],
 ];
 const farm=()=>economy().farm;
 const patch=(update)=>transact(e=>update(e.farm,e));
 const marketRows=marketItems.map(([id,label,qty,price])=>{
  const row=document.createElement('li'),name=document.createElement('strong'),sell=document.createElement('button');
  sell.type='button';sell.textContent=`Vendi · +${formatCP(price)}`;row.append(name,sell);dialog.querySelector('ol').append(row);
  sell.onclick=()=>{patch((f,e)=>{if((f[id]||0)<qty)return false;f[id]-=qty;e.cp+=price;e.rp+=3;});renderMarket();};
  return {id,label,qty,name,sell};
 });
 function renderMarket(){
  const f=farm();dialog.querySelector('p').textContent=formatCP(economy().cp);
  for(const {id,label,qty,name,sell} of marketRows){
   name.textContent=`${label} · ${f[id]||0} disponibili`;sell.disabled=(f[id]||0)<qty;
  }
 }
 function buySeeds(id){
  const crop=CROPS[id];
  const plantingMission=id==='potatoes'||id==='wheat';
  const gain=patch((f,e)=>{
   if(e.cp<crop.seed)return false;
   const first=plantingMission&&!hasPlanted(f,id);
   e.cp-=crop.seed;f[id]=Date.now();
   if(id==='wheat'){f.wheatHarvested=false;f.wheatCalled=0;}
   if(plantingMission)f.sown={...f.sown,[id]:true};
   if(!first)return;
   e.cp+=25;e.rp+=10;
   return {cp:25,rp:10};
  });
  if(!gain)toast('CP insufficienti per i semi.');
  else if(gain.cp)celebrate(crop.plant,gain);
 }
 const stage=(f,id,now)=>{
  if(id==='wheat'&&f.wheatHarvested)return 'mietuto';
  if(!f[id])return 'arato';
  const elapsed=now-f[id];
  return elapsed<CROPS[id].time?(elapsed<MINUTE?'seminato':'in crescita'):'pronto';
 };
 const eggsAt=(f,now)=>{
  const batches=Math.floor(Math.max(0,now-(f.eggAt||now))/EGG_INTERVAL);
  return Math.min(10,(f.eggs||0)+batches*Math.min(10,(f.hens||3)+2));
 };
 const hasRambo=()=>rambo.root.visible&&!rambo.destroyed&&Math.abs(rambo.speed)<.8;
 const rear=()=>({x:rambo.x-2.05*Math.sin(rambo.yaw),z:rambo.z-2.05*Math.cos(rambo.yaw)});
 function nextAction(p,f,now){
  if(!enabled()||!p.onFoot)return null;
  const vendor=marketPoint();
  if(vendor&&distance(p,vendor)<3.4)return ['Mercato del patanaro',()=>{renderMarket();dialog.showModal();onOverlay(true);}];
  if(f.wheatCarry&&hasRambo()&&distance(p,rear())<2.5)return ['Carica il sacco sulla Rambo',()=>patch(f=>{f.wheatCarry=false;f.wheatLoad=(f.wheatLoad||0)+1;})];
  if(f.wheatLoad&&hasRambo()&&distance(rambo,delivery)<14&&distance(p,rear())<3)return ['Scarica il grano al mulino',()=>{
   const sacks=farm().wheatLoad;
   const cp=sacks*1000,rp=sacks*10;
   patch((f,e)=>{f.flour=(f.flour||0)+sacks;f.wheatLoad=0;f.wheatDelivered=true;e.cp+=cp;e.rp+=rp;});
   celebrate('Porta il grano al mulino',{cp,rp});
  }];
  if(f.wheatGround&&!f.wheatCarry&&distance(p,pile)<2.8)return ['Prendi un sacco di grano',()=>patch(f=>{f.wheatGround--;f.wheatCarry=true;})];
  if(distance(p,eggBasket)<2&&eggsAt(f,now)>(f.eggs||0))return ['Raccogli le uova',()=>patch(f=>{f.eggs=eggsAt(f,now);f.eggAt=now;})];
  if(distance(p,coop)<4){
   if((f.hens||3)+(f.chicks?.length||0)<10&&f.flour>0)return ['cvuerna r gaddin',()=>{
    patch(f=>{f.flour--;f.chicks=[...(f.chicks||[]),now+CHICK_GROWTH];});
    toast('Scuot i pruciuin · Il pulcino cresce in 2 minuti.');
   }];
  }
  if(distance(p,dryer)<2.8){
   if(f.drying&&now-f.drying>=3*MINUTE)return ['Raccogli i papagl cruschi',()=>patch(f=>{f.cruschi=(f.cruschi||0)+1;f.drying=0;})];
   if(f.freshPeppers&&!f.drying)return ['Metti a essiccare i papagl',()=>patch(f=>{f.freshPeppers--;f.drying=now;})];
  }
  for(const [id,point] of Object.entries(plots)){
   if(Math.max(Math.abs(p.x-point.x),Math.abs(p.z-point.z))>plotRadius)continue;
   const phase=stage(f,id,now),crop=CROPS[id];
   if(phase==='arato'||phase==='mietuto'&&!f.wheatGround&&!f.wheatLoad&&!f.wheatCarry)
    return [`${crop.plant} · ${formatCP(crop.seed)}`,()=>buySeeds(id)];
   if(phase!=='pronto')continue;
   if(id==='wheat'){
    if(!f.wheatCalled)return ['Chiama la mietitrebbia',()=>{patch(f=>{f.wheatCalled=Date.now();});toast('Mietitrebbia in arrivo · Per i sacchi serve la Rambo 4×4.');}];
   }else{
    return [crop.pick,()=>patch(f=>{const stock=id==='potatoes'?'potatoesStock':'freshPeppers';f[stock]=(f[stock]||0)+1;f[id]=0;})];
   }
  }
  return null;
 }

 const root=new THREE.Group();scene.add(root);
 const colors={dirt:0x62432c,leaf:0x617744,pepper:0xb23426,wheat:0xd2ac55,wood:0x9b744a,white:0xe0d4b8,red:0xb52f25,dark:0x232422};
 const materials=Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,new THREE.MeshLambertMaterial({color})]));
 function box(parent,size,position,color){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),materials[color]);mesh.position.set(...position);parent.add(mesh);return mesh;
 }
 const plants={};
 const hens=[],eggs=[];
 function buildField(){
  for(const [id,p] of Object.entries(plots)){
   const vertices=[],indices=[];
   const size=plotRadius*2,stride=size+1;
   for(let z=0;z<=size;z++)for(let x=0;x<=size;x++){
    const a=p.x+x-plotRadius,b=p.z+z-plotRadius;vertices.push(a,height(a,b)+.045,b);
    if(x&&z){const i=z*stride+x;indices.push(i-stride-1,i-1,i-stride,i-stride,i-1,i);}
   }
   const soil=new THREE.BufferGeometry();soil.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));soil.setIndex(indices);soil.computeVertexNormals();root.add(new THREE.Mesh(soil,materials.dirt));
   const group=new THREE.Group();root.add(group);
   for(let x=-2;x<=2;x+=2)for(let z=-2;z<=2;z++){
    const a=p.x+x,b=p.z+z,plant=new THREE.Group();group.add(plant);plant.position.set(a,height(a,b),b);
    if(id==='wheat'){
     for(const offset of [-.24,0,.24]){box(plant,[.06,.70,.06],[offset,.35,0],'wheat');box(plant,[.13,.20,.13],[offset,.68,0],'wheat');}
    }else{
     box(plant,[.62,.22,.42],[0,.16,0],'leaf');
     if(id==='peppers')box(plant,[.11,.19,.11],[.20,.16,.18],'pepper');
    }
   }
   const scale=phase=>phase==='seminato'?.22:phase==='in crescita'?.59:1;
   const variants=Object.fromEntries(['seminato','in crescita','pronto'].map(phase=>{
    const variant=group.clone(true);root.add(variant);
    for(const plant of variant.children){
     plant.scale.y=scale(phase);
     for(const mesh of plant.children)mesh.geometry=mesh.geometry.clone();
    }
    bake(variant);variant.visible=false;return [phase,variant];
   }));
   group.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});group.removeFromParent();
   plants[id]=variants;
  }
  for(const x of [-2.7,2.7])for(const z of [-2.3,2.3])box(root,[.14,1.04,.14],[coop.x+x,height(coop.x+x,coop.z+z)+.52,coop.z+z],'wood');
  for(const [x,z,dx,dz] of [[-2.7,0,.12,4.6],[2.7,0,.12,4.6],[0,-2.3,5.4,.12],[0,2.3,5.4,.12]]){
   const a=coop.x+x,b=coop.z+z;for(const y of [.36,.77])box(root,[dx,.12,dz],[a,height(a,b)+y,b],'wood');
  }
  box(root,[1.18,.90,.83],[coop.x+1,height(coop.x+1,coop.z)+.45,coop.z],'wood');
  box(root,[1.34,.14,1],[coop.x+1,height(coop.x+1,coop.z)+.91,coop.z],'red');
  const basketHeight=height(eggBasket.x,eggBasket.z);
  box(root,[.66,.13,.44],[eggBasket.x,basketHeight+.075,eggBasket.z],'wood');
  const eggShape=new THREE.SphereGeometry(.08,8,6).scale(.8,1,.8);
  for(let i=0;i<5;i++){
   const egg=new THREE.Mesh(eggShape,materials.white);
   egg.position.set(eggBasket.x+(i%3-1)*.17,basketHeight+.18,eggBasket.z+(Math.floor(i/3)-.5)*.16);
   egg.visible=false;root.add(egg);eggs.push(egg);
  }
  for(let i=0;i<10;i++){
   const hen=new THREE.Group();root.add(hen);hens.push(hen);
   box(hen,[.25,.24,.37],[0,.22,0],'white');box(hen,[.15,.17,.15],[0,.37,.17],'white');box(hen,[.06,.08,.10],[0,.47,.17],'red');box(hen,[.07,.05,.09],[0,.37,.27],'wheat');bake(hen);
  }
  const rack=new THREE.Group();root.add(rack);
  const lineHeight=Math.max(height(dryer.x-1.45,dryer.z),height(dryer.x+1.45,dryer.z))+1.85;
  for(const offset of [-1.45,1.45]){
   const x=dryer.x+offset,ground=height(x,dryer.z);
   box(rack,[.12,lineHeight-ground+.09,.12],[x,(lineHeight+ground+.09)/2,dryer.z],'wood');
  }
  const rope=new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
   new THREE.Vector3(dryer.x-1.45,lineHeight,dryer.z),
   new THREE.Vector3(dryer.x,lineHeight-.23,dryer.z),
   new THREE.Vector3(dryer.x+1.45,lineHeight,dryer.z)
  ),10,.017,5,false),materials.wood);
  rack.add(rope);
  for(let i=0;i<5;i++){
   const offset=(i-2)*.48,x=dryer.x+offset,y=lineHeight-.10;
   box(rack,[.022,.20,.022],[x,y-.10,dryer.z],'wood');
   for(let j=0;j<3;j++){
    const pepper=new THREE.Mesh(new THREE.ConeGeometry(.062,.27,7).rotateZ(Math.PI),materials.pepper);
    pepper.position.set(x+(j-1)*.073,y-.29-j*.04,dryer.z+(j%2)*.055);
    pepper.rotation.z=(j-1)*.27;rack.add(pepper);
   }
  }
  bake(rack);
 }
 const combine=new THREE.Group();combine.visible=false;scene.add(combine);
 box(combine,[2.3,1.42,3.35],[0,1.34,-.30],'red');
 box(combine,[1.51,.93,1.19],[0,2.22,.77],'dark');
 box(combine,[1.62,.15,1.31],[0,2.75,.77],'red');
 box(combine,[3.24,.35,.75],[0,.42,2.12],'red');
 box(combine,[3.18,.14,.65],[0,.48,2.45],'dark');
 for(const x of [-1.08,1.08])for(const z of [-1.1,.9]){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(z>0?.62:.46,z>0?.62:.46,.35,10),materials.dark);
  mesh.rotation.z=Math.PI/2;mesh.position.set(x,z>0?.62:.46,z);combine.add(mesh);
 }
 bake(combine);
 const sacks=Array.from({length:SACKS},(_,i)=>{
  const ground=makeWheatSack(),cargo=ground.clone();scene.add(ground);rambo.body.add(cargo);
  cargo.position.set(0,.61,-.59-i*.57);cargo.scale.z=1.65;ground.visible=cargo.visible=false;return {ground,cargo};
 });
 const carried=makeWheatSack();person.root.add(carried);carried.position.set(0,.67,.55);carried.visible=false;
 let built=false,guide,wasDriving=false;
 function plotStatus(f,id,now){
  const phase=stage(f,id,now),crop=CROPS[id];
  if((id==='wheat'||id==='peppers')&&(phase==='seminato'||phase==='in crescita')){
   const seconds=Math.ceil((f[id]+crop.time-now)/1000);
   const remaining=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
   return `${crop.name} · Pronto tra ${remaining}`;
  }
  return `${crop.name} · ${phase}`;
 }
 function update(){
  const p=player(),now=Date.now(),near=distance(p,field)<85&&ready(field.x,field.z);
  let f=farm();
  if(near&&!built){buildField();built=true;}
  if(near&&!f.eggAt){patch(f=>{f.eggAt=now;});f=farm();}
  const grown=(f.chicks||[]).filter(deadline=>deadline<=now).length;
  if(near&&grown){
   patch((f,e)=>{f.chicks=f.chicks.filter(deadline=>deadline>now);f.hens=Math.min(10,(f.hens||3)+grown);f.chicksRaised=(f.chicksRaised||0)+grown;e.cp+=500*grown;e.rp+=25*grown;});
   f=farm();celebrate('Scuot i pruciuin',{cp:500*grown,rp:25*grown});
  }
  root.visible=near;
  if(near){
   const readyEggs=eggsAt(f,now)-(f.eggs||0);
   for(const [i,egg] of eggs.entries())egg.visible=i<readyEggs;
   for(const [id,variants] of Object.entries(plants)){
    const phase=stage(f,id,now);for(const [key,group] of Object.entries(variants))group.visible=key===phase;
   }
   for(const [i,hen] of hens.entries()){
    const adultCount=f.hens||3;
    hen.visible=i<adultCount+(f.chicks?.length||0);if(!hen.visible)continue;
    hen.scale.setScalar(i<adultCount?1:.55);
    const angle=now*.0007+i*2.4,x=coop.x+Math.sin(angle)*(1+(i%3)*.38),z=coop.z+Math.cos(angle)*(1+(i%2)*.45);
    hen.position.set(x,height(x,z),z);hen.rotation.y=angle;
   }
  }
  combine.visible=near&&!!f.wheatCalled;
  if(combine.visible){
   const t=Math.min(1,(now-f.wheatCalled)/12_000);
   const path=[start,approach,{x:wheat.x,z:wheat.z-plotRadius},{x:wheat.x,z:wheat.z+plotRadius}];
   const i=Math.min(path.length-2,Math.floor(t*(path.length-1))),a=path[i],b=path[i+1],v=t*(path.length-1)-i;
   const x=a.x+(b.x-a.x)*v,z=a.z+(b.z-a.z)*v;
   combine.position.set(x,height(x,z),z);combine.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
   if(t===1){patch(f=>{f.wheatCalled=0;f.wheatHarvested=true;f.wheatGround=SACKS;});f=farm();}
  }
  for(const [i,{ground,cargo}] of sacks.entries()){
   ground.visible=near&&i<(f.wheatGround||0);cargo.visible=i<(f.wheatLoad||0);
   if(ground.visible){const x=pile.x+i*.93;ground.position.set(x,height(x,pile.z),pile.z);}
  }
  carried.visible=p.onFoot&&!!f.wheatCarry;
  const driving=p.vehicle===rambo&&f.wheatLoad>0;
  if(driving&&!wasDriving)guide=guideDelivery(rambo,delivery,'Porta il grano al mulino · Scarico');
  if(!f.wheatLoad&&guide){guide();guide=undefined;}
  wasDriving=driving;
  const next=nextAction(p,f,now);button.hidden=!next;
  if(next&&button.textContent!==next[0])button.textContent=next[0];
  const plot=Object.entries(plots).find(([,q])=>Math.max(Math.abs(p.x-q.x),Math.abs(p.z-q.z))<=plotRadius);
  const description=!enabled()?'':f.wheatCarry?'Grano · Carica il sacco sulla Rambo':
   f.wheatLoad?'Grano · Porta i sacchi al mulino con la Rambo':
   near&&f.wheatGround?'Grano · Raccogli i sacchi a bordo campo':
   near&&f.wheatCalled?'Grano · Mietitrebbia in arrivo':
   plot?plotStatus(f,plot[0],now):
   distance(p,coop)<4&&f.flour>0&&(f.hens||3)+(f.chicks?.length||0)<10?'Va cvuerna · Dai il fariniello alle galline':
   distance(p,coop)<4&&f.chicks?.length?`Scuot i pruciuin · ${f.chicks.length} in crescita · ${Math.ceil((f.chicks[0]-now)/1000)} s`:
   distance(p,eggBasket)<2.5||distance(p,coop)<4?`Pollaio · ${f.hens||3}/10 polli · ${eggsAt(f,now)-(f.eggs||0)} uova da raccogliere`:
   distance(p,dryer)<3&&f.drying?'Essiccatoio · Papagl in preparazione':'';
  status.hidden=!description;if(status.textContent!==description)status.textContent=description;
 }
 function interact(){const next=nextAction(player(),farm(),Date.now());if(!next)return false;next[1]();return true;}
 button.onclick=interact;
 return {update,interact,blocks(x,z,r){
  if(Math.abs(x-coop.x)>r+2.77||Math.abs(z-coop.z)>r+2.37)return [];
  return [obstacle('farm-chicken-pen',coop,0,5.54,4.74,1.04)];
 },wheatTarget:()=>farm().wheatLoad?delivery:wheat,close(){dialog.close();},get open(){return dialog.open;},onExplosion(){
  const f=farm();if(!f.wheatLoad)return false;
  patch(f=>{f.wheatGround=(f.wheatGround||0)+f.wheatLoad;f.wheatLoad=0;});
  toast('I sacchi di grano sono tornati al campo.');return true;
 }};
}
