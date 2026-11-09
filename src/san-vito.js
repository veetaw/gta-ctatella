import * as THREE from 'three';import {drawingCanvas,TEXTURE_ANISOTROPY} from './device-profile.js';
function canvasTexture(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=TEXTURE_ANISOTROPY;return t;}
export function sanVitoFacadeTexture(){const c=drawingCanvas(1024),g=c.getContext('2d');g.fillStyle='#faf9f4';g.fillRect(0,0,1024,1024);g.fillStyle='#bebaae';g.fillRect(0,960,1024,64);
 // Deep circular oculus with a pale masonry surround.
 for(const [r,color] of [[105,'#c6c2b5'],[88,'#f4f0e6'],[73,'#35434a']]){g.fillStyle=color;g.beginPath();g.arc(512,270,r,0,Math.PI*2);g.fill();}g.strokeStyle='#bbb6a5';g.lineWidth=7;g.beginPath();g.moveTo(439,270);g.lineTo(585,270);g.moveTo(512,197);g.lineTo(512,343);g.stroke();
 g.fillStyle='#b8af9c';g.fillRect(350,590,324,434);g.fillStyle='#e2dbcb';g.fillRect(367,607,290,417);g.fillStyle='#443024';g.fillRect(385,625,254,399);for(let i=0;i<10;i++){g.strokeStyle='#291e18';g.lineWidth=3;g.strokeRect(387+i*25,631,22,387);}g.fillStyle='#9b7c48';g.fillRect(500,813,6,37);g.fillRect(520,813,6,37);return canvasTexture(c);}
export function makeSanVitoTower(scene,b){
 const group=new THREE.Group();group.name='San Vito · torretta laterale con feritoie';group.userData={buildingId:b.id,landmark:'san-vito-tower',slitWindows:true,bellCount:1,hasShutters:false};scene.add(group);
 const c=drawingCanvas(512),ctx=c.getContext('2d');ctx.fillStyle='#f3f1e9';ctx.fillRect(0,0,512,512);for(const y of [150,326]){ctx.fillStyle='#aaa596';ctx.fillRect(236,y,40,106);ctx.fillStyle='#344047';ctx.fillRect(246,y+8,20,90);}
 const map=canvasTexture(c),wall=new THREE.MeshStandardMaterial({map,roughness:.96,side:THREE.DoubleSide}),white=new THREE.MeshStandardMaterial({color:'#eeece3',roughness:.96}),iron=new THREE.MeshStandardMaterial({color:'#383a35',roughness:.8}),bronze=new THREE.MeshStandardMaterial({color:'#8d704a',metalness:.5,roughness:.7}),roof=new THREE.MeshStandardMaterial({color:'#a76c51',roughness:.95});
 const base=b.maxGroundY,shaft=base+b.tower.shaftHeight,top=shaft+b.tower.belfryHeight,x=(b.bounds[0]+b.bounds[2])/2,z=(b.bounds[1]+b.bounds[3])/2,w=b.bounds[2]-b.bounds[0],d=b.bounds[3]-b.bounds[1],positions=[],uv=[];
 for(const ring of b.rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],v=ring[i],q=[[a[0],b.minGroundY-10,a[1]],[v[0],b.minGroundY-10,v[1]],[v[0],shaft,v[1]],[a[0],shaft,a[1]]];for(const k of [0,1,2,0,2,3]){positions.push(...q[k]);uv.push(k===0||k===3?0:1,(q[k][1]-base)/b.tower.shaftHeight);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();group.add(new THREE.Mesh(geo,wall));
 const box=(p,s,m)=>{const a=new THREE.Mesh(new THREE.BoxGeometry(...s),m);a.position.set(...p);group.add(a);return a;};
 for(const y of [base+.2,shaft,top])box([x,y,z],[w+.18,.2,d+.18],white);
 for(const sx of [-1,1])for(const sz of [-1,1])box([x+sx*(w/2-.21),shaft+b.tower.belfryHeight/2,z+sz*(d/2-.21)],[.42,b.tower.belfryHeight,.42],white);
 const bell=new THREE.Mesh(new THREE.LatheGeometry([[.33,0],[.3,.12],[.18,.4],[.10,.64],[0,.7]].map(p=>new THREE.Vector2(...p)),12),bronze);bell.position.set(x,shaft+.3,z);group.add(bell);box([x,shaft+1.25,z],[.05,.6,.05],iron);
 const cap=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.77,b.tower.spireHeight,4),roof);cap.rotation.y=Math.PI/4;cap.position.set(x,top+b.tower.spireHeight/2,z);group.add(cap);box([x,top+b.tower.spireHeight+.3,z],[.045,.6,.045],iron);box([x,top+b.tower.spireHeight+.4,z],[.35,.045,.045],iron);
 group.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});return group;
}
