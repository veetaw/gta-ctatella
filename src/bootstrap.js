import {addHomeScreenHint,isStandalone} from './app-mode.js';
import './style.css';
import {requireGameLogin,signedInUser} from './login-gate.js';
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
 }
 const url=new URL(location.href);
 let mode=url.searchParams.get('mode');
 const testers=(import.meta.env.VITE_ONLINE_TESTER_IDS||'').split(',').map(id=>id.trim());
 const canPlayOnline=!!signedInUser?.id&&(testers.includes('*')||testers.includes(signedInUser.id));
 if(mode==='online'&&!canPlayOnline){
  url.searchParams.delete('mode');
  history.replaceState(null,'',url);
  mode=null;
 }
 if(MOBILE||canPlayOnline){
  const actions=canPlayOnline?'<div class="launch-actions"><button id="launch-play">Gioca</button><button id="launch-online">ONLINE</button></div>':'<button id="launch-play">Gioca</button>';
  const launch=document.createElement('section');launch.id='mobile-launch';launch.innerHTML='<div class="launch-content"><p class="login-eyebrow">SAN GREGORIO MAGNO</p><h1>GTA<br>CTATELLA</h1>'+actions+'</div>';document.body.append(launch);
  const standalone=isStandalone();addHomeScreenHint(launch.querySelector('.launch-content'));
  if(mode!=='online')await new Promise(resolve=>{
   for(const button of launch.querySelectorAll('button'))button.onclick=()=>{
    if(MOBILE&&!standalone)void requestGameFullscreen({toggle:false});
    if(button.id==='launch-online'&&canPlayOnline){url.searchParams.set('mode','online');history.replaceState(null,'',url);mode='online';}
    resolve();
   };
  });
  launch.remove();
  if(MOBILE){
   document.body.dataset.mobileLaunched='true';
   document.body.dataset.bootStarted=String(performance.now());
   // No fullscreen/rotation promise may hold up startup on iPhone Safari.
   document.getElementById('load-status').textContent='Caricamento del quartiere…';
  }
 }
 if(mode==='online'&&canPlayOnline)await import('./online-main.js');
 else await import('./main.js');
 releaseLaunchOrientation();
}
