import {sanVitoFacadeTexture,makeSanVitoTower} from './san-vito.js';
import {motherFacadeTexture,addMotherFacadeDetails,detailedMotherTower} from './mother-church.js';
import {tileMaterial} from './roof-material.js';
import {drawingCanvas,TEXTURE_ANISOTROPY} from './device-profile.js';
import {elevation} from './world-math.js';
import * as THREE from 'three';
import {churchPlan} from './church-plan.js';
function facadeTexture(){const c=drawingCanvas(1024);const g=c.getContext('2d');g.fillStyle='#ffffff';g.fillRect(0,0,1024,1024);let seed=17;for(let i=0;i<17000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%1024;seed=(Math.imul(seed,1664525)+1013904223)>>>0;g.fillStyle=i%2?'#bcb9aa14':'#ffffff17';g.fillRect(x,seed%1024,2,3);}g.fillStyle='#b8b5a7';g.fillRect(0,941,1024,83);for(const x of [22,934]){g.fillStyle='#c2bfb0';g.fillRect(x,0,68,1024);g.fillStyle='#e6e2d3';g.fillRect(x-7,415,82,22);}
 // One great wood portal with a dressed stone surround, no domestic shutters.
 g.fillStyle='#b1a897';g.fillRect(375,594,274,430);g.fillStyle='#e7dfcc';g.fillRect(389,608,246,416);g.fillStyle='#433124';g.fillRect(405,624,214,400);for(const x of [416,519])for(const y of [640,818]){g.fillStyle='#5d4330';g.fillRect(x,y,88,165);g.strokeStyle='#30251d';g.lineWidth=4;g.strokeRect(x+7,y+8,74,148);}g.fillStyle='#c6aa6c';for(const x of [498,525]){g.beginPath();g.arc(x,831,5,0,7);g.fill();}
 // Votive niche and three narrow upper monofore.
 g.fillStyle='#bab1a0';g.fillRect(458,429,108,130);g.fillStyle='#797966';g.fillRect(467,438,90,113);g.fillStyle='#b2a17e';g.beginPath();g.arc(512,471,15,0,7);g.fill();g.fillStyle='#8a9a9a';g.beginPath();g.moveTo(512,483);g.lineTo(482,540);g.lineTo(543,540);g.closePath();g.fill();
 for(const x of [340,486,632]){g.fillStyle='#b0aa9a';g.beginPath();g.roundRect(x-9,177,66,189,[32,32,1,1]);g.fill();g.fillStyle='#e8e4d8';g.beginPath();g.roundRect(x-3,184,54,175,[27,27,0,0]);g.fill();g.fillStyle='#35474b';g.beginPath();g.roundRect(x+5,193,38,159,[19,19,0,0]);g.fill();g.fillStyle='#8b8b76';g.fillRect(x+22,210,3,143);g.fillRect(x+5,266,38,3);}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=TEXTURE_ANISOTROPY;return tex;}
const ivory=new THREE.MeshStandardMaterial({color:'#dcd9cd',roughness:.94,side:THREE.DoubleSide}),stone=new THREE.MeshStandardMaterial({color:'#bcb8a8',roughness:.95}),iron=new THREE.MeshStandardMaterial({color:'#30332e',roughness:.7,metalness:.45}),bronze=new THREE.MeshStandardMaterial({color:'#806446',roughness:.66,metalness:.65});
function add(group,geometry,material,name){const m=new THREE.Mesh(geometry,material);m.castShadow=m.receiveShadow=true;m.name=name;group.add(m);return m;}
function box(group,at,size,material,name){const m=add(group,new THREE.BoxGeometry(...size),material,name);m.position.set(...at);return m;}
const sampledIvory=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.94,side:THREE.DoubleSide,vertexColors:true});
function tintGeometry(geometry,color){const rgb=new THREE.Color(color).toArray(),colors=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)colors.set(rgb,i);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));}
let churchFacade,motherFacade,vitoFacade;
export function makeChurch(scene,b,terrain){
 const mother=b.church?.variant==='mother-church',vito=b.church?.variant==='san-vito';const plan=churchPlan(b),group=new THREE.Group();group.name=`Chiesa · ${b.name||b.id}`;group.userData={buildingId:b.id,classification:b.classification,upperWindows:3,portalCount:1,bellCount:1,crossCount:1,hasShutters:false,roof:'symmetric-gable'};scene.add(group);churchFacade??=new THREE.MeshStandardMaterial({map:facadeTexture(),vertexColors:true,roughness:.96,side:THREE.DoubleSide});
 motherFacade??=new THREE.MeshStandardMaterial({map:motherFacadeTexture(),vertexColors:true,roughness:.96,side:THREE.DoubleSide});
 vitoFacade??=new THREE.MeshStandardMaterial({map:sanVitoFacadeTexture(),vertexColors:true,roughness:.96,side:THREE.DoubleSide});
 const floor=elevation(terrain,...plan.center),facadeHeight=b.church.ridgeY-floor,foundation=b.minGroundY-10;
 for(const ring of b.rings)for(let i=1;i<ring.length;i++){
  const a=ring[i-1],c=ring[i],isFront=ring===b.rings[0]&&i-1===plan.edge,len=Math.hypot(c[0]-a[0],c[1]-a[1]),breaks=[0,1],u0=plan.across(a)-plan.mid,u1=plan.across(c)-plan.mid;if(u0*u1<0)breaks.splice(1,0,u0/(u0-u1));
  const positions=[],uv=[];for(let j=1;j<breaks.length;j++){const t0=breaks[j-1],t1=breaks[j],p=t=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t],p0=p(t0),p1=p(t1),vertices=[[p0[0],foundation,p0[1]],[p1[0],foundation,p1[1]],[p1[0],plan.heightAt(p1),p1[1]],[p0[0],plan.heightAt(p0),p0[1]]];for(const k of [0,1,2,0,2,3]){const v=vertices[k];positions.push(...v);uv.push(k===0||k===3?t0:t1,(v[1]-floor)/facadeHeight);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();const sample=b.facadeColors?.find(f=>f.ring===b.rings.indexOf(ring)&&f.edge===i-1);tintGeometry(g,vito?'#ffffff':mother?b.church.facadeColor:sample?.color||b.wallColor||'#dcd9cd');add(group,g,isFront?(vito?vitoFacade:mother?motherFacade:churchFacade):sampledIvory,isFront?'Sacred facade · portal, votive niche, three monofore':'Unbroken ivory nave');
 }
 const roofPositions=[],roofUV=[];for(let tri of plan.triangles){tri=[...tri];const [a,c,d]=tri;if((c[0]-a[0])*(d[2]-a[2])-(c[2]-a[2])*(d[0]-a[0])>0)[tri[1],tri[2]]=[tri[2],tri[1]];for(const p of tri){roofPositions.push(...p);roofUV.push(p[0]/2,p[2]/2);}}
 const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(roofPositions,3));roof.setAttribute('uv',new THREE.Float32BufferAttribute(roofUV,2));roof.computeVertexNormals();
 tintGeometry(roof,vito?'#a65d40':mother?b.church.roofColor:b.roofColor||'#a46b4d');add(group,roof,tileMaterial(true),'Two sampled terracotta roof planes');
 for(const part of plan.parts)for(const ring of part)for(let i=0;i<ring.length-1;i++){const a=ring[i],c=ring[(i+1)%ring.length],length=Math.hypot(c[0]-a[0],c[1]-a[1]);const e=box(group,[(a[0]+c[0])/2,(plan.heightAt(a)+plan.heightAt(c))/2-.07,(a[1]+c[1])/2],[length,.2,.28],stone,'Stone projecting cornice');e.rotation.y=-Math.atan2(c[1]-a[1],c[0]-a[0]);e.rotation.z=Math.atan2(plan.heightAt(c)-plan.heightAt(a),length);}
 if(vito){group.userData={...group.userData,landmark:'san-vito',upperWindows:1,oculus:true,bellCount:0,crossCount:0,towerId:b.church.towerId};return group;}
 if(mother){addMotherFacadeDetails(group,b,plan,floor,box,stone);return group;}
 const at=(u,y,d=.12)=>[plan.center[0]+plan.dx*u+plan.nx*d,y,plan.center[1]+plan.dz*u+plan.nz*d],ridge=plan.heightAt([plan.center[0]+plan.dx*plan.mid,plan.center[1]+plan.dz*plan.mid]);
 const bellRoot=new THREE.Group();bellRoot.name='Campanile a vela · bronze bell and iron cross';bellRoot.position.set(...at(plan.mid,ridge+.02,.05));bellRoot.rotation.y=Math.atan2(plan.dz,-plan.dx);group.add(bellRoot);
 for(const x of [-.51,.51])box(bellRoot,[x,.65,0],[.24,1.3,.42],ivory,'Bell gable pier');
 const arch=new THREE.Shape();arch.absarc(0,1.18,.63,0,Math.PI,false);arch.lineTo(-.63,.98);arch.lineTo(-.38,.98);arch.absarc(0,1.18,.38,Math.PI,0,true);arch.lineTo(.63,1.18);const archMesh=add(bellRoot,new THREE.ExtrudeGeometry(arch,{depth:.42,bevelEnabled:false,curveSegments:16}),ivory,'Open masonry arch');archMesh.position.z=-.21;
 const bell=add(bellRoot,new THREE.LatheGeometry([new THREE.Vector2(.22,0),new THREE.Vector2(.24,.06),new THREE.Vector2(.17,.14),new THREE.Vector2(.13,.42),new THREE.Vector2(.07,.49),new THREE.Vector2(0,.5)],16),bronze,'Cast bronze bell');bell.position.y=.34;box(bellRoot,[0,.91,0],[.055,.24,.055],iron,'Bell hanger');const clapper=add(bellRoot,new THREE.SphereGeometry(.045,8,6),iron,'Bell clapper');clapper.position.y=.27;
 box(bellRoot,[0,2.16,0],[.055,.85,.055],iron,'Iron cross upright');box(bellRoot,[0,2.30,0],[.5,.055,.055],iron,'Iron cross arms');
 return group;
}
export function makeBellTower(scene,b){if(b.tower?.variant==='san-vito')return makeSanVitoTower(scene,b);const g=new THREE.Group();g.name=`Campanile · ${b.name||b.id}`;g.userData={buildingId:b.id,hasShutters:false,classification:'bell-tower'};scene.add(g);if(b.tower)return detailedMotherTower(g,b,box,stone,iron,bronze);const x=(b.bounds[0]+b.bounds[2])/2,z=(b.bounds[1]+b.bounds[3])/2,h=Math.max(8,b.height);box(g,[x,b.maxGroundY+h/2,z],[b.bounds[2]-b.bounds[0],h,b.bounds[3]-b.bounds[1]],new THREE.MeshStandardMaterial({color:b.wallColor||'#dcd9cd',roughness:.94}),'Stone bell tower');box(g,[x,b.maxGroundY+h+.5,z],[.06,1,.06],iron,'Cross');box(g,[x,b.maxGroundY+h+.65,z],[.5,.06,.06],iron,'Cross arm');return g;}
