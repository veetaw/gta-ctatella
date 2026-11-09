import {makeRuralEconomy} from './rural-economy.js';
import {rewardMission} from './economy.js';
import * as THREE from 'three';
import {FARM_LOCATIONS} from './farm-locations.js';
import {worldLocation} from './game-locations.js';
import {vehicleFootprint} from './vehicle-physics.js';
import {makeGrapeCrate,makePigPen,makePotatoSack,makeVendor,makeVines} from './farm-models.js';

const ROWS=[-4.2,-1.4,1.4,4.2],CRATES=3,REGROWTH_MS=600_000;
const initialWine={stage:'idle',trimmed:0,picked:0,harvestedAt:0,loaded:0,delivered:0,carrying:'',completed:false};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function makeFarmMissions(scene,{origin,network,ready,height,player,person,rambo,park,progress,save,enabled,toast,celebrate,actions,guideDelivery,transact,economy,onOverlay}){
 const [vineyard,cellar,market,pen]=FARM_LOCATIONS.slice(0,4).map(([, ,lat,lon])=>worldLocation(origin,{lat,lon}));
 const deliveryRoad=network.closestSegment(cellar.x,cellar.z)?.segment;
 const roadYaw=deliveryRoad?Math.atan2(deliveryRoad.b.x-deliveryRoad.a.x,deliveryRoad.b.z-deliveryRoad.a.z):0;
 const parking={x:vineyard.x+10,z:vineyard.z-5,yaw:Math.PI*.74};
 const pile={x:vineyard.x+7.4,z:vineyard.z+4.2},feed={x:pen.x+4.2,z:pen.z+.4};
 const road=network.closestSegment(market.x,market.z)?.segment;
 const truckYaw=road?Math.atan2(road.b.x-road.a.x,road.b.z-road.a.z):0;
 const obstacle=(id,point,yaw,width,length,top)=>({
  ...vehicleFootprint({...point,yaw,spec:{id,width,length}}),id,roofY:height(point.x,point.z)+top,
 });
 const crates=Array.from({length:CRATES},(_,i)=>{
  const ground=makeGrapeCrate(),cargo=ground.clone(),delivery=ground.clone();
  scene.add(ground,delivery);rambo.body.add(cargo);
  cargo.position.set((i%2-.5)*.52,.48,-.40-Math.floor(i/2)*.50);
  ground.visible=cargo.visible=delivery.visible=false;
  return {ground,cargo,delivery};
 });
 const carriedCrate=crates[0].ground.clone(),carriedSack=makePotatoSack();
 person.root.add(carriedCrate,carriedSack);
 carriedCrate.position.set(0,1.05,.34);carriedSack.position.set(0,.90,.34);
 carriedCrate.visible=carriedSack.visible=false;
 const marker=new THREE.Mesh(new THREE.RingGeometry(.67,.83,28),new THREE.MeshBasicMaterial({color:'#e5c886',side:THREE.DoubleSide,transparent:true,opacity:.76,depthWrite:false}));
 marker.rotation.x=-Math.PI/2;marker.visible=false;scene.add(marker);
 const button=document.createElement('button');button.type='button';button.hidden=true;actions.append(button);
 const objective=document.createElement('div');objective.className='farm-objective';objective.hidden=true;document.body.append(objective);
 const describe=(text)=>{if(objective.textContent!==text)objective.textContent=text;objective.hidden=!text;};
 let vines,vendor,pigs,time=0,needsParking=true,wasDrivingDelivery=false,clearDeliveryGuide;
 const wine=()=>({...initialWine,...progress().farm_wine});
 const pigStage=()=>progress().farm_pigs?.stage||'idle';
 const rural=makeRuralEconomy(scene,{origin,network,ready,height,player,person,rambo,economy,transact,enabled,toast,celebrate,actions,guideDelivery,marketPoint:()=>vendor?.point,pen,obstacle,onOverlay});
 const winePatch=(current,patch)=>({farm_wine:{...current,...patch,updatedAt:Math.max(Date.now(),(current.updatedAt||0)+1)}});
 const changeWine=(current,patch)=>void save(winePatch(current,patch));
 const pigPatch=stage=>({farm_pigs:{stage,completed:stage==='done'||!!progress().farm_pigs?.completed,updatedAt:Math.max(Date.now(),(progress().farm_pigs?.updatedAt||0)+1)}});
 const rear=()=>({x:rambo.x-2.05*Math.sin(rambo.yaw),z:rambo.z-2.05*Math.cos(rambo.yaw)});
 const atCellar=()=>rambo.root.visible&&!rambo.destroyed&&distance(rambo,cellar)<14&&Math.abs(rambo.speed)<.8;
 const regrown=(w)=>w.harvestedAt>0&&Date.now()-w.harvestedAt>=REGROWTH_MS;
 const active=w=>w.stage!=='idle'&&w.stage!=='done';

 function action(w,p){
  if(!enabled()||!p.onFoot)return null;
  if(w.stage==='haul'&&w.carrying==='field'&&rambo.root.visible&&!rambo.destroyed&&distance(p,rear())<2){
   return ['Carica la cassa sulla Rambo',()=>changeWine(w,{loaded:w.loaded+1,carrying:''})];
  }
  if(w.stage==='haul'&&w.carrying==='cellar'&&distance(p,cellar)<3.2){
   return ['Consegna la cassa',()=>{
    const delivered=w.delivered+1,done=delivered===CRATES;
    const patch={delivered,carrying:'',stage:done?'done':'haul',completed:w.completed||done};
    if(done)celebrate('Fa lu vuin',transact(e=>rewardMission(e,'wine'),winePatch(w,patch)));
    else changeWine(w,patch);
   }];
  }
  if(!w.carrying&&w.stage==='haul'){
   if(w.loaded>0&&atCellar()&&distance(p,rear())<2){
    return ['Scarica una cassa',()=>changeWine(w,{loaded:w.loaded-1,carrying:'cellar'})];
   }
   if(CRATES-w.loaded-w.delivered>0&&pigStage()!=='carry'&&distance(p,pile)<2.6){
    return ['Prendi una cassa d’uva',()=>changeWine(w,{carrying:'field'})];
   }
  }
  if((w.stage==='idle'||w.stage==='done'&&regrown(w))&&distance(p,vineyard)<9){
   return ['Inizia Fa lu vuin · serve la Rambo 4×4',()=>{
    changeWine(w,{...initialWine,stage:'trim',completed:w.completed});
    toast('Spambana lu fuel, un tratto alla volta. La Rambo ti aspetta a bordo campo.');
   }];
  }
  if(w.stage==='trim'||w.stage==='harvest'){
   const trimming=w.stage==='trim',count=trimming?w.trimmed:w.picked;
   if(Math.abs(p.x-vineyard.x)<7.4&&Math.abs(p.z-vineyard.z-ROWS[count])<1.55){
    return [trimming?'Spambana lu fuel':'Vendemmia lu fuel',()=>{
     if(trimming)changeWine(w,{trimmed:count+1,stage:count+1===ROWS.length?'harvest':'trim'});
     else changeWine(w,{picked:count+1,...(count+1===ROWS.length?{stage:'haul',harvestedAt:Date.now()}:{})});
    }];
   }
  }
  const ps=pigStage();
  if(!w.carrying&&(ps==='idle'||ps==='done')&&vendor&&distance(p,vendor.point)<3){
   return ['Accatta r patan · 35 CP',()=>{
    if(transact(e=>{if(e.cp<35)return false;e.cp-=35;},pigPatch('carry')))toast('Porta r patan ai due maiali nel recinto.');
    else toast('Servono 35 CP per un sacco dr patan.');
   }];
  }
  if(ps==='carry'&&distance(p,feed)<2.7){
   return ['Dai r patan ai maiali',()=>{celebrate('Crisc lu puorc',transact(e=>rewardMission(e,'pigs'),pigPatch('done')));}];
  }
  return null;
 }
 function interact(){const next=action(wine(),player());if(!next)return rural.interact();next[1]();return true;}
 button.onclick=interact;

 function update(dt){
  time+=dt;rural.update();
  const w=wine(),p=player(),ps=pigStage();
  const deliveryPending=w.stage==='haul'&&(w.loaded>0||w.carrying==='cellar');
  const drivingDelivery=w.stage==='haul'&&w.loaded>0&&p.vehicle===rambo;
  if(drivingDelivery&&!wasDrivingDelivery)clearDeliveryGuide=guideDelivery(rambo,cellar);
  if(!deliveryPending&&clearDeliveryGuide){clearDeliveryGuide();clearDeliveryGuide=undefined;}
  wasDrivingDelivery=drivingDelivery;
  const nearby=(point)=>distance(p,point)<100&&ready(point.x,point.z);
  if(!vines&&nearby(vineyard))vines=makeVines(scene,vineyard,ROWS,height);
  if(!pigs&&nearby(pen))pigs=makePigPen(scene,pen,height);
  if(!vendor&&nearby(market))vendor=makeVendor(scene,market,truckYaw,height);
  if(pigs){pigs.root.visible=nearby(pen);if(pigs.root.visible)pigs.update(time,ps==='done');}
  if(vendor)vendor.truck.visible=vendor.seller.visible=nearby(market);
  if(vines){vines.root.visible=nearby(vineyard);vines.show(regrown(w)?0:w.trimmed,regrown(w)?0:w.picked);}
  if(needsParking&&nearby(parking)){
   park(parking);needsParking=false;
  }
  const left=CRATES-w.loaded-w.delivered-Number(!!w.carrying);
  const showPile=w.stage==='haul'&&nearby(pile),showCellar=nearby(cellar);
  for(const [i,{ground,cargo,delivery}] of crates.entries()){
   ground.visible=showPile&&i<left;cargo.visible=active(w)&&i<w.loaded;
   delivery.visible=showCellar&&i<w.delivered;
   if(ground.visible){const x=pile.x+(i-1)*.55;ground.position.set(x,height(x,pile.z),pile.z);}
   if(delivery.visible){
    const offset=(i-1)*.52,x=cellar.x+Math.sin(roadYaw)*offset+Math.cos(roadYaw)*1.25,
     z=cellar.z+Math.cos(roadYaw)*offset-Math.sin(roadYaw)*1.25;
    const point=network.pavementAt(x,z)?{x,z}:cellar;
    delivery.position.set(point.x,height(point.x,point.z),point.z);
   }
  }
  carriedCrate.visible=p.onFoot&&!!w.carrying;carriedSack.visible=p.onFoot&&ps==='carry';

  const next=action(w,p);
  button.hidden=!next;
  if(next&&button.textContent!==next[0])button.textContent=next[0];
  let text='',target=null;
  if(enabled()){
   if(ps==='carry'&&(!active(w)||distance(p,pen)<18)){
    text='Crisc lu puorc · Porta r patan al recinto';target=feed;
   }else if(w.stage==='trim'||w.stage==='harvest'){
    const trimming=w.stage==='trim',n=trimming?w.trimmed:w.picked;
    text=`Fa lu vuin · ${trimming?'Spambana':'Vendemmia'} ${n}/${ROWS.length} · lu fuel`;
    target={x:vineyard.x+5.5,z:vineyard.z+ROWS[n]};
   }else if(w.stage==='haul'){
    const delivering=atCellar()||w.carrying==='cellar'||w.loaded===CRATES-w.delivered;
    text=delivering?`Fa lu vuin · Porta l’uva a la grotta · ${w.delivered}/${CRATES}`:
     `Fa lu vuin · Carica la Rambo 4×4 · ${w.loaded}/${CRATES-w.delivered}`;
    target=delivering?cellar:w.carrying==='field'?rear():pile;
    if(needsParking){text='Fa lu vuin · Recupera la Rambo al vigneto';target=parking;}
   }else if(w.stage==='done'&&!regrown(w)&&distance(p,vineyard)<9){
    const remaining=Math.ceil((w.harvestedAt+REGROWTH_MS-Date.now())/1000);
    text=`Vigneto · Ricrescita tra ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
   }
   else if(w.stage==='idle'&&distance(p,vineyard)<120){text='Fa lu vuin · Vai al vigneto';target=vineyard;}
  }
  describe(text);
  marker.visible=!!target&&distance(p,target)<(target===vineyard?100:35)&&ready(target.x,target.z);
  if(marker.visible)marker.position.set(target.x,height(target.x,target.z)+.07,target.z);
 }
 function onExplosion(vehicle){
  if(vehicle!==rambo)return;
  rural.onExplosion();
  rambo.root.visible=false;needsParking=true;
  const w=wine();if(!active(w))return;
  changeWine(w,{loaded:0,carrying:''});
  toast('Rambo distrutta. Le casse da consegnare tornano al vigneto.');
 }
 return {interact,update,onExplosion,wheatTarget:rural.wheatTarget,close:rural.close,get open(){return rural.open;},blocks(x,z,r){
  const result=rural.blocks(x,z,r);
  if(distance({x,z},pen)<r+5)result.push(obstacle('farm-pig-pen',pen,0,6.67,5.08,1.12));
  if(distance({x,z},market)<r+4)result.push(obstacle('farm-market-truck',market,truckYaw,2.22,5.35,2.53));
  return result;
 }};
}
