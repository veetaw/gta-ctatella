import {playSheepBleat} from './engine-audio.js';
import {actionIcon} from './ui-icons.js';
import {worldLocation} from './game-locations.js';
import {createTurneiaScore} from './turneia-score.js';
import {makeTurneiaHerd} from './turneia-herd.js';
import {shepherdWhistle} from './shepherd-audio.js';
export const SAN_VITO={lat:40.661428,lon:15.405119};
// The supplied GPS marks the forecourt; laps must enclose the church itself.
export function turneiaLocation(origin,buildings=[]){
 const anchor=worldLocation(origin,SAN_VITO),church=buildings.find(b=>b.church?.variant==='san-vito'||b.landmarkRole==='san-vito')||buildings.filter(b=>/^san vito$/i.test(b.name?.trim()||'')).sort((a,b)=>(b.bounds[2]-b.bounds[0])*(b.bounds[3]-b.bounds[1])-(a.bounds[2]-a.bounds[0])*(a.bounds[3]-a.bounds[1]))[0];
 const center=church?{x:(church.bounds[0]+church.bounds[2])/2,z:(church.bounds[1]+church.bounds[3])/2}:worldLocation(origin,{lat:40.661304,lon:15.4051403});
 return {anchor,center};
}
export function makeTurneia(scene,{origin,buildings=[],player,height,ready,clear,move,toast,onWin,canStart=()=>true}){
 const {anchor,center}=turneiaLocation(origin,buildings),score=createTurneiaScore(center),herd=makeTurneiaHerd(scene);
 const ui=document.createElement('section');ui.id='turneia';ui.setAttribute('aria-label','Turniata di San Vito');ui.innerHTML='<button class="turn-start" hidden>Turniata di San Vito</button><div class="turn-hud" hidden><strong>Turniata di San Vito</strong><span class="turn-score"></span><span class="turn-status" role="status"></span><span class="turn-bonus" role="status"></span></div><div class="turn-actions" hidden><button class="turn-call">🗣️ Chiama lu manz</button><button class="turn-exit" aria-label="Esci dalla Turniata">Esci</button></div>';document.body.append(ui);
 const $=s=>ui.querySelector(s),startButton=$('.turn-start'),panel=$('.turn-hud'),actions=$('.turn-actions');
 $('.turn-call').innerHTML=actionIcon('whistle')+'<span>Chiama lu manz</span>';
 $('.turn-exit').innerHTML=actionIcon('exit')+'<span>Esci</span>';
 function showActive(active){panel.hidden=actions.hidden=!active;}
 let animals=[],trail=[],nextFlee=10,fleeing=false,recalling=false,bonusUntil=0,bonusText='',clock=0,bleatIn=0;
 function freeSpot(x,z,r=.5){for(let ring=0;ring<20;ring+=1.5)for(let i=0;i<16;i++){const a=i*Math.PI/8,q={x:x+Math.cos(a)*ring,z:z+Math.sin(a)*ring};if(clear(q.x,q.z,r))return q;}return {x:center.x,z:center.z+4};}
 const home=freeSpot(anchor.x,anchor.z+5,2);
 function resetHerd(){animals=Array.from({length:26},(_,i)=>({...freeSpot(home.x+(i<2?(i-.5)*1.2:Math.sin(i*2.4)*Math.sqrt(i-1)*.48),home.z+(i<2?-1.2:1+Math.cos(i*2.4)*Math.sqrt(i-1)*.48),i<2?.4:.25),yaw:0,path:0}));trail=[];fleeing=recalling=false;nextFlee=8+Math.random()*4;}
 resetHerd();
 function start(){const p=player();if(!canStart()||!p.onFoot||!ready(home.x,home.z)||Math.hypot(p.x-home.x,p.z-home.z)>16)return;score.start(p);trail=[{x:p.x,z:p.z}];animals.forEach(a=>a.path=0);fleeing=recalling=false;nextFlee=8+Math.random()*4;toast('Turniata di San Vito: guida il gregge per 3 giri. Sprint e salti valgono punti!');}
 function call(){if(!score.state().active)return;shepherdWhistle();fleeing=false;recalling=true;nextFlee=8+Math.random()*4;animals.forEach(a=>{let best=Infinity;trail.forEach((p,i)=>{const d=Math.hypot(a.x-p.x,a.z-p.z);if(d<best){best=d;a.path=i;}});});toast('Lu muanz torna! Aspetta che il gregge si ricompatti.');}
 function cancel(){score.cancel();resetHerd();showActive(false);}
 startButton.onclick=start;$('.turn-call').onclick=call;$('.turn-exit').onclick=cancel;
 function update(dt){const p=player();clock+=dt;const visible=ready(home.x,home.z)&&Math.hypot(p.x-center.x,p.z-center.z)<200;herd.root.visible=visible;
  if(visible){
   bleatIn-=dt;
   if(bleatIn<=0){
    const sheep=animals[2+Math.floor(Math.random()*(animals.length-2))];
    playSheepBleat(Math.hypot(p.x-sheep.x,p.z-sheep.z));
    bleatIn=2.2+Math.random()*3.8;
   }
  }
  let s=score.state();startButton.hidden=!canStart()||s.active||!p.onFoot||!visible||Math.hypot(p.x-home.x,p.z-home.z)>16;showActive(s.active);
  if(!s.active){if(visible)herd.render(animals,height);return;}
  if(!p.onFoot||Math.hypot(p.x-center.x,p.z-center.z)>160){cancel();toast('Turniata interrotta: torna al gregge a piedi.');return;}
  nextFlee-=dt;if(nextFlee<=0&&!fleeing){fleeing=true;recalling=false;toast('Lu muanz sta scappando!');}
  const tail=trail.at(-1);if(Math.hypot(p.x-tail.x,p.z-tail.z)>.7){trail.push({x:p.x,z:p.z});if(trail.length>1200){trail.shift();animals.forEach(a=>a.path=Math.max(0,a.path-1));}}
  animals.forEach((a,i)=>{let target;
   if(fleeing&&(i<2||i%3===0)){const angle=i<2?i*1.3+clock*.15:i;target={x:a.x+Math.cos(angle)*12,z:a.z+Math.sin(angle)*12};}
   else {const lag=i<2?2+i*1.2:4.5+Math.floor((i-2)/4)*.55;let idx=trail.length-1,d=0;while(idx>0&&d<lag){d+=Math.hypot(trail[idx].x-trail[idx-1].x,trail[idx].z-trail[idx-1].z);idx--;}
    if(i>=2&&Math.hypot(a.x-animals[i%2].x,a.z-animals[i%2].z)>24){target=animals[i%2];}else{a.path=Math.min(a.path,idx);while(a.path<idx&&Math.hypot(a.x-trail[a.path].x,a.z-trail[a.path].z)<2)a.path++;target=trail[Math.min(a.path,idx)];if(i>=2&&a.path>=idx-2){const ahead=trail[Math.min(idx+1,trail.length-1)],behind=trail[Math.max(0,idx-1)],dx=ahead.x-behind.x,dz=ahead.z-behind.z,len=Math.hypot(dx,dz)||1,across=((i-2)%4-1.5)*.52;target={x:target.x+dz/len*across,z:target.z-dx/len*across};}}}
   const dx=target.x-a.x,dz=target.z-a.z,distance=Math.hypot(dx,dz),pace=fleeing?4.4:recalling?10.5:i<2?8.2:8.8;
   const stop=i<2?.55:.16;if(distance>stop+.05){const step=Math.min(pace*dt,distance-stop),nx=dx/distance,nz=dz/distance;const q=move(a.x,a.z,nx*step,nz*step,i<2?.4:.25);if(ready(q[0],q[1])){a.x=q[0];a.z=q[1];a.yaw=Math.atan2(nx,nz);}}
  });
  const together=animals.slice(0,2).every(a=>Math.hypot(a.x-p.x,a.z-p.z)<24);
  if(recalling&&together)recalling=false;
  const result=score.update(p,dt,together&&!fleeing,!!p.sprinting);s=score.state();
  $('.turn-score').textContent=`Giri ${s.laps}/3 · ${Math.min(99,Math.floor(Math.abs(s.winding)/(Math.PI*2)*100))}% · ${s.points} pt`;
  $('.turn-status').textContent=fleeing?'Lu manz scappa · richiamalo':!together?'In pausa · aspetta lu manz':!s.following?'Gira intorno alla chiesa':s.sprinting?'🔥 Sprint ×2':'';
  $('.turn-bonus').textContent=clock<bonusUntil?bonusText:'';
  if(result.lap)toast(`Giro ${s.laps}/3! +500 punti e bonus velocità.`);
  if(result.complete){showActive(false);onWin(s.points);}
  if(visible)herd.render(animals,height);
 }
 return {center,home,start,call,reset:cancel,update,jump(){const bonus=score.jump();if(bonus){bonusText=bonus===100?'+100 SALTO SPRINT!':'+50 SALTO!';bonusUntil=clock+1.5;}return bonus;},stats:()=>({...score.state(),center,home,fleeing,animals:animals.map(a=>({x:a.x,z:a.z}))})};
}
