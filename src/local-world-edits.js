import {worldLocation} from './game-locations.js';
import {demElevation,nearest,inBuilding} from './world-math.js';

const cellarIds=new Set(['823016','823070','823121','823125','823153','823046','823122','823076','823032','823087']);
const facades={
 '824372':['#d1cec2',6.8],'824277':['#e8dfce',7.2],'824193':['#e2d9cb'],'824220':['#dfbc78'],
 '824103':['#dfb881',8.1],'824016':['#c97661'],'824029':['#e2ba80'],'824105':['#ded0bc'],'824068':['#ded8c9'],
 '824838':['#dcd1bd',8.2],'824709':['#d1c2a9',8.3],'970811':['#cb815c'],'824759':['#d99a68'],
};
export const FOUNTAIN_ID='local-fontana-madonna-delle-grazie';
const plaza={lat:40.655559,lon:15.401862};
export function grotteTreeFilter(world){
 const p=worldLocation(world.origin,plaza);
 return (x,z)=>Math.hypot(x-p.x,z-p.z)>25;
}
export function applyLocalWorldEdits(world){
 const trees=grotteTreeFilter(world),features=world.dbtExtras.features;
 world.dbtExtras.features=features.filter(f=>f.category!=='tree'||!f.point||trees(...f.point));
 const fountain=worldLocation(world.origin,{lat:40.656102,lon:15.406823}),{x,z}=fountain,yaw=.37;
 const pt=(u,v)=>[x+Math.cos(yaw)*u+Math.sin(yaw)*v,z-Math.sin(yaw)*u+Math.cos(yaw)*v];
 const ring=[pt(-1.63,-1.36),pt(1.63,-1.36),pt(1.63,.27),pt(-1.63,.27)];ring.push(ring[0]);
 world.dbtExtras.features.push({id:FOUNTAIN_ID,category:'fountain',properties:{},point:[x,z],yaw,rings:[ring],bounds:[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))]});
 const segments=world.cellarDistrict?.segments||[];
 for(const b of world.buildings){
  if(b.church||b.classification==='church')continue;
  const facade=facades[b.id];
  if(facade){b.wallColor=facade[0];delete b.facadeColors;if(facade[1]&&b.heightSource==='area estimate'){b.height=facade[1];b.roofY=b.maxGroundY+b.height;}}
  if(!cellarIds.has(b.id)||b.cellar)continue;
  const ring=b.rings[0];let best=null,fallback=null;
  for(let i=1;i<ring.length;i++){
   const a=ring[i-1],c=ring[i],length=Math.hypot(c[0]-a[0],c[1]-a[1]);if(length<1.6)continue;
   const p=[(a[0]+c[0])/2,(a[1]+c[1])/2];let nx=(c[1]-a[1])/length,nz=(a[0]-c[0])/length;
   if(inBuilding([p[0]+nx*.1,p[1]+nz*.1],b)){nx=-nx;nz=-nz;}
   const front=[p[0]+nx*.7,p[1]+nz*.7],index=i-1;
   if(!fallback||length>fallback.length)fallback={index,length,roadPoint:front};
   if(world.buildings.some(o=>o!==b&&front[0]>=o.bounds[0]&&front[0]<=o.bounds[2]&&front[1]>=o.bounds[1]&&front[1]<=o.bounds[3]&&inBuilding(front,o)))continue;
   for(const {a,b:q} of segments){const hit=nearest(p,a,q);if(hit.d>10||(hit.q[0]-p[0])*nx+(hit.q[1]-p[1])*nz<=0)continue;const score=hit.d-length*.05;if(!best||score<best.score)best={index,length,roadPoint:hit.q,score};}
  }
  const front=best||fallback;if(!front)continue;
  const height=3.5;b.height=height;b.roofY=demElevation(world.terrain,...front.roadPoint)+.035+height;
  b.classification='historic-cellar';b.classificationLabel='Cantina storica';b.heightSource='Local cellar correction';
  b.cellar={typology:'historic-cellar',evidence:{kind:'user-confirmed-cellar-area'},frontEdge:front.index,frontSegment:[ring[front.index],ring[front.index+1]],roadPoint:front.roadPoint,noPortal:!best,roofRise:.35,maxHeight:height,floors:1,doorLeaf:'solid-dark-wood',hasPlaster:false,hasShutters:false,windows:0,balconies:0};
 }
}
