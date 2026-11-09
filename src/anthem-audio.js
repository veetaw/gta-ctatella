import {ANTHEM_MELODY,ANTHEM_DURATION,BEAT,LEAD_IN,pitchFrequency} from './anthem-score.js';
// An optional supplied asset is bundled only if it exists. No speculative URL requests.
const supplied=import.meta.glob('/assets/inno8bit.{mp3,mp4}',{eager:true,query:'?url',import:'default'});
export async function startAnthemAudio(){
 let context,master,source,stopped=false,paused=false,base=0,wallStart=performance.now()/1000,wallPause=0,pausedTotal=0;
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){context=new Audio();await context.resume();if(context.state!=='running')throw Error('Audio sospeso');master=context.createGain();master.gain.value=.24;master.connect(context.destination);}}catch{if(context)void context.close();context=null;}
 function tone(frequency,time,duration,type='square',volume=.24){const osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,time);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.005);gain.gain.setValueAtTime(volume,time+Math.max(.006,duration*.72));gain.gain.exponentialRampToValueAtTime(.001,time+duration);osc.connect(gain).connect(master);osc.start(time);osc.stop(time+duration+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
 let buffer=null;const asset=Object.values(supplied)[0];if(context&&asset){try{const response=await fetch(asset,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Audio non disponibile');buffer=await context.decodeAudioData(await response.arrayBuffer());}catch{/* Automatic zero-file synthesizer fallback. */}}
 base=(context?.currentTime||0)+.08;wallStart=performance.now()/1000+.08;
 if(context){for(let i=0;i<3;i++)tone(i===2?880:440,base+i*.5,.07,'triangle',.2);
  if(buffer){source=context.createBufferSource();source.buffer=buffer;source.playbackRate.value=buffer.duration/(ANTHEM_DURATION-LEAD_IN-.3);source.connect(master);source.start(base+LEAD_IN);source.stop(base+ANTHEM_DURATION);}
  else{for(const n of ANTHEM_MELODY)tone(pitchFrequency(n.pitch),base+n.time,Math.max(.03,n.duration*.88),'square',.24);
   const beats=Math.floor((ANTHEM_DURATION-LEAD_IN)/BEAT);for(let i=0;i<beats;i++){const chorus=i>=48,root=chorus?(i%8<4?'C3':'G2'):(i%16<8?'G2':'D3');tone(pitchFrequency(root),base+LEAD_IN+i*BEAT,BEAT*.7,'triangle',.35);if(i%2===0)tone(75,base+LEAD_IN+i*BEAT,.055,'square',.09);}}
 }
 return {available:!!context,duration:ANTHEM_DURATION,now(){if(context)return Math.max(0,context.currentTime-base);return Math.max(0,(paused?wallPause:performance.now()/1000)-wallStart-pausedTotal);},pause(){if(stopped||paused)return;paused=true;wallPause=performance.now()/1000;if(context)void context.suspend();},resume(){if(stopped||!paused)return;pausedTotal+=performance.now()/1000-wallPause;paused=false;if(context)void context.resume();},stop(){if(stopped)return;stopped=true;try{source?.stop();}catch{}if(context)void context.close();},get paused(){return paused;}};
}
