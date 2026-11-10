import {makeMarchBuffer} from './procession-march.js';
import {setIcon} from './ui-icons.js';
import {ENGINE_PROFILES} from './powertrain.js';
let context,master,filter,analyser,samples,idle,loaded,enabled=readAudioPreference(),loadTask,lastError=null;
function readAudioPreference(){try{return localStorage.getItem('sgm-audio')!=='off';}catch{return true;}}
function saveAudioPreference(){try{localStorage.setItem('sgm-audio',enabled?'on':'off');}catch{}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function status(){const button=document.getElementById('audio');if(button){button.setAttribute('aria-pressed',String(enabled));setIcon(button,enabled?'volume':'mute',enabled?'Disattiva suono':'Attiva suono');}document.documentElement.dataset.audio=JSON.stringify({enabled,state:context?.state||'idle',loaded:!!idle,error:lastError});}
function seamless(buffer){const fade=Math.min(Math.floor(buffer.sampleRate*.025),Math.floor(buffer.length/8)),length=buffer.length-fade,out=context.createBuffer(buffer.numberOfChannels,length,buffer.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++){const a=buffer.getChannelData(c),b=out.getChannelData(c);for(let i=0;i<length;i++){const t=clamp((i-(length-fade))/fade,0,1);b[i]=a[i+fade]*(1-t)+a[Math.max(0,i-(length-fade))]*t;}}return out;}
async function loadLoops(){if(loadTask)return loadTask;loadTask=Promise.all(['engine-idle','engine-load'].map(async name=>{const r=await fetch(`/audio/${name}.wav`);if(!r.ok)throw Error(`Audio ${r.status}`);const decoded=await context.decodeAudioData(await r.arrayBuffer()),source=context.createBufferSource(),gain=context.createGain();source.buffer=seamless(decoded);source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(filter);source.start();return {source,gain};})).then(([a,b])=>{idle=a;loaded=b;status();}).catch(e=>{lastError=e.message;loadTask=null;status();});return loadTask;}
export function unlockEngineAudio(){try{
 try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
 if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;context=new Audio();master=context.createGain();master.gain.value=0;const compressor=context.createDynamicsCompressor();compressor.threshold.value=-10;compressor.ratio.value=2.5;analyser=context.createAnalyser();analyser.fftSize=256;samples=new Float32Array(analyser.fftSize);master.connect(compressor);compressor.connect(analyser);analyser.connect(context.destination);filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1600;filter.Q.value=.45;filter.connect(master);context.addEventListener('statechange',status);}
 enabled=true;context.resume()?.catch(()=>status());void loadLoops();void loadWeaponAudio();status();return true;
 }catch{enabled=false;status();return false;}}
export function toggleEngineAudio(){if(enabled){enabled=false;silenceEngineAudio();status();saveAudioPreference();return true;}const result=unlockEngineAudio();saveAudioPreference();return result;}
export function resumeEngineAudio(){if(enabled&&context&&context.state!=='running')context.resume()?.catch(()=>status());}
export function silenceEngineAudio(){walkDistance=0;if(teglieGain)teglieGain.gain.setTargetAtTime(0,context.currentTime,.06);if(windGain)windGain.gain.setTargetAtTime(0,context.currentTime,.08);if(sirenGain)sirenGain.gain.setTargetAtTime(0,context.currentTime,.04);if(marchGain)marchGain.gain.setTargetAtTime(0,context.currentTime,.04);if(master){master.gain.cancelScheduledValues(context.currentTime);master.gain.setValueAtTime(0,context.currentTime);}}
let rpm=0,gear='N';
export function updateEngineAudio(car,onFoot){if(!context)return;const now=context.currentTime;if(!enabled||onFoot||document.hidden||car.spec.id==='helicopter'){master.gain.setTargetAtTime(0,now,.04);return;}if(!idle||!loaded)return;
 const p=ENGINE_PROFILES[car.spec.id]||ENGINE_PROFILES.panda;rpm=car.engineRPM??p.idle;gear=car.speed<-.1?'R':Math.abs(car.speed)<.1?'N':car.driveGear||1;const throttle=Math.abs(car.throttle||0),blend=clamp((rpm-p.idle-200)/2400,0,1),cut=car.shiftRemaining>0?.28:1;
 idle.source.playbackRate.setTargetAtTime(clamp(rpm/1200,.6,2.2)*p.tone,now,.045);loaded.source.playbackRate.setTargetAtTime(clamp(rpm/3500,.55,2.7)*p.tone,now,.045);
 idle.gain.gain.setTargetAtTime(Math.cos(blend*Math.PI/2)*(.48+.12*throttle),now,.04);loaded.gain.gain.setTargetAtTime(Math.sin(blend*Math.PI/2)*(.34+.36*throttle),now,.04);filter.frequency.setTargetAtTime(950+rpm*.2+throttle*900,now,.06);master.gain.setTargetAtTime(.38*cut,now,.025);
}
export function engineAudioDiagnostics(){if(!context)return {enabled,state:'idle',rms:0};analyser.getFloatTimeDomainData(samples);let energy=0;for(const v of samples)energy+=v*v;return {enabled,state:context.state,loaded:!!idle,rms:Math.sqrt(energy/samples.length),rpm,gear,error:lastError};}
let windGain,footstep,walkDistance=0;
function wakeAudio(event){
 if(!enabled||event.target?.closest?.('#audio'))return;
 if(context)resumeEngineAudio();else unlockEngineAudio();
}
if(typeof document!=='undefined'){
 document.addEventListener('pointerdown',wakeAudio,{passive:true});
 document.addEventListener('click',wakeAudio,{passive:true});
 document.addEventListener('keydown',wakeAudio);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)silenceEngineAudio();});
 status();
}
export function updateWorldAudio(dt,{playing,walkSpeed,onFoot}){
 if(!enabled||context?.state!=='running'||document.hidden)return;
 const now=context.currentTime;
 if(!windGain&&playing){
  const length=context.sampleRate*4,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
  let noise=0;
  for(let i=0;i<length;i++){
   const t=i/length;noise=noise*.97+(Math.random()*2-1)*.03;
   data[i]=noise*(.55+.25*Math.sin(t*4*Math.PI)) * Math.min(1,t*50,(1-t)*50);
  }
  const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
  windGain=context.createGain();windGain.gain.value=0;source.connect(windGain).connect(analyser);source.start();
 }
 windGain?.gain.setTargetAtTime(playing?(onFoot?.10:.045):0,now,.25);
 if(!playing||walkSpeed<.25){walkDistance=0;return;}
 walkDistance+=walkSpeed*dt;
 const stride=walkSpeed>3.4?1.25:.78;
 if(walkDistance<stride)return;
 walkDistance%=stride;
 if(!footstep){
  const duration=.19,length=Math.ceil(context.sampleRate*duration);
  footstep=context.createBuffer(1,length,context.sampleRate);
  const data=footstep.getChannelData(0);
  let noise=0,low=0;
  for(let i=0;i<length;i++){
   const t=i/length;
   noise+=.24*(Math.random()*2-1-noise);low+=.035*(noise-low);
   const contact=Math.sin(Math.PI*t)**2;
   data[i]=(noise-low)*contact;
  }
 }
 const source=context.createBufferSource(),gain=context.createGain();
 source.buffer=footstep;source.playbackRate.value=.88+Math.random()*.22;gain.gain.value=walkSpeed>3.4?.075:.046;
 source.connect(gain).connect(analyser);source.start();
 source.onended=()=>{source.disconnect();gain.disconnect();};
}

let sheepBleat;
export function playSheepBleat(distance){
 if(!enabled||context?.state!=='running'||document.hidden||distance>=32)return;
 if(!sheepBleat){
  const rate=context.sampleRate,duration=.79;
  sheepBleat=context.createBuffer(1,Math.ceil(rate*duration),rate);
  const data=sheepBleat.getChannelData(0);
  let phase=0;
  for(let i=0;i<data.length;i++){
   const t=i/rate,progress=t/duration;
   const frequency=275+85*Math.sin(Math.PI*progress)-50*progress+14*Math.sin(2*Math.PI*7*t);
   phase+=2*Math.PI*frequency/rate;
   const envelope=Math.min(1,t/.09)*Math.max(0,1-progress)**.7;
   const tremolo=.72+.28*Math.sin(2*Math.PI*8*t);
   data[i]=envelope*tremolo*(.24*Math.sin(phase)+.43*Math.sin(2*phase)+.19*Math.sin(3*phase)+.09*Math.sin(5*phase));
  }
 }
 const source=context.createBufferSource(),gain=context.createGain();
 source.buffer=sheepBleat;source.playbackRate.value=.86+Math.random()*.26;
 gain.gain.value=.17*(1-distance/32)**1.5;
 source.connect(gain).connect(analyser);source.start();
 source.onended=()=>{source.disconnect();gain.disconnect();};
}

export function playBombSound(){if(!enabled||!context||document.hidden)return;const now=context.currentTime,duration=.48,buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);let low=0;for(let i=0;i<data.length;i++){const t=i/context.sampleRate;low=low*.88+(Math.random()*2-1)*.12;data[i]=(low*.8+Math.sin(2*Math.PI*(72*t-40*t*t))*.3)*Math.exp(-t*11);}const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.32;source.connect(gain);gain.connect(analyser);source.start(now);source.onended=()=>{source.disconnect();gain.disconnect();};}

const weaponSamples=new Map();
async function loadWeaponAudio(){
 await Promise.all(['pistol-shot','pistol-reload'].map(async name=>{
  if(weaponSamples.has(name))return;
  try{const response=await fetch(`/audio/${name}.wav`);if(response.ok)weaponSamples.set(name,await context.decodeAudioData(await response.arrayBuffer()));}catch{}
 }));
}
function playWeapon(name,volume,rate=1,cutoff=0){
 if(!enabled||context?.state!=='running'||document.hidden)return;
 const buffer=weaponSamples.get(name);if(!buffer)return;
 const source=context.createBufferSource(),gain=context.createGain(),tone=cutoff?context.createBiquadFilter():null;
 source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=volume;
 if(tone){tone.type='lowpass';tone.frequency.value=cutoff;source.connect(tone);tone.connect(gain);}else source.connect(gain);
 gain.connect(analyser);source.start();source.onended=()=>{source.disconnect();tone?.disconnect();gain.disconnect();};
}
export function playGunSound(enemy=false,distance=0,weapon='pistol'){
 playWeapon('pistol-shot',enemy?.31/(1+distance/12):weapon==='shotgun'?.55:.43,(weapon==='shotgun'?.71:weapon==='smg'?1.16:.96)+Math.random()*.08,enemy?2600:0);
}
export function playReloadSound(){playWeapon('pistol-reload',.27);}

let marchSource,marchGain;
export function updateProcessionMarch(distance){
 const volume=enabled&&context?.state==='running'&&!document.hidden ? .18*Math.max(0,1-distance/65)**1.7:0;
 if(!marchSource&&volume>0){
  marchSource=context.createBufferSource();marchSource.buffer=makeMarchBuffer(context);marchSource.loop=true;
  marchGain=context.createGain();marchGain.gain.value=0;
  marchSource.connect(marchGain).connect(analyser);marchSource.start();
 }
 if(marchGain)marchGain.gain.setTargetAtTime(volume,context.currentTime,.1);
}
export function playTrafficHorn(distance){
 if(!enabled||context?.state!=='running'||document.hidden||distance>42)return;
 const now=context.currentTime,gain=context.createGain();
 gain.gain.value=0;gain.gain.linearRampToValueAtTime(.052*(1-distance/42),now+.025);
 gain.gain.setTargetAtTime(0,now+.16,.036);gain.connect(analyser);
 for(const frequency of [365,442]){
  const tone=context.createOscillator();tone.type='triangle';tone.frequency.value=frequency;tone.connect(gain);tone.start(now);tone.stop(now+.32);
 }
 setTimeout(()=>gain.disconnect(),370);
}

let sirenSource,sirenGain;
export function updatePatrolSiren(distance){
 const volume=enabled&&context?.state==='running'&&!document.hidden ? .19*Math.max(0,1-distance/170)**1.25:0;
 if(!sirenSource&&volume>0){
  const length=context.sampleRate*2,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
  let phase=0;
  for(let i=0;i<length;i++){
   const t=i/context.sampleRate,frequency=690+250*Math.sin(Math.PI*t);
   phase+=2*Math.PI*frequency/context.sampleRate;
   data[i]=.68*Math.sin(phase)+.16*Math.sin(3*phase);
  }
  sirenSource=context.createBufferSource();sirenSource.buffer=buffer;sirenSource.loop=true;
  sirenGain=context.createGain();sirenGain.gain.value=0;
  sirenSource.connect(sirenGain).connect(analyser);sirenSource.start();
 }
 if(sirenGain)sirenGain.gain.setTargetAtTime(volume,context.currentTime,.12);
}


let teglieGain,teglieMotor;
export function updateTeglieEngine(distance,speed){
 if(!context)return;
 const now=context.currentTime;
 const gain=enabled&&!document.hidden&&context.state==='running'?.14*Math.max(0,1-distance/95)**1.4:0;
 if(gain>0&&!teglieMotor){
  teglieMotor=context.createOscillator();teglieMotor.type='sawtooth';
  const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=420;
  teglieGain=context.createGain();teglieGain.gain.value=0;
  teglieMotor.connect(filter).connect(teglieGain).connect(analyser);teglieMotor.start();
 }
 if(teglieGain){
  teglieMotor.frequency.setTargetAtTime(36+speed*2.7,now,.1);
  teglieGain.gain.setTargetAtTime(gain,now,.12);
 }
}
