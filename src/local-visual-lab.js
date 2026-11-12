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
 const regions=[['shirt','Maglia'],['trousers','Pantaloni'],['hair','Capelli'],['skin','Pelle']];
 const palettes={shirt:['#7d2948','#236c9e','#28352b','#eee9dc','#242b33','#c05235','#807145','#76658a'],trousers:['#292d35','#3b4f63','#56616a','#b3a287','#414d38','#161b21','#7b6550','#c4c1b9'],hair:['#171717','#302722','#563b2a','#805034','#b18b54','#d2b77f','#88857d','#dfd9ca'],skin:['#f0c5a7','#ed9875','#cf916a','#b77b56','#966244','#754a35','#553729','#39271f']};
 let region='shirt';
 dialog.innerHTML=`<header><div><p class="visual-eyebrow">CTATELLA</p><h2 id="visual-lab-title">IMPOSTAZIONI</h2></div><button type="button" class="visual-close" aria-label="Chiudi impostazioni">×</button></header>
 <div class="visual-layout"><div class="visual-options">
 <fieldset class="visual-setting-row"><legend>GRAFICA</legend><div class="visual-segments"><label><input type="radio" name="graphics" value="normal" checked><span>Normale</span></label><label><input type="radio" name="graphics" value="max"><span>Max <small>HQ</small></span></label></div></fieldset>
 <p class="visual-note visual-mode-note">Il cambio grafica riavvia il gioco.</p>
 <fieldset class="visual-setting-row"><legend>PERSONAGGIO</legend><input type="hidden" name="variant"><div class="visual-segments"><button type="button" data-variant="male">Iucc</button><button type="button" data-variant="female">Vtella</button></div></fieldset>
 <fieldset class="visual-wardrobe"><legend>PERSONALIZZA</legend><div class="visual-regions" role="group" aria-label="Parte da personalizzare">${regions.map(([key,label])=>`<button type="button" data-region="${key}"><i aria-hidden="true"></i>${label}</button><input type="hidden" name="${key}">`).join('')}</div><div class="visual-palette" role="group" aria-label="Colori maglia"></div></fieldset>
 <p class="visual-note visual-sync-note">Il tuo stile, anche online.</p></div>
 <section class="visual-preview" aria-label="Anteprima avatar"><div class="visual-canvas"></div><label class="visual-rotation"><span>RUOTA</span><input name="rotation" type="range" min="-180" max="180" value="15" aria-label="Ruota avatar"></label></section>
 <section class="visual-credits-text" hidden><p>Ferrari 458 Italia — vicent091036 · <a href="https://threejs.org/examples/webgl_materials_car.html" target="_blank" rel="noopener">Fonte</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Adattato e ottimizzato.</p><p>Corvette C1 — sharingan · <a href="https://sketchfab.com/3d-models/507ee2e6d6a34a3db7bf8373c70fecff" target="_blank" rel="noopener">Fonte</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Adattato e ottimizzato.</p><p>Personaggio base: Kenney · CC0.<br>Dettagli HQ e personalizzazione: Ctatella.</p></section></div>
 <footer><div class="visual-footer-info"><p class="visual-status" role="status" aria-live="polite">${hqEnabled?'Max · HQ attivo':'Normale · grafica originale'}</p><button type="button" class="visual-credits">Attribuzioni modelli</button></div><button type="button" class="visual-reset" aria-label="Ripristina il personaggio">Reset</button><button type="button" class="visual-done">RIPRENDI</button></footer>`;
 document.body.append(dialog);const status=dialog.querySelector('.visual-status'),field=name=>dialog.querySelector(`[name="${name}"]`);
 let appearance=readAvatarProfile(context.user);
 appearance.quality=hqEnabled?'hq':'original';
 const editableKeys=['variant','shirt','trousers','hair','skin'];for(const key of editableKeys)field(key).value=appearance[key];
 dialog.querySelector(`[name=graphics][value=${graphicsMode}]`).checked=true;
 dialog.querySelector('.visual-credits').onclick=()=>{const show=dialog.dataset.view!=='credits';dialog.dataset.view=show?'credits':'settings';dialog.querySelector('.visual-credits-text').hidden=!show;dialog.querySelector('.visual-credits').textContent=show?'Torna alle impostazioni':'Attribuzioni modelli';};
 const notify=text=>status.textContent=text;
 function syncColors(){
  for(const [key] of regions){const tab=dialog.querySelector(`[data-region="${key}"]`);tab.setAttribute('aria-pressed',String(key===region));tab.querySelector('i').style.background=appearance[key];}
  dialog.querySelectorAll('[data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.variant===appearance.variant)));
  const palette=dialog.querySelector('.visual-palette'),wasFocused=palette.contains(document.activeElement);
  const colors=[...palettes[region]];if(!colors.includes(appearance[region]))colors[colors.length-1]=appearance[region];
  const label=regions.find(([key])=>key===region)[1];palette.setAttribute('aria-label',`Colori ${label.toLowerCase()}`);
  palette.innerHTML=colors.map((color,i)=>`<button type="button" data-color="${color}" style="--swatch:${color}" aria-label="${label}: colore ${i+1}, ${color}" aria-pressed="${color===appearance[region]}"><span aria-hidden="true">${color===appearance[region]?'✓':''}</span></button>`).join('');
  if(wasFocused)palette.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
 }
 dialog.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{region=b.dataset.region;syncColors();});
 dialog.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>{field('variant').value=b.dataset.variant;void applyAppearance();});
 dialog.querySelector('.visual-palette').onclick=e=>{const swatch=e.target.closest('[data-color]');if(!swatch)return;field(region).value=swatch.dataset.color;void applyAppearance();};
 syncColors();
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
 async function setMode(mode){if(busy||mode===graphicsMode)return;busy=true;notify('Salvataggio e riavvio del gioco…');clearInput();try{await context.beforeReload?.();restartWithGraphics(mode);}catch(error){busy=false;notify('Impossibile salvare la modalità grafica.');dialog.querySelector(`[name=graphics][value=${graphicsMode}]`).checked=true;}}
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
  clearInput();dialog.dataset.view='settings';dialog.querySelector('.visual-credits-text').hidden=true;dialog.querySelector('.visual-credits').textContent='Attribuzioni modelli';dialog.showModal();
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
