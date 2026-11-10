import {makeProcession} from './procession-model.js';
import {PROCESSION_JOIN_RADIUS,processionBearerPose} from './online-procession-pose.js';

export function installOnlineProcession(scene,{world,actions,hud,height,room,player,canUse,onSeat,beforeRequest}){
 const button=document.createElement('button');
 button.type='button';
 button.className='procession-start';
 button.hidden=true;
 actions.append(button);
 let current, model, seat=-1, marked=false;
 const otherBearers=new Map();
 const slotId=slot=>slot.toString(16).padStart(24,'0');
 button.onclick=()=>{
  if(button.hidden||!room())return;
  beforeRequest();
  room().send({type:seat>=0?'procession-leave':current.point?'procession-join':'procession-start'});
 };
 function receive(event){
  current=event;
  if(event.start&&!marked){
   hud.addMapLandmark({...event.start,icon:'✝',label:'Processione · Madonna delle Grazie'});
   marked=true;
  }
  const next=event.point?event.seats.indexOf(room()?.slot):-1;
  if(next!==seat){seat=next;onSeat(seat>=0);}
  if(event.result)hud.toast(event.result);
 }
 function reset(){
  current=null;seat=-1;otherBearers.clear();button.hidden=true;
  if(model)model.root.visible=false;
 }
 function update(dt){
  const point=current?.point;
  const target=point??current?.start;
  const p=player();
  const near=target&&Math.hypot(p.x-target.x,p.z-target.z)<PROCESSION_JOIN_RADIUS-.5;
  const count=current?.seats.filter(slot=>slot!==null).length??0;
  button.hidden=!room()||!canUse()||!(seat>=0||near&&count<4);
  if(!button.hidden){
   const label=seat>=0?'Lascia la vara':point?'Porta la statua · '+count+'/4':'Avvia processione';
   if(button.textContent!==label)button.textContent=label;
  }
  otherBearers.clear();
  if(!point){if(model)model.root.visible=false;return null;}
  const close=Math.hypot(p.x-point.x,p.z-point.z)<170;
  if(!model&&close)model=makeProcession(scene,{origin:world.origin,height});
  if(!model)return null;
  const {root,bearers}=model;
  const blend=root.visible?1-Math.exp(-dt*11):1;
  root.visible=close;
  root.position.x+=(point.x-root.position.x)*blend;
  root.position.y+=(point.y-root.position.y)*blend;
  root.position.z+=(point.z-root.position.z)*blend;
  const angle=point.yaw-root.rotation.y;
  root.rotation.y+=Math.atan2(Math.sin(angle),Math.cos(angle))*blend;
  const rendered={...root.position,yaw:root.rotation.y};
  current.seats.forEach((slot,index)=>{
   bearers[index].visible=slot===null;
   if(slot!==null&&index!==seat)otherBearers.set(slotId(slot),processionBearerPose(rendered,index));
  });
  if(close)model.update(dt,count>0);
  return seat>=0?processionBearerPose(rendered,seat):null;
 }
 return {receive,reset,update,otherBearers,get carrying(){return seat>=0;},get active(){return !!current?.point;}};
}
