// Compact, newly synthesised arrangement of Novaro's public-domain melody.
// Score reference: https://presidenza.governo.it/ufficio_cerimoniale/cerimoniale/inno.html
export const ANTHEM_BPM=144,BEAT=60/ANTHEM_BPM,LEAD_IN=1.5;
const A=[['D5',1,'D5',.75,'E5',.25,'D5',2],['B4',1,'B4',.75,'C5',.25,'B4',2],['B4',1,'D5',.75,'C5',.25,'B4',2],['A4',1,'B4',.75,'A4',.25,'G4',2]];
const B=[['B4',1,'B4',1,'F#4',2],['G4',.75,'A4',.25,'G4',.75,'F#4',.25,'E4',2],['G4',1,'F#4',.75,'G4',.25,'A4',2],['D4',1,'B4',2,'C5',1],...A.slice(0,3),['D5',.5,'A4',.5,'D5',1,'G4',2]];
const D=[['R',.75,'E4',.25,'E4',1,'E4',.75,'D4',.25,'F4',1],['E4',.75,'E4',.25,'E4',1,'D4',.75,'C4',.25,'D4',1],['D4',.75,'E4',.25,'E4',1,'E4',.75,'D4',.25,'F4',1],['E4',.75,'E4',.25,'E4',1,'D4',.75,'C4',.25,'D4',1],['R',.75,'E4',.25,'E4',1,'E4',.75,'D4',.25,'F4',1],['E4',.75,'G4',.25,'G4',1,'F#4',.75,'G4',.25,'B4',1],['A4',.75,'A4',.25,'A4',.75,'B4',.25,'C5',.75,'D5',.25,'E5',1],['E5',.75,'E5',.25,'D5',1,'D5',.75,'D5',.25,'C5',.5,'C5',.5]];
let beat=0;export const ANTHEM_MELODY=[];
for(const phrase of [...A,...B,...D])for(let i=0;i<phrase.length;i+=2){const pitch=phrase[i],beats=phrase[i+1];if(pitch!=='R')ANTHEM_MELODY.push({pitch,beat,time:LEAD_IN+beat*BEAT,duration:beats*BEAT});beat+=beats;}
export const ANTHEM_DURATION=LEAD_IN+beat*BEAT+.3;
let previous=-Infinity;export const ABBALLA_CHART=ANTHEM_MELODY.filter(n=>{if(n.time-previous<.24)return false;previous=n.time;return true;}).map((n,i)=>({time:n.time,lane:i%2}));
export function pitchFrequency(note){const match=/^([A-G])(#?)(\d)$/.exec(note);if(!match)throw Error(`Nota non valida: ${note}`);const midi=(Number(match[3])+1)*12+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1]])+(match[2]?1:0);return 440*2**((midi-69)/12);}
