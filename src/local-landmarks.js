import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {worldLocation} from './game-locations.js';
import {elevation,nearest,inBuilding} from './world-math.js';
import {drawingCanvas} from './device-profile.js';

// IDs bind the observed storefronts to the surveyed footprints, never to
// arbitrary buildings inside a broad radius. Dimensions are visual estimates.
export const LOCAL_REFERENCES=[
 {id:'piazza-croce',name:'Piazza Croce',lat:40.6586315,lon:15.4011607},
 {id:'my-way',name:'My Way',lat:40.6584369,lon:15.398951,buildingId:'824055',edges:[4,5]},
 {id:'via-del-sole-bar',name:'Bar · Via del Sole',lat:40.6572926,lon:15.3966811,buildingId:'846809'}
];
export function prepareLocalLandmarks(world){
 world.localLandmarks=LOCAL_REFERENCES.map(ref=>({...ref,...worldLocation(world.origin,ref)}));
 const bar=world.buildings.find(b=>b.id==='846809');if(bar)bar.localShop={id:'via-del-sole-bar',edges:[0],recess:0,ceiling:0};
 const myway=world.buildings.find(b=>b.id==='824055');if(myway)myway.localShop={id:'my-way',edges:[4,5],recess:2.1,ceiling:3.15};
 return world.localLandmarks;
}
export function shopWallCuts(building,wall){return building.localShop?.recess>0&&building.localShop?.edges.includes(wall.edgeIndex)&&wall.ringIndex===0?building.localShop:null;}
function frontage(b,edge,terrain){const a=b.rings[0][edge],c=b.rings[0][edge+1],width=Math.hypot(c[0]-a[0],c[1]-a[1]),dx=(c[0]-a[0])/width,dz=(c[1]-a[1])/width,center=[(a[0]+c[0])/2,(a[1]+c[1])/2];let nx=dz,nz=-dx;if(inBuilding([center[0]+nx*.1,center[1]+nz*.1],b)){nx=-nx;nz=-nz;}return {width,dx,dz,nx,nz,center,y:elevation(terrain,center[0]+nx*.4,center[1]+nz*.4)+.06};}
export function makeLocalLandmarks(scene,world,network){
 const refs=world.localLandmarks||prepareLocalLandmarks(world),group=new THREE.Group();group.name='Piazza Croce · My Way · Via del Sole';scene.add(group);
 const mats={cream:new THREE.MeshStandardMaterial({color:'#ddd7c7',roughness:.96}),iron:new THREE.MeshStandardMaterial({color:'#343b39',roughness:.85}),glass:new THREE.MeshStandardMaterial({color:'#253b39',roughness:.3}),leaf:new THREE.MeshStandardMaterial({color:'#72845b',roughness:1,flatShading:true}),wood:new THREE.MeshStandardMaterial({color:'#75644e',roughness:1}),brick:new THREE.MeshStandardMaterial({color:'#b98b68',roughness:1})},buckets=new Map();
 function part(g,kind,p,s=[1,1,1],yaw=0){g.scale(...s);g.rotateY(yaw);g.translate(...p);if(!buckets.has(kind))buckets.set(kind,[]);buckets.get(kind).push(g);}
 const box=(kind,p,s,yaw=0)=>part(new THREE.BoxGeometry(1,1,1),kind,p,s,yaw);
 function rod(a,b,r=.025){const delta=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.map((v,i)=>(v+b[i])/2));if(!buckets.has('iron'))buckets.set('iron',[]);buckets.get('iron').push(g);}
 function lamp(x,z,arms=2){const y=elevation(world.terrain,x,z),h=4.2;part(new THREE.CylinderGeometry(.065,.12,h,7),'iron',[x,y+h/2,z]);for(const sign of arms===1?[1]:[-1,1]){rod([x,y+h-.25,z],[x+sign*.7,y+h-.05,z],.035);box('glass',[x+sign*.7,y+h-.32,z],[.25,.36,.25]);part(new THREE.ConeGeometry(.24,.15,4),'iron',[x+sign*.7,y+h-.06,z]);}}
 function tree(x,z,s=1){if(world.buildings.some(b=>inBuilding([x,z],b)))return;const y=elevation(world.terrain,x,z);part(new THREE.CylinderGeometry(.12,.18,2.5*s,6),'wood',[x,y+1.25*s,z]);for(let i=0;i<3;i++)part(new THREE.IcosahedronGeometry(1,1),'leaf',[x+Math.cos(i*2.1)*.55*s,y+(2.9+i*.25)*s,z+Math.sin(i*2.1)*.55*s],[1.6*s,1.3*s,1.5*s]);}
 // A shared atlas carries only signs and a schematic painted devotional panel;
 // no Street View screenshots are embedded in the game.
 const canvas=drawingCanvas(1024,1024),ctx=canvas.getContext('2d');ctx.fillStyle='#e9e5d8';ctx.fillRect(0,0,1024,1024);
 const labels=[['MY WAY','#2c3837','#e8e3cb'],['BAR','#c3a26a','#202823'],['RISTORANTE BRACERIA','#8e302a','#fff0d4'],['PIAZZA CROCE','#ddd9cd','#39423b']];
 labels.forEach(([text,bg,fg],i)=>{ctx.fillStyle=bg;ctx.fillRect(0,i*128,1024,128);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${i===2?62:78}px Georgia`;ctx.fillText(text,512,i*128+64);});
 ctx.fillStyle='#b8c7cd';ctx.fillRect(0,512,1024,512);ctx.fillStyle='#a37a58';ctx.fillRect(0,875,1024,149);ctx.fillStyle='#dab44e';ctx.beginPath();ctx.arc(512,650,88,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7594ad';ctx.beginPath();ctx.moveTo(512,624);ctx.lineTo(365,975);ctx.lineTo(660,975);ctx.closePath();ctx.fill();ctx.fillStyle='#e7c6a2';ctx.beginPath();ctx.arc(512,677,37,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){const x=80+i*120,y=755+(i%2)*40;ctx.fillStyle=i%2?'#8c7466':'#a48874';ctx.fillRect(x-30,y+45,60,130);ctx.fillStyle='#d0ad8d';ctx.beginPath();ctx.arc(x,y+20,28,0,Math.PI*2);ctx.fill();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const signMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:.9,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 function sign(f,textIndex,u,y,width,height,depth=.1){const g=new THREE.PlaneGeometry(width,height),uv=g.attributes.uv,lo=textIndex===4?0:1-(textIndex+1)/8,hi=textIndex===4?.5:1-textIndex/8;for(let i=0;i<uv.count;i++)uv.setY(i,lo+uv.getY(i)*(hi-lo));g.rotateY(Math.atan2(f.nx,f.nz));g.translate(f.center[0]+f.dx*u+f.nx*depth,y,f.center[1]+f.dz*u+f.nz*depth);if(!buckets.has('sign'))buckets.set('sign',[]);buckets.get('sign').push(g);}
 const myway=world.buildings.find(b=>b.id==='824055');if(myway){for(const edge of [4,5]){const f=frontage(myway,edge,world.terrain),yaw=Math.atan2(-f.dz,f.dx),at=(u,y,d)=>[f.center[0]+f.dx*u+f.nx*d,y,f.center[1]+f.dz*u+f.nz*d];
  box('cream',at(0,f.y+.04,-.95),[f.width,.14,2.2],yaw);box('cream',at(0,f.y+3.15,-.95),[f.width,.25,2.2],yaw);box('glass',at(0,f.y+1.35,-2.1),[f.width-.25,2.65,.06],yaw);
  for(const u of [-f.width/2+.12,0,f.width/2-.12]){box('cream',at(u,f.y+1.55,0),[.24,3.1,.24],yaw);box('cream',at(u,f.y+.4,.35),[1.05,.65,.55],yaw);part(new THREE.IcosahedronGeometry(.5,1),'leaf',at(u,f.y+1,.35),[1,.8,.8]);}
  for(const u of [-f.width/4,f.width/4]){box('iron',at(u,f.y+.72,-.9),[.7,.05,.7],yaw);box('iron',at(u,f.y+.35,-.9),[.07,.7,.07],yaw);for(const d of [-.45,.45])box('iron',at(u,f.y+.45,-.9+d),[.45,.04,.4],yaw);}
  for(const h of [3.35,6.55]){box('cream',at(0,f.y+h,.25),[f.width,.18,.8],yaw);for(const top of [.24,1.0])rod(at(-f.width/2,f.y+h+top,.6),at(f.width/2,f.y+h+top,.6));for(let u=-f.width/2;u<f.width/2;u+=.35)rod(at(u,f.y+h+.24,.6),at(u,f.y+h+1,.6),.015);}
  if(edge===4)sign(f,0,0,f.y+2.55,2.4,.38,-2.03);
 }const ref=refs.find(r=>r.id==='my-way');lamp(ref.x-1,ref.z,2);}
 const croce=refs[0];
 const braceria=world.buildings.find(b=>b.id==='824081');if(braceria){let edge=0,d=Infinity;for(let i=1;i<braceria.rings[0].length;i++){const n=nearest([croce.x,croce.z],braceria.rings[0][i-1],braceria.rings[0][i]);if(n.d<d){d=n.d;edge=i-1;}}const f=frontage(braceria,edge,world.terrain);sign(f,2,0,f.y+2.8,Math.min(f.width-1,4),.5);lamp(f.center[0]+f.nx*1.8,f.center[1]+f.nz*1.8,2);for(const u of [-3,3])tree(f.center[0]+f.dx*u+f.nx*1.3,f.center[1]+f.dz*u+f.nz*1.3,.7);for(let u=-3;u<3;u+=1.2){const at=(v,h)=>[f.center[0]+f.dx*v+f.nx*1.8,f.y+h,f.center[1]+f.dz*v+f.nz*1.8];rod(at(u,0),at(u,1));rod(at(u,1),at(u+1.2,1));rod(at(u,0),at(u+1.2,1),.018);rod(at(u,1),at(u+1.2,0),.018);}}
 const mural=world.buildings.find(b=>b.id==='823976');if(mural){let edge=0,d=Infinity;for(let i=1;i<mural.rings[0].length;i++){const n=nearest([croce.x,croce.z],mural.rings[0][i-1],mural.rings[0][i]);if(n.d<d){d=n.d;edge=i-1;}}const f=frontage(mural,edge,world.terrain);sign(f,4,0,f.y+2.2,Math.min(5.8,f.width-.3),2.3);}
 const fuelBar=world.buildings.find(b=>b.id==='846809');if(fuelBar){const f=frontage(fuelBar,0,world.terrain),yaw=Math.atan2(-f.dz,f.dx),at=(u,y,d)=>[f.center[0]+f.dx*u+f.nx*d,y,f.center[1]+f.dz*u+f.nz*d];
  // Pale shop front and two cream awnings, set on the actual east facade.
  box('brick',at(0,f.y+1.55,.035),[f.width,3.1,.05],yaw);for(const u of [-3.5,3.5]){box('glass',at(u,f.y+1.25,.10),[3.1,2.5,.05],yaw);box('cream',at(u,f.y+2.9,.85),[3.8,.12,1.6],yaw);box('cream',at(u,f.y+.3,1.6),[1.4,.6,.55],yaw);part(new THREE.IcosahedronGeometry(.55,1),'leaf',at(u,f.y+.9,1.6),[1,.7,.7]);}sign(f,1,0,f.y+2.65,2.4,.42,.14);
  const x=119,z=456,y=elevation(world.terrain,x,z);box('cream',[x,y+4.65,z],[14,.35,11]);for(const dx of [-4,4])for(const dz of [-3,3])box('cream',[x+dx,y+2.25,z+dz],[.3,4.5,.3]);for(const dz of [-2,2]){box('cream',[x,y+.6,z+dz],[1.1,1.2,.65]);box('glass',[x+.56,y+.85,z+dz],[.04,.5,.5]);}box('cream',[133,y+2.8,456],[.3,5.6,.3]);box('glass',[133,y+4.8,456],[1.6,1.2,.18]);
 }
 for(const [kind,parts]of buckets){const geometry=mergeGeometries(parts,false);for(const g of parts)g.dispose();const mesh=new THREE.Mesh(geometry,kind==='sign'?signMaterial:mats[kind]);mesh.name=`Local landmarks · ${kind}`;mesh.receiveShadow=true;group.add(mesh);}
 return group;
}
