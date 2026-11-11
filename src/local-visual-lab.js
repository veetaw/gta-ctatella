import {graphicsMode,hqEnabled,restartWithGraphics} from './graphics-mode.js';
import {setVehicleQuality,vehicleVisualStats} from './vehicle-visuals.js';
import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {AVATAR_DEFAULTS,normalizeAppearance} from './avatar-appearance.js';
import {readAvatarProfile,saveAvatarProfile} from './avatar-profile.js';
import './local-visual-lab.css';

export async function installVisualLab(context){
 const {renderer,animateAvatar,person,clearInput,mobile}=context;let maxRendering=null,busy=false,previewRenderer,previewScene,previewCamera,previewAvatar,raf=0,disposed=false,appearanceRevision=0;
 const button=document.createElement('button');button.id='visual-settings';button.type='button';button.title='Impostazioni';button.setAttribute('aria-label','Impostazioni');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 3.5 10 1.8h4l.8 1.7 1.8 1 1.9-.2 2 3.4-1.1 1.6v2.1l1.1 1.6-2 3.4-1.9-.2-1.8 1-.8 1.7h-4l-.8-1.7-1.8-1-1.9.2-2-3.4 1.1-1.6V9.3L3.5 7.7l2-3.4 1.9.2z" transform="translate(0 1)"/><circle cx="12" cy="11.5" r="3"/></svg>';button.setAttribute('aria-haspopup','dialog');document.querySelector('.utility').prepend(button);
 const dialog=document.createElement('dialog');dialog.id='visual-lab';dialog.setAttribute('aria-labelledby','visual-lab-title');
 dialog.innerHTML=`<header><div><p class="visual-eyebrow">CTATELLA · IMPOSTAZIONI</p><h2 id="visual-lab-title">Grafica e personaggio</h2></div><button type="button" class="visual-close" aria-label="Chiudi impostazioni">×</button></header>
 <div class="visual-layout"><div class="visual-options"><fieldset><legend>Qualità grafica</legend>
 <label class="visual-mode"><input type="radio" name="graphics" value="normal" checked><span><strong>Normale</strong><small>La grafica attuale.</small></span></label>
 <label class="visual-mode"><input type="radio" name="graphics" value="max"><span><strong>Max</strong><small>Resa cinematografica, avatar e veicoli HQ.</small></span></label>
 <p class="visual-note">Il cambio modalità riavvia il gioco. Max scarica i contenuti HQ e richiede più risorse GPU.${mobile?' Su mobile: luci limitate, ombre disattivate.':''}</p></fieldset>
 <fieldset><legend>Il tuo avatar</legend>
 <label class="visual-field">Personaggio<select name="variant"><option value="male">Iucc</option><option value="female">Vtella</option></select></label>
 <div class="visual-colors">${[['shirt','Maglia'],['trousers','Pantaloni'],['hair','Capelli'],['skin','Carnagione']].map(([key,label])=>`<label>${label}<input type="color" name="${key}" value="${AVATAR_DEFAULTS[key]}" disabled></label>`).join('')}</div>
 <p class="visual-note">In Max puoi personalizzare i colori del tuo personaggio.</p></fieldset></div>
 <section class="visual-preview" aria-label="Anteprima avatar"><div class="visual-canvas"></div><label class="visual-field">Ruota avatar<input name="rotation" type="range" min="-180" max="180" value="15"></label><p>Il tuo aspetto è condiviso tra gioco offline e online.</p></section></div>
 <p class="visual-status" role="status" aria-live="polite">Normale · rendering originale</p><footer><button type="button" class="visual-reset">Ripristina</button><button type="button" class="visual-done">Torna al gioco</button></footer><button type="button" class="visual-credits">Attribuzioni dei modelli</button><section class="visual-credits-text" hidden><p>Ferrari 458 Italia — vicent091036 · <a href="https://threejs.org/examples/webgl_materials_car.html" target="_blank" rel="noopener">Fonte</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Modello adattato e ottimizzato.</p><p>Corvette C1 — sharingan · <a href="https://sketchfab.com/3d-models/507ee2e6d6a34a3db7bf8373c70fecff" target="_blank" rel="noopener">Fonte</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Modello adattato e ottimizzato.</p><p>Personaggio base: Kenney · CC0. Dettagli HQ e personalizzazione: Ctatella.</p></section>`;
 document.body.append(dialog);const status=dialog.querySelector('.visual-status'),field=name=>dialog.querySelector(`[name="${name}"]`);
 let appearance=readAvatarProfile(context.user);
 appearance.quality=hqEnabled?'hq':'original';
 const editableKeys=['variant','shirt','trousers','hair','skin'];for(const key of editableKeys)field(key).value=appearance[key];
 dialog.querySelector(`[name=graphics][value=${graphicsMode}]`).checked=true;
 dialog.querySelector('.visual-credits').onclick=()=>{dialog.querySelector('.visual-credits-text').hidden=!dialog.querySelector('.visual-credits-text').hidden;};
 const notify=text=>status.textContent=text;
 function syncColors(){for(const key of ['shirt','trousers','hair','skin'])field(key).disabled=!hqEnabled;}syncColors();
 async function applyAppearance(){
  const revision=++appearanceRevision;
  appearance=normalizeAppearance({quality:hqEnabled?'hq':'original',...Object.fromEntries(editableKeys.map(k=>[k,field(k).value]))});syncColors();
  try{await animateAvatar.customize(appearance,renderer);if(revision!==appearanceRevision)return;context.onAppearanceChange?.(appearance);refreshPreview();await saveAvatarProfile(context.user,appearance);if(revision!==appearanceRevision)return;notify(appearance.quality==='hq'?'Ctatella HQ · aspetto aggiornato':'Avatar originale · aspetto aggiornato');}catch(error){if(revision===appearanceRevision)notify(error.message||'Avatar non aggiornato. Riprova.');console.error(error);}
 }
 for(const key of editableKeys)field(key).addEventListener('change',applyAppearance);
 async function activateMax(){
  const {createMaxRendering}=await import('./max-rendering.js');
  await Promise.all([setVehicleQuality('hq'),import('./avatar-hq.js')]);
  maxRendering=createMaxRendering(context);maxRendering.enable();
  appearance.quality='hq';await animateAvatar.customize(appearance,renderer);
  notify('Max · grafica, avatar e veicoli HQ');
 }
 async function setMode(mode){if(busy||mode===graphicsMode)return;busy=true;notify('Riavvio del gioco…');clearInput();try{restartWithGraphics(mode);}catch(error){busy=false;notify('Impossibile salvare la modalità grafica.');dialog.querySelector(`[name=graphics][value=${graphicsMode}]`).checked=true;}}
 dialog.querySelectorAll('[name="graphics"]').forEach(r=>r.addEventListener('change',()=>void setMode(r.value)));
 function refreshPreview(){if(!previewScene||!animateAvatar.ready())return;previewAvatar?.removeFromParent();previewAvatar=clone(person.root);previewAvatar.visible=true;previewAvatar.position.set(0,0,0);previewAvatar.rotation.set(0,0,0);previewAvatar.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});previewScene.add(previewAvatar);}
 function preview(){
  if(!dialog.open)return;
  if(!previewAvatar&&animateAvatar.ready())refreshPreview();
  if(previewAvatar)previewAvatar.rotation.y=THREE.MathUtils.degToRad(Number(field('rotation').value));
  const box=dialog.querySelector('.visual-canvas'),width=box.clientWidth,height=box.clientHeight;
  if(width&&height){if(previewRenderer.domElement.width!==Math.floor(width*previewRenderer.getPixelRatio())||previewRenderer.domElement.height!==Math.floor(height*previewRenderer.getPixelRatio())){previewRenderer.setSize(width,height);previewCamera.aspect=width/height;previewCamera.updateProjectionMatrix();}previewRenderer.render(previewScene,previewCamera);}
  raf=requestAnimationFrame(preview);
 }
 function open(){
  if(dialog.open)return;
  clearInput();dialog.showModal();
  try{previewRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;previewRenderer.toneMappingExposure=1;
   dialog.querySelector('.visual-canvas').append(previewRenderer.domElement);previewScene=new THREE.Scene();previewScene.add(new THREE.HemisphereLight('#d5e4fa','#675142',2));const key=new THREE.DirectionalLight('#ffdbb2',3);key.position.set(2,4,3);previewScene.add(key);const rim=new THREE.DirectionalLight('#a1bce7',2);rim.position.set(-2,2,-3);previewScene.add(rim);previewCamera=new THREE.PerspectiveCamera(35,1,.1,20);previewCamera.position.set(0,1.05,3.8);previewCamera.lookAt(0,1,0);refreshPreview();preview();
  }catch(error){notify('Anteprima non disponibile; puoi comunque modificare il personaggio.');console.warn(error);}
 }
 function close(){dialog.close();}
 button.onclick=open;dialog.querySelector('.visual-close').onclick=close;dialog.querySelector('.visual-done').onclick=close;
 dialog.addEventListener('close',()=>{cancelAnimationFrame(raf);previewRenderer?.dispose();previewRenderer?.forceContextLoss();previewRenderer?.domElement.remove();previewRenderer=null;previewScene=null;previewAvatar=null;clearInput();button.focus();});
 dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}});
 dialog.querySelector('.visual-reset').onclick=async()=>{if(busy)return;appearance=normalizeAppearance({...AVATAR_DEFAULTS,variant:context.initialVariant});for(const key of editableKeys)field(key).value=appearance[key];await applyAppearance();};
 if(hqEnabled){try{await activateMax();}catch(error){console.error('Max non disponibile',error);restartWithGraphics('normal');}}
 else await animateAvatar.customize(appearance,renderer);
 window.addEventListener('pagehide',()=>{disposed=true;maxRendering?.dispose();},{once:true});
 return {get open(){return dialog.open;},get max(){return !!maxRendering?.active;},render(dt){maxRendering.render(dt);},setMode,appearance:()=>({...appearance}),setVehicleQuality,vehicleStats:vehicleVisualStats,stats:()=>maxRendering?.stats()||{active:false,lamps:0,lightBudget:0,postprocessing:false}};
}
