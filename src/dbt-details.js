import {FOUNTAIN_ID,grotteTreeFilter} from './local-world-edits.js';
import {cellarAccesses,outsideAccessSegments} from './cellar-access.js';
import {cellarPartKey} from './cellar-rule.js';
import {drawingCanvas,TEXTURE_ANISOTROPY} from './device-profile.js';
import * as THREE from 'three';import earcut,{flatten} from 'earcut';
import {elevation,demElevation,inBuilding,inside} from './world-math.js';import {SpatialIndex} from './road-network.js';
import {featureFrame,clipStrip,containsFeature} from './dbt-plan.js';

function stoneTexture(){const c=drawingCanvas(512);const g=c.getContext('2d');g.fillStyle='#6e7067';g.fillRect(0,0,512,512);for(let y=0;y<512;y+=64)for(let x=-128;x<512;x+=128){const shift=y/64%2*64;g.fillStyle=`hsl(40 9% ${52+((x*7+y*13)%17)/3}%)`;g.beginPath();g.roundRect(x+shift+3,y+3,122,58,5);g.fill();g.strokeStyle='#c4beaa';g.lineWidth=2;g.stroke();}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=TEXTURE_ANISOTROPY;return t;}
function fenceTexture(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.strokeStyle='#56605a';g.lineWidth=3;for(let i=-128;i<256;i+=32){g.beginPath();g.moveTo(i,0);g.lineTo(i+128,128);g.stroke();g.beginPath();g.moveTo(i,128);g.lineTo(i+128,0);g.stroke();}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;}
function sportsTexture(football){const c=document.createElement('canvas');c.width=1024;c.height=512;const g=c.getContext('2d');for(let x=0;x<1024;x+=64){g.fillStyle=football?(x%128?'#6b854e':'#728b53'):'#a87b59';g.fillRect(x,0,64,512);}g.strokeStyle='#e7e4ce';g.lineWidth=4;g.strokeRect(25,25,974,462);g.beginPath();g.moveTo(512,25);g.lineTo(512,487);g.stroke();if(football){g.beginPath();g.ellipse(512,256,86,74,0,0,7);g.stroke();for(const x of [25,849]){g.strokeRect(x,116,150,280);g.strokeRect(x===25?25:947,190,52,132);}g.fillStyle='#ede9d4';for(const x of [130,512,894]){g.beginPath();g.arc(x,256,4,0,7);g.fill();}}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=TEXTURE_ANISOTROPY;return t;}
export function makeDbtDetails(scene,world,network,stairs,assets={}){
 const features=world.dbtExtras?.features||[],group=new THREE.Group();group.name='DBT · surveyed walls, stairs, bridges, islands and landmarks';group.userData={source:'DBT_5K',features:features.length,categories:world.dbtExtras?.summary};scene.add(group);
 const materials={...(assets.materials??={plaster:new THREE.MeshStandardMaterial({color:'#d2c4ad',roughness:.96,side:THREE.DoubleSide}),stone:new THREE.MeshStandardMaterial({map:stoneTexture(),roughness:.98,side:THREE.DoubleSide}),cap:new THREE.MeshStandardMaterial({color:'#c4bfac',roughness:.96,side:THREE.DoubleSide}),concrete:new THREE.MeshStandardMaterial({color:'#aaa99e',roughness:.98,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide}),iron:new THREE.MeshStandardMaterial({color:'#49534d',roughness:.76,metalness:.4,side:THREE.DoubleSide}),wood:new THREE.MeshStandardMaterial({color:'#807055',roughness:1,side:THREE.DoubleSide}),terracotta:new THREE.MeshStandardMaterial({color:'#a87859',roughness:1,side:THREE.DoubleSide}),green:new THREE.MeshStandardMaterial({color:'#7d8b54',roughness:1,side:THREE.DoubleSide}),water:new THREE.MeshStandardMaterial({color:'#6b9e9c',roughness:.35,metalness:.08,side:THREE.DoubleSide}),glass:new THREE.MeshStandardMaterial({color:'#b8c5b6',roughness:.5,transparent:true,opacity:.65,side:THREE.DoubleSide}),wire:new THREE.MeshStandardMaterial({map:fenceTexture(),transparent:true,alphaTest:.4,roughness:.8,side:THREE.DoubleSide}),football:new THREE.MeshStandardMaterial({map:sportsTexture(true),roughness:.97,side:THREE.DoubleSide}),court:new THREE.MeshStandardMaterial({map:sportsTexture(false),roughness:.97,side:THREE.DoubleSide})})};
 const accesses=cellarAccesses(world),buckets=new Map(),buildingIndex=new SpatialIndex(20);for(const b of [...world.buildings,...(world.urbanFootprints||[])])buildingIndex.insert(b,b.bounds);
 function triangle(kind,points,coords){if(!points.flat().every(Number.isFinite))throw Error('Invalid DBT geometry');const [a,b,c]=points,normal=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)));if(normal.lengthSq()<4e-10)return;const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3,key=kind;if(!buckets.has(key))buckets.set(key,{kind,p:[],uv:[]});const out=buckets.get(key);for(let i=0;i<3;i++){out.p.push(...points[i]);out.uv.push(...(coords?.[i]||[points[i][0]/3,points[i][1]/3]));}}
 function quad(kind,p,uv){triangle(kind,[p[0],p[1],p[2]],uv?[uv[0],uv[1],uv[2]]:null);triangle(kind,[p[0],p[2],p[3]],uv?[uv[0],uv[2],uv[3]]:null);}
 function top(kind,rings,height,uv=null){const f=flatten(rings),ids=earcut(f.vertices,f.holes,2);for(let i=0;i<ids.length;i+=3){let p=ids.slice(i,i+3).map(j=>[f.vertices[j*2],f.vertices[j*2+1]]);const [a,b,c]=p;if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0)[p[1],p[2]]=[p[2],p[1]];triangle(kind,p.map(p=>[p[0],typeof height==='function'?height(...p):height,p[1]]),p.map(p=>uv?uv(p):[p[0]/3,p[1]/3]));}}
 const field=(x,z)=>network.elevationAt(x,z);
 function slab(kind,rings,topY,depth=.35){top(kind,rings,topY);for(const r of rings)for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i],ya=typeof topY==='function'?topY(...a):topY,yb=typeof topY==='function'?topY(...b):topY;quad(kind,[[a[0],ya-depth,a[1]],[b[0],yb-depth,b[1]],[b[0],yb,b[1]],[a[0],ya,a[1]]]);}}
 function bar(kind,a,b,width=.2,height=1,cap=false,groundFunction=null){const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.025)return;const count=Math.ceil(length/1.8),nx=-(b[1]-a[1])/length*width/2,nz=(b[0]-a[0])/length*width/2;
  for(let j=0;j<count;j++){const p=[a[0]+(b[0]-a[0])*j/count,a[1]+(b[1]-a[1])*j/count],q=[a[0]+(b[0]-a[0])*(j+1)/count,a[1]+(b[1]-a[1])*(j+1)/count],ground=p=>groundFunction?groundFunction(...p):Math.max(field(...p),demElevation(world.terrain,...p)),ya=ground(p),yb=ground(q),ba=groundFunction?ya-1:Math.min(field(...p),demElevation(world.terrain,...p))-1,bb=groundFunction?yb-1:Math.min(field(...q),demElevation(world.terrain,...q))-1,h=height;
   const left=[[p[0]+nx,ba,p[1]+nz],[q[0]+nx,bb,q[1]+nz],[q[0]+nx,yb+h,q[1]+nz],[p[0]+nx,ya+h,p[1]+nz]],right=[[q[0]-nx,bb,q[1]-nz],[p[0]-nx,ba,p[1]-nz],[p[0]-nx,ya+h,p[1]-nz],[q[0]-nx,yb+h,q[1]-nz]];quad(kind,left);quad(kind,right);quad(cap?'cap':kind,[left[3],left[2],right[3],right[2]]);
  }
 }
 function box(kind,p,size,yaw=0){const dx=Math.cos(yaw),dz=-Math.sin(yaw),nx=Math.sin(yaw),nz=Math.cos(yaw),vs=[];for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1])vs.push([p[0]+dx*x*size[0]/2+nx*z*size[2]/2,p[1]+y*size[1]/2,p[2]+dz*x*size[0]/2+nz*z*size[2]/2]);for(const f of [[0,1,3,2],[5,4,6,7],[4,0,2,6],[1,5,7,3],[2,3,7,6],[4,5,1,0]])quad(kind,f.map(i=>vs[i]));}
 function followingSurface(kind,f,step=3,skipRoad=false,uv=null){for(let z=Math.floor(f.bounds[1]/step)*step;z<f.bounds[3];z+=step)for(let x=Math.floor(f.bounds[0]/step)*step;x<f.bounds[2];x+=step){if(skipRoad&&[[x,z],[x+step,z],[x+step,z+step],[x,z+step],[x+step/2,z+step/2]].some(p=>network.pavementAt(...p)))continue;for(const polygon of clipStrip(f.rings,[[x,z],[x+step,z],[x+step,z+step],[x,z+step]]))top(kind,polygon,(x,z)=>field(x,z)+.018,uv);}}
 materials.fountainStone=new THREE.MeshStandardMaterial({color:'#c4c1ae',roughness:.93,side:THREE.DoubleSide});
 materials.fountainTrim=new THREE.MeshStandardMaterial({color:'#b2ae9c',roughness:.9,side:THREE.DoubleSide});
 materials.fountainBronze=new THREE.MeshStandardMaterial({color:'#695349',roughness:.7,metalness:.48,side:THREE.DoubleSide});
 materials.fountainBasin=new THREE.MeshStandardMaterial({color:'#42544d',roughness:.4,side:THREE.DoubleSide});
 function madonnaFountain(f){
  const [x,z]=f.point,y=field(x,z)-.14,c=Math.cos(f.yaw),s=Math.sin(f.yaw);
  const at=(u,h,v)=>[x+c*u+s*v,y+h,z-s*u+c*v];
  const block=(mat,u,h,v,w,t,d)=>box(mat,at(u,h,v),[w,t,d],f.yaw);
  const stone='fountainStone',trim='fountainTrim',bronze='fountainBronze';
  block(stone,0,1.02,-1.11,3.06,2.16,.48);
  for(const u of [-1.42,1.42])block(trim,u,1.21,-.84,.18,1.74,.15);
  block(trim,0,2.08,-1.08,3.27,.15,.63);
  block(stone,0,2.18,-1.08,3.18,.08,.59);
  const curve=Array.from({length:17},(_,i)=>{const angle=Math.PI*i/16;return [1.58*Math.cos(angle),2.21+.62*Math.sin(angle)];});
  for(let i=1;i<curve.length;i++){
   const [a,ha]=curve[i-1],[b,hb]=curve[i];
   quad(stone,[at(a,2.21,-.85),at(b,2.21,-.85),at(b,hb,-.85),at(a,ha,-.85)]);
   quad(trim,[at(a,ha-.08,-.77),at(b,hb-.08,-.77),at(b,hb,-.77),at(a,ha,-.77)]);
   quad(trim,[at(a,ha,-.77),at(b,hb,-.77),at(b,hb,-1.37),at(a,ha,-1.37)]);
   quad(stone,[at(a,2.21,-1.37),at(b,2.21,-1.37),at(b,hb,-1.37),at(a,ha,-1.37)]);
  }
  block(trim,0,1.35,-.86,.51,.61,.045);
  for(const u of [-.74,.74]){
   quad('fountainBasin',[at(u-.24,.54,-.862),at(u+.24,.54,-.862),at(u+.11,1.26,-.862),at(u-.1,1.26,-.862)]);
   const center=at(u,1.51,-.872);
   for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6;triangle(bronze,[center,at(u+.15*Math.cos(a),1.51+.19*Math.sin(a),-.884),at(u+.15*Math.cos(b),1.51+.19*Math.sin(b),-.884)]);}
   block(bronze,u,1.4,-.78,.075,.07,.19);
   quad('water',[at(u-.015,1.37,-.685),at(u+.015,1.37,-.685),at(u+.025,.54,-.50),at(u-.025,.54,-.50)]);
  }
  block(stone,0,.17,-.29,3.05,.47,1.06);
  block(trim,0,.43,.20,3.18,.24,.15);
  for(const u of [-1.51,1.51])block(trim,u,.43,-.32,.16,.24,1.16);
  block('fountainBasin',0,.41,-.33,2.86,.022,.9);
 }
 const allowTree=grotteTreeFilter(world),treeItems=[];
 for(const f of features){const cat=f.category;if(f.id===FOUNTAIN_ID){madonnaFountain(f);continue;}if(['tree','shrine','monument','fountain'].includes(cat)&&f.point&&(world.clearAreas||[]).some(a=>inBuilding(f.point,a)))continue;
  if(['wall','retaining-wall','median','hydraulic-wall','water-edge'].includes(cat)&&f.points){const piazza=f.sourceId==='995963',h=piazza?2.2:cat==='retaining-wall'?1.6:cat==='median'?.2:cat==='water-edge'?.18:f.properties.MU_DIV_TY==='0202'?1.05:1.45;for(let i=1;i<f.points.length;i++)for(const [a,b] of outsideAccessSegments(f.points[i-1],f.points[i],accesses,.24)){bar('stone',a,b,cat==='median'?.35:.42,h,true,assets.wallGround);if(piazza){
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(length/.28);for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n;box('iron',[x,field(x,z)+h+.48,z],[.025,.96,.025]);}for(const rise of [.08,.93]){const ya=field(...a)+h+rise,yb=field(...b)+h+rise;quad('iron',[[a[0],ya,a[1]],[b[0],yb,b[1]],[b[0],yb+.035,b[1]],[a[0],ya+.035,a[1]]]);}
 }}}
  else if(cat==='gate'&&f.points){
   const [a,b]=f.points,yaw=Math.atan2(a[1]-b[1],b[0]-a[0]);
   for(const [x,z] of [a,b]){
    const y=field(x,z);
    box('plaster',[x,y+.65,z],[.38,1.5,.38],yaw);
    box('cap',[x,y+1.44,z],[.47,.1,.47],yaw);
   }
   for(let i=1;i<14;i++){
    const x=a[0]+(b[0]-a[0])*i/14,z=a[1]+(b[1]-a[1])*i/14;
    box('iron',[x,field(x,z)+.76,z],[.038,1.22,.047],yaw);
   }
   for(const h of [.26,1.22]){
    const p=[a[0],field(...a)+h,a[1]],q=[b[0],field(...b)+h,b[1]];
    quad('iron',[p,q,[q[0],q[1]+.065,q[2]],[p[0],p[1]+.065,p[2]]]);
   }
  }
  else if(cat==='fence'&&f.points){let distance=0;for(let i=1;i<f.points.length;i++){const a=f.points[i-1],b=f.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(len/2.2)),wood=f.properties.EL_DIV_TY==='18';for(let j=0;j<n;j++){const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],q=[a[0]+(b[0]-a[0])*(j+1)/n,a[1]+(b[1]-a[1])*(j+1)/n],y=field(...p),v=field(...q),h=wood?1.1:1.55;box(wood?'wood':'iron',[p[0],y+h/2,p[1]],[.09,h,.09]);if(wood)for(const yy of [.38,.87])quad('wood',[[p[0],y+yy,p[1]],[q[0],v+yy,q[1]],[q[0],v+yy+.11,q[1]],[p[0],y+yy+.11,p[1]]]);else quad('wire',[[p[0],y+.1,p[1]],[q[0],v+.1,q[1]],[q[0],v+h,q[1]],[p[0],y+h,p[1]]],[[distance,0],[distance+len/n,0],[distance+len/n,h],[distance,h]]);distance+=len/n;}}}
  else if(['island','roundabout'].includes(cat)&&f.rings){const ps=f.rings[0],level=network.islandLevels.get(f.id)??(ps.reduce((s,p)=>s+field(...p),0)/ps.length+.18);slab(f.area>5?'green':'cap',f.rings,level,.5);for(let i=1;i<ps.length;i++)bar('cap',ps[i-1],ps[i],.24,.2,false,()=>level-.18);
   if(cat==='roundabout'){const frame=featureFrame(f),radius=Math.min(f.bounds[2]-f.bounds[0],f.bounds[3]-f.bounds[1])/2;for(let i=0;i<3;i++){const a=i*Math.PI*2/3,x=frame.center[0]+Math.cos(a)*(radius-.45),z=frame.center[1]+Math.sin(a)*(radius-.45);roundaboutSign(group,x,level,z,a);}for(let i=0;i<24;i++){const a=i*2.399,r=Math.sqrt(i/24)*radius*.6,p=[frame.center[0]+Math.cos(a)*r,frame.center[1]+Math.sin(a)*r];if(containsFeature(p,f))box(i%3?'green':'terracotta',[p[0],level+.13,p[1]],[.18,.25,.18]);}}
  }
  else if(cat==='bridge'&&f.rings){
   const frame=featureFrame(f),surface=(x,z)=>network.closestSegment(x,z)?.y??field(x,z),deck=(x,z)=>surface(x,z)-.22;
   // Keep the structural slab below the asphalt and sample the grade along the span.
   const step=1.5;
   for(let x=f.bounds[0];x<f.bounds[2];x+=step)for(let z=f.bounds[1];z<f.bounds[3];z+=step){
    for(const polygon of clipStrip(f.rings,[[x,z],[x+step,z],[x+step,z+step],[x,z+step]]))top('concrete',polygon,deck);
   }
   const outline=f.rings[0];
   for(let i=1;i<outline.length;i++){
    const a=outline[i-1],b=outline[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),count=Math.ceil(length/step);
    for(let j=0;j<count;j++){
     const p=[a[0]+dx*j/count,a[1]+dz*j/count],q=[a[0]+dx*(j+1)/count,a[1]+dz*(j+1)/count],yp=deck(...p),yq=deck(...q);
     quad('concrete',[[p[0],yp-1.15,p[1]],[q[0],yq-1.15,q[1]],[q[0],yq,q[1]],[p[0],yp,p[1]]]);
     const x=(p[0]+q[0])/2,z=(p[1]+q[1])/2,near=network.closestSegment(x,z),road=near?.segment;
     if(!road||near.d<road.half-.08)continue;
     const rx=road.b.x-road.a.x,rz=road.b.z-road.a.z;
     if(Math.abs(dx*rx+dz*rz)<.72*length*Math.hypot(rx,rz))continue;
     const yaw=Math.atan2(-dz,dx);
     box('iron',[x,(yp+yq)/2+.71,z],[.075,1.04,.075],yaw);
     for(const h of [.61,1.23])quad('iron',[[p[0],yp+h,p[1]],[q[0],yq+h,q[1]],[q[0],yq+h+.065,q[1]],[p[0],yp+h+.065,p[1]]]);
    }
   }
   for(let u=frame.u0+8;u<frame.u1-4;u+=16){
    const p=frame.point(u,(frame.v0+frame.v1)/2),y=deck(...p)-.5,ground=demElevation(world.terrain,...p)-.5;
    if(y-ground>1)box('concrete',[p[0],(y+ground)/2,p[1]],[1.1,y-ground,1.1]);
   }
  }
  // Mountain vegetation belongs to the single orthophoto DEM; never overlay it.
  else if(cat==='sidewalk'&&f.rings)followingSurface('cap',f,3,true);
  else if(['sport'].includes(cat)&&f.rings){const frame=featureFrame(f),football=f.properties.ATTR_SP_TY==='0201';followingSurface(football?'football':'court',f,3,false,frame.uv);if(football){const longU=frame.u1-frame.u0>frame.v1-frame.v0;for(const end of [-1,1]){const p=longU?frame.point(end<0?frame.u0+.5:frame.u1-.5,(frame.v0+frame.v1)/2):frame.point((frame.u0+frame.u1)/2,end<0?frame.v0+.5:frame.v1-.5);if(!containsFeature(p,f))continue;const y=field(...p),goalWidth=Math.min(7.32,(longU?frame.v1-frame.v0:frame.u1-frame.u0)*.32),yaw=longU?-Math.atan2(frame.nz,frame.nx):-Math.atan2(frame.dz,frame.dx);for(const s of [-1,1])box('cap',[p[0]+Math.cos(yaw)*s*goalWidth/2,y+1.2,p[1]-Math.sin(yaw)*s*goalWidth/2],[.085,2.4,.085]);box('cap',[p[0],y+2.4,p[1]],[goalWidth,.085,.085],yaw);}}}
  else if(['pool','water-tank'].includes(cat)&&f.rings){const level=Math.max(...f.rings.flat().map(p=>field(...p)))+.04;slab('water',f.rings,level,.5);for(const r of f.rings)for(let i=1;i<r.length;i++)bar('cap',r[i-1],r[i],.22,.15,false,()=>level-.03);}
  else if(['minor-building','utility-cabin','greenhouse'].includes(cat)&&f.rings){if(cat==='minor-building'&&world.historicCellars?.minorRecords?.[cellarPartKey(f.sourceId,f.bounds)])continue;const ps=f.rings.flat(),ys=ps.map(p=>field(...p)),base=Math.min(...ys)-2,roof=Math.max(...ys)+(cat==='greenhouse'?2.3:cat==='utility-cabin'?2.7:f.properties.EDI_MIN_TY==='18'?3.7:2.65);for(const r of f.rings)for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i];quad(cat==='greenhouse'?'glass':'plaster',[[a[0],base,a[1]],[b[0],base,b[1]],[b[0],roof,b[1]],[a[0],roof,a[1]]]);}slab(cat==='greenhouse'?'glass':cat==='minor-building'?'terracotta':'concrete',f.rings,roof,.15);if(f.properties.EDI_MIN_TY==='18'){const frame=featureFrame(f);box('iron',[frame.center[0],roof+.45,frame.center[1]],[.05,.9,.05]);box('iron',[frame.center[0],roof+.6,frame.center[1]],[.5,.05,.05]);}}
  else if(cat==='tree'&&f.point){const [x,z]=f.point;if(buildingIndex.point(x,z).some(b=>inBuilding([x,z],b)))continue;treeItems.push({x,z,y:field(x,z),seed:Number(f.sourceId)||1});}
  else if(['monument','unclassified-landmark','shrine','cross','pavilion','fountain','bench','lamp','pylon'].includes(cat)){const p=f.point||featureFrame(f).center,x=p[0],z=p[1],y=field(x,z);if(cat==='pylon'){for(const sx of [-1,1])for(const sz of [-1,1])box('iron',[x+sx*.8,y+7,z+sz*.8],[.13,14,.13]);for(const h of [3,6,9,12,14]){box('iron',[x,y+h,z],[2,.1,.15]);box('iron',[x,y+h,z],[.15,.1,2]);}for(const h of [11,13])box('iron',[x,y+h,z],[6,.13,.2]);}
   else if(cat==='unclassified-landmark'){box('cap',[x,y+.22,z],[.65,.44,.65]);}
   else if(cat==='shrine'){box('stone',[x,y+1.05,z],[.8,2.1,.65]);box('terracotta',[x,y+2.2,z],[1.05,.2,.85]);box('iron',[x,y+1.5,z+.34],[.4,.7,.025]);}
   else if(cat==='monument'){const size=f.rings?Math.min(6,Math.sqrt(f.area)*.6):1.25;if(f.rings)slab('cap',f.rings,y+.25,.5);box('stone',[x,y+.45,z],[size,.9,size]);box('cap',[x,y+1.25,z],[size*.65,.7,size*.65]);box('stone',[x,y+2.2,z],[size*.35,1.4,size*.35]);}
   else if(cat==='cross'){box('iron',[x,y+1.5,z],[.08,3,.08]);box('iron',[x,y+2.1,z],[1.4,.08,.08]);}
   else if(cat==='fountain'){box('stone',[x,y+.35,z],[1.6,.7,1.3]);box('water',[x,y+.73,z],[1.35,.03,1.05]);box('stone',[x,y+1.1,z],[.4,1.3,.4]);}
   else if(cat==='bench'){box('wood',[x,y+.5,z],[1.8,.15,.55]);box('wood',[x,y+.85,z+.22],[1.8,.65,.1]);}
  }
 }
 // Permanent piazzetta details reconstructed from the May 2022 reference;
 // no festival stalls or temporary wooden huts.
 const plazaWall=features.find(f=>f.sourceId==='995963'&&f.category==='retaining-wall');
 if(plazaWall){const points=plazaWall.points,a=points[0],b=points.at(-1),length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,nx=-dz,nz=dx;
  for(let d=1.4;d<length;d+=2.1){const x=a[0]+dx*d,z=a[1]+dz*d;box('iron',[x+nx*.235,field(x,z)+1.15,z+nz*.235],[.22,.48,.04],-Math.atan2(dz,dx));}
  for(const t of [.15,.72]){const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,y=field(x,z)+2.2;box('iron',[x,y+1.6,z],[.08,3.2,.08]);box('glass',[x,y+3.35,z],[.26,.38,.26]);box('iron',[x,y+3.58,z],[.4,.08,.4]);box('iron',[x,y+3.1,z],[.3,.07,.3]);
   const ox=x-nx*2.3,oz=z-nz*2.3;if(allowTree(ox,oz)&&!buildingIndex.point(ox,oz).some(b=>inBuilding([ox,oz],b)))treeItems.push({x:ox,z:oz,y:field(ox,oz),seed:Math.round(t*100)});
  }
 }
 for(const plan of stairs)for(const step of plan.steps)for(const polygon of step.polygons)slab('cap',polygon,step.y,Math.max(.25,step.y-Math.min(...polygon.flat().map(p=>field(...p)))+.2));
 let triangles=0;for(const [name,b] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();g.computeBoundingSphere();const m=new THREE.Mesh(g,materials[b.kind]);m.name=`DBT ${name}`;m.castShadow=!['green','wire','water','football','court'].includes(b.kind);m.receiveShadow=true;group.add(m);triangles+=b.p.length/9;}
 makeSurveyedTrees(group,treeItems);group.userData.triangles=triangles;group.userData.surveyedTrees=treeItems.length;return group;
}
function makeSurveyedTrees(group,items){if(!items.length)return;const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.2,1,6),new THREE.MeshStandardMaterial({color:'#71644e',roughness:1}),items.length),leaf=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({roughness:1,flatShading:true}),items.length*3),dummy=new THREE.Object3D(),color=new THREE.Color();items.forEach((p,i)=>{const s=.8+(p.seed%101)/160;dummy.position.set(p.x,p.y+1.25*s,p.z);dummy.scale.set(1,2.5*s,1);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);for(let j=0;j<3;j++){dummy.position.set(p.x+Math.cos(j*2.1)*.55*s,p.y+(2.8+j*.15)*s,p.z+Math.sin(j*2.1)*.55*s);dummy.scale.set(1.3*s,1.1*s,1.3*s);dummy.updateMatrix();leaf.setMatrixAt(i*3+j,dummy.matrix);leaf.setColorAt(i*3+j,color.set(['#758662','#82906e','#637e50'][(p.seed+j)%3]));}});trunk.castShadow=leaf.castShadow=true;trunk.receiveShadow=leaf.receiveShadow=true;trunk.name='DBT trees and piazzetta olives';leaf.name='DBT crowns and piazzetta olives';group.add(trunk,leaf);}
function roundaboutSign(group,x,y,z,angle){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const g=canvas.getContext('2d');g.fillStyle='#2f688f';g.beginPath();g.arc(64,64,61,0,7);g.fill();g.strokeStyle='#e5e9df';g.lineWidth=7;g.stroke();g.lineWidth=5;for(let i=0;i<3;i++){const a=i*Math.PI*2/3;g.save();g.translate(64,64);g.rotate(a);g.beginPath();g.arc(0,0,30,-.9,.5);g.stroke();g.beginPath();g.moveTo(26,18);g.lineTo(12,15);g.lineTo(26,5);g.closePath();g.fillStyle='#f2f1e4';g.fill();g.restore();}const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.CircleGeometry(.34,24),new THREE.MeshStandardMaterial({map:tex,roughness:.8,side:THREE.DoubleSide}));m.position.set(x,y+1.85,z);m.rotation.y=-angle;const p=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.85,6),new THREE.MeshStandardMaterial({color:'#67716a',roughness:.8,metalness:.3}));p.position.set(x,y+.925,z);group.add(m,p);}
