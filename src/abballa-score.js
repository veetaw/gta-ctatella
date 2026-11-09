export const PERFECT_WINDOW=.075,GOOD_WINDOW=.17;
export function createAbballaScore(chart,duration){
 const notes=chart.map(n=>({...n,judgement:null}));let points=0,combo=0,maxCombo=0,misses=0,perfect=0,good=0,ended=false,time=0;
 const multiplier=()=>combo>=20?4:combo>=8?2:1;
 const state=()=>({points,combo,maxCombo,misses,perfect,good,multiplier:multiplier(),ended,time});
 function miss(note){if(note)note.judgement='miss';combo=0;misses++;return {label:'MANCATO',points:0,good:false};}
 function update(now){if(ended)return [];time=Math.max(time,now);const lost=[];for(const note of notes)if(!note.judgement&&time>note.time+GOOD_WINDOW){miss(note);lost.push(note);}if(time>=duration)ended=true;return lost;}
 return {notes,state,update,hit(lane,now){if(ended||now<0||now>=duration)return null;update(now);const note=notes.filter(n=>!n.judgement&&n.lane===lane&&Math.abs(n.time-now)<=GOOD_WINDOW).sort((a,b)=>Math.abs(a.time-now)-Math.abs(b.time-now))[0];if(!note)return miss();const precise=Math.abs(note.time-now)<=PERFECT_WINDOW;note.judgement=precise?'perfect':'good';combo++;maxCombo=Math.max(maxCombo,combo);if(precise)perfect++;else good++;const earned=(precise?100:50)*multiplier();points+=earned;return {label:precise?'PERFETTO':'BUONO',points:earned,good:true};}};
}
