import {needsLandscape,lockLandscape,requestGameFullscreen} from './orientation.js';
import {setIcon} from './ui-icons.js';
import {MOBILE} from './device-profile.js';
export function detectTouch(){return MOBILE||new URLSearchParams(location.search).has('mobile')||'ontouchstart'in window||navigator.maxTouchPoints>0||innerWidth<700;}
export function createControls(actions){
 const touch=detectTouch(),held=new Map(),counts=new Map(),joystick={x:0,y:0,active:false},state={touch,joystick,held:key=>(counts.get(key)||0)>0};document.body.classList.toggle('touch',touch);
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>actions[b.dataset.action]?.());
 const enter=document.querySelector('[data-action="enter"]');
 if(enter){enter.classList.add('vehicle-action');document.getElementById('touch-controls').append(enter);}
 for(const [selector,icon,label] of [['.descend','descend','Scendi con l’elicottero'],['.steering [data-hold="a"]','left','Sterza a sinistra'],['.steering [data-hold="d"]','right','Sterza a destra'],['#drop-bomb','bomb','Sgancia bomba'],['#audio','mute','Attiva audio']])setIcon(document.querySelector(selector),icon,label);
 if(touch){document.querySelector('[data-action="camera"]')?.remove();const preventGesture=e=>e.preventDefault();for(const event of ['gesturestart','gesturechange','gestureend'])document.addEventListener(event,preventGesture,{passive:false});const gameplay=e=>e.target instanceof Element&&!!e.target.closest('#game,#touch-controls');
 document.addEventListener('touchmove',e=>{if(gameplay(e)&&e.touches.length>1&&e.cancelable)e.preventDefault();},{capture:true,passive:false});
 // Pointer-driven controls need no synthetic click, which can trigger Safari double-tap zoom.
 document.addEventListener('touchend',e=>{if(gameplay(e)&&e.target.closest('#game,[data-hold],.move-zone')&&e.cancelable)e.preventDefault();},{capture:true,passive:false});
 document.addEventListener('dblclick',e=>{if(gameplay(e))e.preventDefault();},{capture:true,passive:false});}

 // Fire jump on initial contact; suppress the synthetic click after touch.
 const jumpButton=document.querySelector?.('[data-action="jump"]');if(jumpButton){let lastTouch=-Infinity;
 jumpButton.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();lastTouch=performance.now();actions.jump?.();},{passive:false});
 jumpButton.onclick=e=>{e.preventDefault();if(performance.now()-lastTouch>600)actions.jump?.();};}
 document.querySelectorAll('[data-hold]').forEach(b=>{const release=e=>{const key=held.get(e.pointerId);if(key){counts.set(key,Math.max(0,(counts.get(key)||0)-1));held.delete(e.pointerId);}if(!(counts.get(b.dataset.hold)>0))b.classList.remove('active');};b.onpointerdown=e=>{e.preventDefault();release(e);held.set(e.pointerId,b.dataset.hold);counts.set(b.dataset.hold,(counts.get(b.dataset.hold)||0)+1);b.classList.add('active');b.setPointerCapture(e.pointerId);if(b.dataset.hold==='fire')actions.fire?.();};b.onpointerup=b.onpointercancel=b.onlostpointercapture=release;});
 const stick=document.getElementById('joystick'),knob=document.getElementById('joystick-knob'),sprint=document.querySelector('[data-hold="shift"]');let pointer=null,originX=0,originY=0,radius=42,sprintArmed=false;
 const zone=document.createElement('div');zone.className='move-zone';stick.before(zone);zone.append(stick);
 if(touch&&sprint){sprint.classList.add('sprint-action');delete sprint.dataset.hold;sprint.onpointerdown=sprint.onpointerup=sprint.onpointercancel=sprint.onlostpointercapture=null;zone.after(sprint);sprint.setAttribute('aria-label','Sprint');sprint.title='Sprint: tocca per attivare o disattivare';sprint.onclick=()=>{sprintArmed=!sprintArmed;showSprint();};}
 function showSprint(){joystick.sprinting=sprintArmed;sprint?.setAttribute('aria-pressed',String(joystick.sprinting));zone.classList.toggle('sprinting',joystick.sprinting);}
 function move(e){
  if(e.pointerId!==pointer)return;
  const dx=e.clientX-originX,dy=e.clientY-originY,len=Math.hypot(dx,dy),fraction=Math.min(1,len/radius),mag=Math.max(0,(fraction-.12)/.88);
  joystick.x=dx/(len||1)*mag;joystick.y=dy/(len||1)*mag;
  knob.style.transform=`translate(${dx*Math.min(1,radius/(len||1))}px,${dy*Math.min(1,radius/(len||1))}px)`;
 }
 function release(e){if(e&&e.pointerId!==pointer)return;const id=pointer;pointer=null;if(id!==null&&zone.hasPointerCapture(id))zone.releasePointerCapture(id);joystick.x=joystick.y=0;joystick.active=false;sprintArmed=false;showSprint();knob.style.transform='';stick.style.left=stick.style.top='';zone.classList.remove('engaged');}
 zone.onpointerdown=e=>{if(pointer!==null||e.button!==0)return;e.preventDefault();const rect=zone.getBoundingClientRect();originX=e.clientX;originY=e.clientY;radius=stick.offsetWidth*.37;pointer=e.pointerId;joystick.active=true;stick.style.left=`${originX-rect.left}px`;stick.style.top=`${originY-rect.top}px`;zone.classList.add('engaged');zone.setPointerCapture(pointer);move(e);};
 zone.onpointermove=move;zone.onpointerup=zone.onpointercancel=zone.onlostpointercapture=release;
 const clear=()=>{actions.cancelFire?.();held.clear();counts.clear();release();document.querySelectorAll('[data-hold]').forEach(b=>b.classList.remove('active'));};window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
 const start=document.getElementById('mobile-start');start.hidden=!touch||document.body.dataset?.mobileLaunched==='true';
 const play=async()=>{start.hidden=true;await requestGameFullscreen({toggle:false});};document.getElementById('play-fullscreen').onclick=play;const rotateButton=document.getElementById('rotate-play');if(rotateButton)rotateButton.onclick=play;
 let wasPortrait=false;const isPortrait=()=>needsLandscape(touch,innerWidth,innerHeight),orientationChanged=()=>{clear();const portrait=isPortrait();document.body.classList.toggle('portrait-locked',portrait);if(portrait&&!wasPortrait)actions.pause?.();wasPortrait=portrait;};window.addEventListener('resize',orientationChanged);window.addEventListener('orientationchange',orientationChanged);document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement&&touch)void lockLandscape();orientationChanged();});document.addEventListener('webkitfullscreenchange',orientationChanged);orientationChanged();
 return {...state,clear,isPortrait,isPaused:()=>!start.hidden||isPortrait()};
}
