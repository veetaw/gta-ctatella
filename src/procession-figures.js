import * as THREE from 'three';
export function buildProcessionFigure(group,{figure,m,add,oval,rod,box}){
 group.clear();group.scale.setScalar(1);group.name=figure==='peter'?'San Pietro · busto con tonsura e barba scura':'Madonna delle Grazie · Bambino e dodici stelle';
 if(figure==='peter'){
  add(group,new THREE.CylinderGeometry(.24,.36,.65,12),m.wood,[0,.4,0]);oval(group,[.19,.23,.17],[0,.91,0],m.skin);oval(group,[.18,.13,.11],[0,.81,.12],m.hair);oval(group,[.20,.08,.18],[0,1.07,-.015],m.hair);oval(group,[.12,.025,.12],[0,1.13,0],m.skin);for(const side of [-1,1]){rod(group,[side*.22,.61,.02],[side*.3,.48,.29],.10,m.wood);rod(group,[side*.3,.48,.29],[side*.22,.58,.49],.065,m.skin);oval(group,[.06,.07,.07],[side*.22,.58,.49],m.skin);}box(group,[.11,.035,.32],[.18,.58,.44],m.gold);
 }else{
  add(group,new THREE.CylinderGeometry(.20,.39,1.13,16),m.red,[0,.59,0]);const blue=new THREE.MeshStandardMaterial({color:'#174a92',roughness:1});add(group,new THREE.CylinderGeometry(.27,.49,1.20,20,1,true,.7,Math.PI*2-1.4),blue,[0,.64,-.05]).material.side=THREE.DoubleSide;
  oval(group,[.16,.21,.15],[0,1.4,0],m.skin);const veil=add(group,new THREE.SphereGeometry(.24,14,10,0,Math.PI*2,0,Math.PI*.65),m.white,[0,1.43,-.04]);veil.scale.z=.8;
  const halo=add(group,new THREE.TorusGeometry(.34,.018,6,24),m.silver,[0,1.48,-.17]);for(let i=0;i<12;i++){const a=i*Math.PI/6;const star=add(group,new THREE.OctahedronGeometry(.045),m.silver,[Math.cos(a)*.34,1.48+Math.sin(a)*.34,-.17]);star.rotation.z=a;}
  for(const side of [-1,1])rod(group,[side*.21,1.1,.02],[side*.30,.91,.28],.08,blue);rod(group,[-.3,.91,.28],[-.16,1.02,.39],.065,m.skin);rod(group,[.3,.91,.28],[-.13,1.06,.37],.065,m.skin);
  const child=new THREE.Group();child.position.set(-.26,1.03,.35);child.rotation.z=-.18;group.add(child);oval(child,[.12,.20,.1],[0,.04,0],m.white);oval(child,[.10,.12,.10],[0,.31,.01],m.skin);oval(child,[.105,.045,.10],[0,.4,-.01],m.gold);for(const side of [-1,1]){rod(child,[side*.08,.13,0],[side*.20,.19,.07],.035,m.skin);rod(child,[side*.055,-.08,0],[side*.075,-.25,.10],.035,m.skin);}
 }
}
