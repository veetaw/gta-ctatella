// Signed angular progress prevents back-and-forth motion from counting as a lap.
export function createTurneiaScore(center){
 let active=false,points=0,laps=0,winding=0,last=null,time=0,lapTime=0,jumpAt=-Infinity,following=false,moving=false,sprinting=false;
 const angle=p=>Math.atan2(p.z-center.z,p.x-center.x);
 const snapshot=()=>({active,points:Math.floor(points),laps,winding,following,moving,sprinting,time});
 return {state:snapshot,start(p){active=true;points=laps=winding=time=lapTime=0;jumpAt=-Infinity;last={...p};following=moving=sprinting=false;},cancel(){active=false;following=moving=sprinting=false;},
 update(p,dt,herdReady,sprint){
  if(!active)return {lap:false,complete:false};time+=dt;lapTime+=dt;
  const distance=last?Math.hypot(p.x-last.x,p.z-last.z):0,radius=Math.hypot(p.x-center.x,p.z-center.z);
  following=!!(p.onFoot&&herdReady&&radius>=1.5&&radius<=90);moving=following&&distance>.001&&distance<=9*dt+.1;sprinting=moving&&sprint;
  let lap=false,complete=false;
  if(moving){const delta=Math.atan2(Math.sin(angle(p)-angle(last)),Math.cos(angle(p)-angle(last)));
   if(Math.abs(delta)<.35){points+=distance*(sprinting?2:1);winding+=delta;
    if(Math.abs(winding)>=Math.PI*2-1e-5){winding-=Math.sign(winding)*Math.PI*2;laps++;points+=500+Math.max(0,Math.round((90-lapTime)*5));lapTime=0;lap=true;if(laps===3){active=false;complete=true;}}}
  }
  last={...p};return {lap,complete};
 },jump(){if(!active||!following||!moving||time-jumpAt<1.5)return 0;jumpAt=time;const bonus=sprinting?100:50;points+=bonus;return bonus;}};
}
