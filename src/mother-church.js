import * as THREE from 'three';
import {drawingCanvas,TEXTURE_ANISOTROPY} from './device-profile.js';
export function motherFacadeTexture(){
 const c=drawingCanvas(1024),g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,1024,1024);g.fillStyle='#c2bba9';g.fillRect(0,969,1024,55);
 for(const x of [30,278,716,964]){g.fillStyle='#dfdbd0';g.fillRect(x-12,180,24,844);g.fillStyle='#bab3a3';g.fillRect(x-18,928,36,14);g.fillRect(x-19,195,38,16);}
 for(const [x,w,top] of [[418,188,540],[135,114,690],[775,114,690]]){g.fillStyle='#b9ad93';g.fillRect(x-15,top-16,w+30,1040-top);g.fillStyle='#4b3323';g.fillRect(x,top,w,1024-top);for(let j=0;j<8;j++){g.strokeStyle='#281f18';g.lineWidth=3;g.strokeRect(x+j*w/8+2,top+5,w/8-4,1020-top);}g.fillStyle='#9e8452';g.fillRect(x+w/2-8,top+(1024-top)*.65,3,23);}
 // Two upper side openings, with stone surrounds and no residential shutters.
 for(const x of [190,834]){g.fillStyle='#b1aa99';g.beginPath();g.roundRect(x-38,368,76,154,[36,36,0,0]);g.fill();g.fillStyle='#3e4c50';g.beginPath();g.roundRect(x-28,378,56,132,[26,26,0,0]);g.fill();g.fillStyle='#bbb2a1';g.fillRect(x-2,385,4,125);}
 g.fillStyle='#c6beab';g.fillRect(0,267,1024,15);g.fillStyle='#ebe5d6';g.fillRect(0,253,1024,14);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=TEXTURE_ANISOTROPY;return t;
}
export function addMotherFacadeDetails(group,b,plan,floor,box,stone){
 const at=(u,y,d=.14)=>[plan.center[0]+plan.dx*u+plan.nx*d,y,plan.center[1]+plan.dz*u+plan.nz*d];
 const width=plan.length,h=b.roofY-floor,portalTop=(b.church.ridgeY-floor)*(1-540/1024);
 for(const u of [-.46,-.23,.23,.46]){const p=box(group,at(width*u,floor+h/2),[.28,h,.28],stone,'Chiesa Madre · lesena in rilievo');p.rotation.y=-Math.atan2(plan.dz,plan.dx);for(const y of [floor+.2,b.roofY-.15]){const cap=box(group,at(width*u,y,.18),[.5,.22,.38],stone,'Capitello e base');cap.rotation.y=p.rotation.y;}}
 const lintel=box(group,at(0,floor+portalTop,.28),[width*.235,.22,.5],stone,'Portale · architrave in pietra');lintel.rotation.y=-Math.atan2(plan.dz,plan.dx);
 const shape=new THREE.Shape();shape.moveTo(-width*.125,0);shape.lineTo(width*.125,0);shape.lineTo(0,.72);shape.closePath();const pediment=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:false}),stone);pediment.position.set(...at(0,floor+portalTop+.12,.18));pediment.rotation.y=Math.atan2(-plan.dz,plan.dx);group.add(pediment);pediment.name='Timpano triangolare del portale';
 group.userData={...group.userData,landmark:'mother-church',portalCount:3,upperWindows:2,bellCount:0,crossCount:0,towerId:b.church.towerId};
}
export function detailedMotherTower(group,b,box,stone,iron,bronze){
 const {shaftHeight,belfryHeight,spireHeight}=b.tower,x=(b.bounds[0]+b.bounds[2])/2,z=(b.bounds[1]+b.bounds[3])/2,w=b.bounds[2]-b.bounds[0],d=b.bounds[3]-b.bounds[1],floor=b.maxGroundY,level=floor+shaftHeight,top=level+belfryHeight;
 const cream=new THREE.MeshStandardMaterial({color:b.tower.wallColor,roughness:.94}),roof=new THREE.MeshStandardMaterial({color:'#76594a',roughness:.9});
 const shape=new THREE.Shape(b.rings[0].map(p=>new THREE.Vector2(...p)));const shaft=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:level-(b.minGroundY-10),bevelEnabled:false}),cream);shaft.rotation.x=Math.PI/2;shaft.position.y=level;shaft.name='Campanile · fusto sul perimetro GIS';group.add(shaft);
 for(const y of [floor+.4,level-.25,top])box(group,[x,y,z],[w+.3,.26,d+.3],stone,'Cornice marcapiano del campanile');
 for(const sx of [-1,1])for(const sz of [-1,1])box(group,[x+sx*(w/2-.34),level+belfryHeight/2,z+sz*(d/2-.34)],[.68,belfryHeight,.68],cream,'Cella campanaria · pilastro angolare');
 // Four genuine open arches; no black painted openings on a solid box.
 for(let side=0;side<4;side++){
  const width=(side%2?d:w)-1.35,outer=width/2,inner=outer-.22,arch=new THREE.Shape();arch.absarc(0,0,outer,0,Math.PI,false);arch.lineTo(-inner,0);arch.absarc(0,0,inner,Math.PI,0,true);arch.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(arch,{depth:.3,bevelEnabled:false,curveSegments:10}),cream);mesh.position.set(x+(side===1?w/2-.15:side===3?-w/2+.15:0),top-outer,z+(side===0?d/2-.15:side===2?-d/2+.15:0));mesh.rotation.y=side*Math.PI/2;group.add(mesh);
 }
 for(const [dx,dz,r] of [[0,0,.5],[-.9,0,.3],[.9,0,.3],[0,-.9,.28],[0,.9,.28]]){const bell=new THREE.Mesh(new THREE.LatheGeometry([[r,0],[r*.9,.12],[r*.6,.4],[r*.4,.75],[0,.85]].map(p=>new THREE.Vector2(...p)),12),bronze);bell.position.set(x+dx,level+.6,z+dz);group.add(bell);box(group,[x+dx,level+1.6,z+dz],[.05,.6,.05],iron,'Sospensione campana');}
 const spire=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.76,spireHeight,4),roof);spire.rotation.y=Math.PI/4;spire.position.set(x,top+spireHeight/2,z);group.add(spire);spire.name='Cuspide piramidale a quattro falde';box(group,[x,top+spireHeight+.4,z],[.07,.8,.07],iron,'Croce');box(group,[x,top+spireHeight+.5,z],[.5,.07,.07],iron,'Braccio della croce');group.userData={...group.userData,openBelfry:true,bells:5,landmark:'mother-church-tower'};return group;
}
