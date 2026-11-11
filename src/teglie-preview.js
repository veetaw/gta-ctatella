import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {demElevation} from './world-math.js';
import {worldLocation} from './game-locations.js';

const status=document.querySelector('#preview-status');
try{
 const response=await fetch('/tmp/teglie-corridor/zone.json');
 if(!response.ok)throw Error('Dati locali di Teglie non disponibili');
 const {origin,terrain,roads,buildings,currentWest}=await response.json();
 const center=worldLocation(origin,{lat:40.6743718,lon:15.348612});
 const base=demElevation(terrain,center.x,center.z);
 const elevation=(x,z)=>demElevation(terrain,x,z)-base;
 const scene=new THREE.Scene();
 scene.background=new THREE.Color('#b9cfe2');
 const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,1,9000);
 camera.position.set(330,310,420);
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.setSize(innerWidth,innerHeight);
 document.body.append(renderer.domElement);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.maxPolarAngle=Math.PI*.49;
 controls.minDistance=30;controls.maxDistance=1450;
 scene.add(new THREE.HemisphereLight('#e6f1ff','#766e53',2));
 const sun=new THREE.DirectionalLight('#fff0d4',2);
 sun.position.set(-280,550,360);scene.add(sun);
 const map=await new THREE.TextureLoader().loadAsync('/tmp/teglie-corridor/ortofoto.jpg');
 map.colorSpace=THREE.SRGBColorSpace;
 map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const width=terrain.maxX-terrain.minX,depth=terrain.maxZ-terrain.minZ;
 const ground=new THREE.PlaneGeometry(width,depth,terrain.cols-1,terrain.rows-1);
 ground.rotateX(-Math.PI/2);
 const vertices=ground.attributes.position,uv=ground.attributes.uv;
 for(let i=0;i<vertices.count;i++){
  const x=terrain.minX+vertices.getX(i)+width/2,z=terrain.minZ+vertices.getZ(i)+depth/2;
  vertices.setXYZ(i,x-center.x,elevation(x,z),z-center.z);
  uv.setXY(i,(x-terrain.minX+terrain.cell/2)/(width+terrain.cell),1-(z-terrain.minZ+terrain.cell/2)/(depth+terrain.cell));
 }
 ground.computeVertexNormals();
 scene.add(new THREE.Mesh(ground,new THREE.MeshLambertMaterial({map})));

 const batches=new Map();
 function batch(geometry,material){
  if(geometry.index){const expanded=geometry.toNonIndexed();geometry.dispose();geometry=expanded;}
  geometry.deleteAttribute('uv');
  if(!batches.has(material))batches.set(material,[]);
  batches.get(material).push(geometry);
 }

 const roadMaterial=new THREE.MeshLambertMaterial({color:'#62635d',side:THREE.DoubleSide});
 for(const points of roads){
  const positions=[],indices=[];
  for(const [i,[x,z]] of points.entries()){
   const previous=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
   const dx=next[0]-previous[0],dz=next[1]-previous[1],length=Math.hypot(dx,dz)||1;
   for(const side of [-1,1]){
    const a=x+dz/length*side*2.1,b=z-dx/length*side*2.1;
    positions.push(a-center.x,elevation(a,b)+.14,b-center.z);
   }
   if(i){const n=i*2;indices.push(n-2,n-1,n,n,n-1,n+1);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  batch(geometry,roadMaterial);
 }

 const walls=['#e3d5bc','#d6c0a3','#e5dfce','#cbb49a'].map(color=>new THREE.MeshLambertMaterial({color}));
 const tile=new THREE.MeshLambertMaterial({color:'#92543f',side:THREE.DoubleSide});
 function trace(path,ring){
  ring.forEach(([x,z],i)=>i?path.lineTo(x-center.x,center.z-z):path.moveTo(x-center.x,center.z-z));
  path.closePath();return path;
 }
 for(const [i,rings] of buildings.entries()){
  const perimeter=rings[0].slice(0,-1);
  const groundY=perimeter.map(([x,z])=>elevation(x,z));
  const foundation=Math.min(...groundY)-.15,eaves=Math.max(...groundY)+3.1+(i%3)*.45;
  const outline=trace(new THREE.Shape(),rings[0]);
  outline.holes=rings.slice(1).map(ring=>trace(new THREE.Path(),ring));
  const wall=new THREE.ExtrudeGeometry(outline,{depth:eaves-foundation,bevelEnabled:false});
  wall.rotateX(-Math.PI/2);wall.translate(0,foundation,0);
  batch(wall,walls[i%walls.length]);

  const [sumX,sumZ]=perimeter.reduce(([a,b],[x,z])=>[a+x,b+z],[0,0]);
  const x=sumX/perimeter.length,z=sumZ/perimeter.length;
  const roofRing=perimeter.map(([a,b])=>[x+(a-x)*.67,z+(b-z)*.67]);
  const ridge=eaves+1.25,positions=[];
  function point([x,z],y){return [x-center.x,y,z-center.z];}
  for(const [j,p] of perimeter.entries()){
   const k=(j+1)%perimeter.length;
   const a=point(p,eaves),b=point(perimeter[k],eaves),c=point(roofRing[k],ridge),d=point(roofRing[j],ridge);
   positions.push(...a,...b,...c,...a,...c,...d);
  }
  const roof=new THREE.BufferGeometry();
  roof.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));roof.computeVertexNormals();
  batch(roof,tile);
  const cap=new THREE.ShapeGeometry(trace(new THREE.Shape(),roofRing));
  cap.rotateX(-Math.PI/2);cap.translate(0,ridge,0);
  batch(cap,tile);
 }
 for(const [material,geometries] of batches){
  scene.add(new THREE.Mesh(mergeGeometries(geometries),material));
  for(const geometry of geometries)geometry.dispose();
 }
 const seam=[];
 for(let z=terrain.minZ;z<=terrain.maxZ;z+=terrain.cell){
  seam.push(new THREE.Vector3(currentWest-center.x,elevation(currentWest,z)+.4,z-center.z));
 }
 const boundary=new THREE.Line(new THREE.BufferGeometry().setFromPoints(seam),new THREE.LineDashedMaterial({color:'#ffd877',dashSize:18,gapSize:10,depthTest:false}));
 boundary.computeLineDistances();scene.add(boundary);
 function overview(){
  const x=(terrain.minX+terrain.maxX)/2-center.x,z=(terrain.minZ+terrain.maxZ)/2-center.z;
  controls.target.set(x,0,z);camera.position.set(x+20,4800,z+20);controls.update();
 }
 controls.maxDistance=5200;
 document.querySelector('#overview').onclick=overview;
 document.querySelector('#village').onclick=()=>{
  controls.target.set(0,0,0);camera.position.set(330,310,420);controls.update();
 };
 function render(){renderer.render(scene,camera);}
 controls.addEventListener('change',render);
 window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);render();
 });
 overview();render();
 status.textContent=`${roads.length} tratti DBT · ${buildings.length} sagome con villette`;
}catch(error){
 status.textContent=error.message;
}
