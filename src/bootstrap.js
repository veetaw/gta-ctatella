import {addHomeScreenHint,isStandalone} from './app-mode.js';
import './style.css';
import {requireGameLogin} from './login-gate.js';
import {supabase} from './supabase.js';
import {MOBILE} from './device-profile.js';
import {needsLandscape,requestGameFullscreen} from './orientation.js';
import {showInstagramNotice} from './instagram-notice.js';

if(/\bInstagram\b/i.test(navigator.userAgent))showInstagramNotice();
else await startGame();

async function startGame(){
 await requireGameLogin();
 supabase?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.reload();});
 // Show a useful first screen before importing Three.js or allocating WebGL.
 let releaseLaunchOrientation=()=>{};
 if(MOBILE){
  document.body.classList.add('touch');
  const orientationChanged=()=>document.body.classList.toggle('portrait-locked',needsLandscape(true,innerWidth,innerHeight));
  window.addEventListener('resize',orientationChanged);window.addEventListener('orientationchange',orientationChanged);orientationChanged();
  document.getElementById('rotate-play').onclick=()=>void requestGameFullscreen({toggle:false});
  releaseLaunchOrientation=()=>{window.removeEventListener('resize',orientationChanged);window.removeEventListener('orientationchange',orientationChanged);};
  const launch=document.createElement('section');launch.id='mobile-launch';launch.innerHTML='<div class="launch-content"><p class="login-eyebrow">SAN GREGORIO MAGNO</p><h1>GTA<br>CTATELLA</h1><button id="launch-play">Gioca</button></div>';document.body.append(launch);const button=launch.querySelector('button');
  const standalone=isStandalone();addHomeScreenHint(launch.querySelector('.launch-content'));
  await new Promise(resolve=>button.addEventListener('click',()=>{if(!standalone)void requestGameFullscreen({toggle:false});resolve();},{once:true}));document.body.dataset.mobileLaunched='true';document.body.dataset.bootStarted=String(performance.now());launch.remove();
  // No fullscreen/rotation promise may hold up startup on iPhone Safari.
  document.getElementById('load-status').textContent='Caricamento del quartiere…';
 }
 await import('./main.js');
 releaseLaunchOrientation();
}
