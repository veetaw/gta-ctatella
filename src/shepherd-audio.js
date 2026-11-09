let context;
export function shepherdWhistle(){
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context??=new Audio();void context.resume();const t=context.currentTime,osc=context.createOscillator(),gain=context.createGain(),vibrato=context.createOscillator(),depth=context.createGain();
 osc.type='sine';osc.frequency.setValueAtTime(1800,t);osc.frequency.exponentialRampToValueAtTime(2650,t+.12);osc.frequency.linearRampToValueAtTime(2300,t+.36);osc.frequency.linearRampToValueAtTime(2800,t+.55);osc.frequency.linearRampToValueAtTime(1800,t+.8);
 vibrato.frequency.value=19;depth.gain.value=32;vibrato.connect(depth).connect(osc.frequency);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.16,t+.025);gain.gain.setValueAtTime(.13,t+.63);gain.gain.exponentialRampToValueAtTime(.001,t+.86);osc.connect(gain).connect(context.destination);osc.start(t);vibrato.start(t);osc.stop(t+.9);vibrato.stop(t+.9);osc.onended=()=>{osc.disconnect();gain.disconnect();vibrato.disconnect();depth.disconnect();};
 }catch(error){console.warn('Fischio non disponibile',error);}
}
