// Opening eight bars of Mozart's Marsch der Priester (Die Zauberflöte, K. 620).
// Flute and cello from the public-domain Mutopia score:
// https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=260
// Entries pair MIDI pitch with duration in sixteenths. Pitch 0 is a rest.
const lead=[
 [81,8],[84,8], [77,8],[0,4],[77,4],
 [79,4],[81,4],[82,4],[86,4], [84,6],[82,2],[81,8],
 [79,8],[84,6],[88,2], [77,6],[81,2],[86,6],[83,2],
 [84,3],[83,1],[81,3],[86,1],[84,4],[83,4], [83,8],[84,4],[0,4],
];
const bass=[
 [53,8],[48,8], [50,8],[0,4],[45,4],
 [46,4],[48,4],[50,4],[53,4], [52,4],[48,4],[53,8],
 [48,12],[45,4], [50,8],[47,4],[43,4],
 [45,4],[41,4],[43,4],[43,4], [48,12],[0,4],
];
const rate=22050,step=60/96/4,totalSteps=128;

function renderVoice(data,notes,oscillator,volume,transpose=0){
 let position=0;
 for(const [pitch,duration] of notes){
  const start=Math.round(position*step*rate);
  position+=duration;
  const end=Math.min(data.length,Math.round(position*step*rate));
  if(!pitch)continue;
  const frequency=440*2**((pitch+transpose-69)/12),length=(end-start)/rate;
  const release=Math.min(.06,length*.25);
  for(let i=start;i<end;i++){
   const local=(i-start)/rate,phase=local*frequency%1;
   const envelope=Math.min(1,local/.012,(length-local)/release);
   data[i]+=oscillator(phase)*volume*envelope;
  }
 }
}

export function makeMarchBuffer(context){
 const buffer=context.createBuffer(1,Math.round(rate*totalSteps*step),rate);
 const data=buffer.getChannelData(0);
 renderVoice(data,lead,phase=>phase<.32?.68:-.32,.44,-12);
 renderVoice(data,bass,phase=>1-4*Math.abs(phase-.5),.21);
 let seed=8191;
 for(let i=0;i<data.length;i++){
  const beat=i/(rate*step*4),local=(beat%1)*step*4;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  data[i]+=(seed/4294967296*2-1)*Math.exp(-local*54)*(Math.floor(beat)%2?.17:.065);
 }
 return buffer;
}
