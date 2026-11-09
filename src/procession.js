import {makeMarchingBand} from './procession-people.js';
import {BAND_SLOTS,processionCollisionShapes} from './procession-collisions.js';
import {PROCESSION_GOAL_METERS} from './progress-record.js';
import {processionRoute,processionPathDistance} from './procession-route.js';
import {makePrologueModels} from './prologue-model.js';
export const ESCORT_LEAD_METERS=10;
export function makeProcessionPrologue(scene,{network,height,ready,player,canJoin=()=>true,canAdvance=()=>true,meters=()=>0,isDone=()=>false,onEnter=()=>{},onExit=()=>{},onMeters=()=>{},onComplete=()=>{}}){
 const band=makeMarchingBand(scene);
 const route=processionRoute(network),models=makePrologueModels(scene,network.world.origin,height),ui=document.createElement('div');ui.id='procession';ui.innerHTML=`<button class="procession-start" hidden>🙏 INIZIA PROCESSIONE</button><button class="procession-join" hidden>🙌 Porta la Statua</button><section class="procession-hud" hidden aria-label="Porta la Statua"><span class="procession-meters"></span></section><button class="procession-leave" hidden>Posa la statua</button><p class="procession-intro" hidden>Porta la Statua per almeno ${PROCESSION_GOAL_METERS} metri. Avvicinati alla vara e premi «Porta la Statua».</p>`;document.body.append(ui);
 const $=s=>ui.querySelector(s),joinButton=$('.procession-join'),startButton=$('.procession-start'),panel=$('.procession-hud'),leaveButton=$('.procession-leave'),tip=$('.procession-intro');let distance=0,running=!isDone(),mounted=null,mountedIndex=1,time=0,credit=0,facingYaw=0,notified=isDone(),collisionShapes=[];
 function pose(s,offset=0){const p=route.at(s,offset);return {...p,y:height(p.x,p.z),visible:s>=0&&s<route.length};}
 function place(model,s){const p=pose(s);model.root.visible=p.visible&&ready(p.x,p.z);if(model.root.visible){model.root.position.set(p.x,p.y,p.z);model.root.rotation.y=p.yaw;model.update(.016);}return p;}
 const lag={peter:4,mary:10},tail=39;
 function closestBearer(p){
  let closest=null;
  for(const key of ['peter','mary']){
   if(!models[key].root.visible)continue;
   const slot=models[key].closestBearer(p.x,p.z);
   if(!closest||slot.distance<closest.distance)closest={key,...slot};
  }
  return closest?.distance<=6?closest:null;
 }
 function leave(){
  if(!mounted)return;
  const model=models[mounted],p=bearerPose(),yaw=model.root.rotation.y,side=mountedIndex<2?-1:1;
  model.replacePlayer(false);mounted=null;panel.hidden=true;
  if(credit>0){onMeters(credit);credit=0;}
  onExit({...p,x:p.x+Math.cos(yaw)*1.7*side,z:p.z-Math.sin(yaw)*1.7*side});
 }
 function join(){
  const p=player();if(mounted||!running||!p.onFoot||!canJoin())return;
  const slot=closestBearer(p);if(!slot)return;
  mounted=slot.key;mountedIndex=slot.index;facingYaw=0;
  models[mounted].replacePlayer(true,mountedIndex);panel.hidden=isDone();onEnter();
 }
 function restart(){const p=player();if(running||Math.hypot(p.x-route.start.x,p.z-route.start.z)>12||!p.onFoot)return;distance=0;running=true;}
 joinButton.onclick=join;startButton.onclick=restart;$('.procession-leave').onclick=leave;
 function update(dt){
  time+=dt;const p=player();
  if(running){
   const nextDistance=distance+dt*1.05;
   const advanced=canAdvance(processionCollisionShapes(route,nextDistance,height),route,nextDistance);
   if(advanced){
    if(mounted){
     const lagMeters=lag[mounted],before=Math.min(route.length,distance-lagMeters),after=Math.min(route.length,nextDistance-lagMeters);
     credit+=Math.max(0,after-before);
     const remaining=isDone()?Infinity:PROCESSION_GOAL_METERS-meters();
     if(credit>=remaining-1e-8){onMeters(remaining);credit=0;}
     else if(credit>=.5){onMeters(credit);credit=0;}
    }
    distance=nextDistance;
   }
   if(mounted&&isDone()&&!notified){notified=true;leave();onComplete();}
   if(mounted&&distance-lag[mounted]>=route.length)leave();
   if(distance>route.length+tail){running=false;leave();}
  }
  collisionShapes=running?processionCollisionShapes(route,distance,height):[];
  const visible=running&&Math.hypot(p.x-route.at(Math.min(distance,route.length)).x,p.z-route.at(Math.min(distance,route.length)).z)<190;
  const lead=pose(distance);models.leader.visible=visible&&lead.visible&&ready(lead.x,lead.z);if(models.leader.visible){models.leader.position.set(lead.x,lead.y+Math.sin(time*6)*.025,lead.z);models.leader.rotation.y=lead.yaw;}
  for(const k of ['peter','mary']){if(visible)place(models[k],distance-lag[k]);else models[k].root.visible=false;}
  band.update(BAND_SLOTS.map(([lag,offset])=>{
   const p=pose(distance-lag,offset);
   return {...p,visible:visible&&p.visible&&ready(p.x,p.z)};
  }),height,time);
  models.crowdRoot.visible=visible;if(visible)models.updateCrowd(Array.from({length:16},(_,i)=>pose(distance-21-Math.floor(i/2)*1.5,(i%2-.5)*.9)),time);
  joinButton.hidden=!!mounted||!running||!p.onFoot||!canJoin()||!closestBearer(p);
  startButton.hidden=running||!p.onFoot||Math.hypot(p.x-route.start.x,p.z-route.start.z)>12;
  tip.hidden=!!mounted||isDone();
  panel.hidden=!mounted||isDone();
  leaveButton.hidden=!mounted;
  if(mounted){const m=Math.min(PROCESSION_GOAL_METERS,meters()+credit);$('.procession-meters').textContent=`${Math.floor(m)} m / ${PROCESSION_GOAL_METERS} m`;}
 }
 update(0);
 function bearerPose(){if(!mounted)return null;const model=models[mounted];return {...model.bearerPose(mountedIndex),yaw:model.root.rotation.y+facingYaw};}
 function blocksTraffic(x,z){
  return running&&processionPathDistance(route,x,z,distance-34,distance+28)<6;
 }
 return {route,models,blocksTraffic,escortPosition(){return running&&distance+ESCORT_LEAD_METERS<route.length?route.at(distance+ESCORT_LEAD_METERS):null;},colliders(x,z,r){return collisionShapes.filter(b=>b.bounds[2]>=x-r&&b.bounds[0]<=x+r&&b.bounds[3]>=z-r&&b.bounds[1]<=z+r);},join,leave,restart,update,get active(){return !!mounted;},rotate(angle){if(mounted&&Number.isFinite(angle))facingYaw+=angle;},bearerPose,bandPosition(){return running&&distance>=14&&distance<route.length+17.2?route.at(distance-15.6):null;},marker(){return running?route.at(Math.min(distance,route.length)):null;},stats:()=>({running,mounted,distance,length:route.length,meters:meters(),order:['cenda','peter','mary','faithful']})};
}
