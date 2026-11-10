import * as THREE from 'three';
import {makeBuildings} from './buildings.js';
import {createFacadeMaterial} from './facade-material.js';
import {createAsphaltMaterial} from './road-material.js';
import {makeTeglieDetails} from './teglie-details.js';
import {bankBatches} from './road-banks.js';
import {cutBelowRoad} from './terrain-geometry.js';
import {createRoadNetwork,SpatialIndex,ROAD_OFFSET} from './road-network.js';
import {installRoadSurface} from './world-math.js';
import {unpackResponse} from './world-assets.js';

const inBounds=(x,z,t)=>x>=t.minX&&x<=t.maxX&&z>=t.minZ&&z<=t.maxZ;
const clamp=THREE.MathUtils.clamp;

function sampleRaster(t,x,z){
 const u=clamp((x-t.minX)/t.cell,0,t.cols-1),v=clamp((z-t.minZ)/t.cellZ,0,t.rows-1);
 const col=Math.min(Math.floor(u),t.cols-2),row=Math.min(Math.floor(v),t.rows-2);
 const i=row*t.cols+col;
 const a=THREE.MathUtils.lerp(t.heights[i],t.heights[i+1],u-col);
 const b=THREE.MathUtils.lerp(t.heights[i+t.cols],t.heights[i+t.cols+1],u-col);
 return THREE.MathUtils.lerp(a,b,v-row);
}

export function nearOriginalEdge(original,a,b){
 const x=(a.x+b.x)/2,z=(a.z+b.z)/2;
 return Math.max(original.minX-x,x-original.maxX,original.minZ-z,z-original.maxZ)<95;
}

export function createTeglieRoadNetwork(world,zone,originalNetwork){
 const original=world.terrain,t=zone.terrain;
 const inside=(x,z)=>inBounds(x,z,original);
 const groundHeight=(x,z)=>{
  const bx=clamp(x,original.minX,original.maxX),bz=clamp(z,original.minZ,original.maxZ);
  const d=Math.hypot(x-bx,z-bz),raw=sampleRaster(t,x,z);
  if(d>=75)return raw;
  return raw+(originalNetwork.elevationAt(bx,bz)-sampleRaster(t,bx,bz))*(1-d/75);
 };
 const roadTerrain={...t,heights:new Float32Array(t.cols*t.rows)};
 for(let row=0;row<t.rows;row++)for(let col=0;col<t.cols;col++){
  const x=t.minX+col*t.cell,z=t.minZ+row*t.cell;
  roadTerrain.heights[row*t.cols+col]=inside(x,z)?originalNetwork.elevationAt(x,z):groundHeight(x,z);
 }
 return createRoadNetwork({origin:world.origin,terrain:roadTerrain,roads:zone.roads,buildings:[]});
}

export async function installTeglieWorld(scene,world,originalNetwork,showLoadStep){
 const url='/teglie/world.pack';
 const response=await fetch(url);
 if(response.status===404)return null;
 const zone=JSON.parse(new TextDecoder().decode(await unpackResponse(response)));
 const cachedEdges=zone.bakedBanks?fetch('/teglie/banks-v1.pack').then(unpackResponse).catch(()=>null):Promise.resolve(null);
 const original=world.terrain,t=zone.terrain;
 const contains=(x,z)=>Math.hypot(x-zone.center.x,z-zone.center.z)<=510;
 const inside=(x,z)=>inBounds(x,z,original);
 await showLoadStep?.(68,'Preparazione delle strade di Teglie…');
 const extension=createTeglieRoadNetwork(world,zone,originalNetwork);
 const pavementAt=(x,z)=>(inside(x,z)?originalNetwork.pavementAt(x,z):null)??extension.pavementAt(x,z);
 const height=(x,z)=>pavementAt(x,z)?.y??(inside(x,z)?originalNetwork.elevationAt(x,z):extension.elevationAt(x,z));
 const closestSegment=(x,z)=>{
  const a=originalNetwork.closestSegment(x,z),b=extension.closestSegment(x,z);
  return a&&(!b||a.d<=b.d)?a:b;
 };
 const terrain={...original,minX:t.minX,minZ:t.minZ,maxX:original.maxX,maxZ:original.maxZ};
 const network={...originalNetwork,terrain,roads:[...originalNetwork.roads,...extension.roads],closestSegment,pavementAt,elevationAt:height};
 installRoadSurface(terrain,network);
 const root=new THREE.Group();root.name='Teglie e corridoio occidentale';scene.add(root);
 const texture=new THREE.TextureLoader().load('/teglie/ortofoto.webp');
 texture.colorSpace=THREE.SRGBColorSpace;
 const photo=zone.photoBounds??{minX:t.minX-t.cell/2,maxX:t.maxX+t.cell/2,minZ:t.minZ-t.cellZ/2,maxZ:t.maxZ+t.cellZ/2};
 const earth=new THREE.MeshStandardMaterial({map:texture,roughness:1});
 const terrainTiles=[],seamHeights=new Map();
 const rectangles=[
  [terrain.minX,terrain.minZ,terrain.maxX,original.minZ],
  [terrain.minX,original.minZ,original.minX,terrain.maxZ],
 ];
 const tileCount=rectangles.reduce((total,[left,top,right,bottom])=>
  total+Math.ceil((right-left)/240)*Math.ceil((bottom-top)/240),0);
 await showLoadStep?.(72,'Preparazione del terreno di Teglie…');
 for(const [left,top,right,bottom] of rectangles){
  for(let z0=top;z0<bottom;z0+=240)for(let x0=left;x0<right;x0+=240){
   const width=Math.min(240,right-x0),depth=Math.min(240,bottom-z0);
   const nearRoad=extension.triangleIndex.box([x0,z0,x0+width,z0+depth]).length>0;
   const step=nearRoad?2.5:10,cols=Math.ceil(width/step),rows=Math.ceil(depth/step);
   const geometry=new THREE.PlaneGeometry(width,depth,cols,rows);
   geometry.rotateX(-Math.PI/2);
   const p=geometry.attributes.position,uv=geometry.attributes.uv;
   for(let i=0;i<p.count;i++){
    const x=x0+p.getX(i)+width/2,z=z0+p.getZ(i)+depth/2;
    p.setXYZ(i,x,height(x,z)-.075,z);
    uv.setXY(i,(x-photo.minX)/(photo.maxX-photo.minX),1-(z-photo.minZ)/(photo.maxZ-photo.minZ));
   }
   if(nearRoad)cutBelowRoad(p.array,geometry.index.array,extension);
   const boundary=[];
   for(let i=0;i<p.count;i++){
    const col=i%(cols+1),row=Math.floor(i/(cols+1));
    if(col&&col<cols&&row&&row<rows)continue;
    const key=`${Math.round(p.getX(i)*1000)}/${Math.round(p.getZ(i)*1000)}`;
    seamHeights.set(key,Math.min(seamHeights.get(key)??Infinity,p.getY(i)));
    boundary.push([i,key]);
   }
   terrainTiles.push({geometry,boundary});
   if(showLoadStep&&terrainTiles.length%16===0)
    await showLoadStep(72+Math.floor(10*terrainTiles.length/tileCount),'Preparazione del terreno di Teglie…');
  }
 }
 for(const {geometry,boundary} of terrainTiles){
  const positions=geometry.attributes.position;
  for(const [i,key] of boundary)positions.setY(i,seamHeights.get(key));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,earth);mesh.receiveShadow=true;root.add(mesh);
 }

 await showLoadStep?.(83,'Preparazione dell’asfalto e delle banchine…');
 const asphalt=createAsphaltMaterial(),batches=new Map();
 for(const triangle of extension.triangles){
  const [a,b,c]=triangle.points,x=(a[0]+b[0]+c[0])/3,z=(a[1]+b[1]+c[1])/3;
  if(inside(x,z)&&originalNetwork.pavementAt(x,z))continue;
  const key=`${Math.floor(x/180)}/${Math.floor(z/180)}`;
  if(!batches.has(key))batches.set(key,{positions:[],uv:[]});
  const batch=batches.get(key);
  const upward=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<=0;
  for(const i of upward?[0,1,2]:[0,2,1]){
   const [x,z]=triangle.points[i];
   batch.positions.push(x,triangle.y[i]+ROAD_OFFSET,z);
   batch.uv.push(x/4,z/4);
  }
 }
 for(const {positions,uv} of batches.values()){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,asphalt);mesh.name='Asfalto Teglie';mesh.receiveShadow=true;root.add(mesh);
 }
 const verge=new THREE.MeshStandardMaterial({color:'#918977',roughness:1,side:THREE.DoubleSide});
 const edges=new Map();
 function addEdges(vertices){
  for(let i=0;i<vertices.length;i+=9){
   const x=(vertices[i]+vertices[i+3]+vertices[i+6])/3,z=(vertices[i+2]+vertices[i+5]+vertices[i+8])/3;
   if(inside(x,z))continue;
   const key=`${Math.floor(x/180)}/${Math.floor(z/180)}`;
   if(!edges.has(key))edges.set(key,[]);
   const tile=edges.get(key);
   for(let j=i;j<i+9;j++)tile.push(vertices[j]);
  }
 }
 function addVerge(positions,indices){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  if(indices)geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,verge);
  mesh.name='Banchine e bordi Teglie';mesh.receiveShadow=true;root.add(mesh);
 }
 const baked=await cachedEdges;
 if(baked){
  const data=new Int32Array(baked);
  for(let offset=0;offset<data.length;){
   const vertexValues=data[offset++],indexCount=data[offset++];
   const previous=[0,0,0],positions=new Float32Array(vertexValues);
   for(let i=0;i<vertexValues;i++)positions[i]=(previous[i%3]+=data[offset++])/100;
   const indices=vertexValues/3<=65536?new Uint16Array(indexCount):new Uint32Array(indexCount);
   let index=0;
   for(let i=0;i<indexCount;i++)indices[i]=(index+=data[offset++]);
   addVerge(positions,indices);
  }
 }
 for(const {positions,seals} of bankBatches(extension,(a,b)=>!baked||nearOriginalEdge(original,a,b))){
  addEdges(positions);addEdges(seals);
 }
 for(const positions of edges.values())addVerge(Float32Array.from(positions));
 await showLoadStep?.(88,'Preparazione degli edifici e dei lampioni di Teglie…');
 const index=new SpatialIndex(24),blocks=new Map(),atlas=createFacadeMaterial();
 for(const [i,building] of zone.buildings.entries()){
  const levels=building.rings.flat().map(([x,z])=>height(x,z));
  building.minGroundY=Math.min(...levels);
  building.maxGroundY=Math.max(...levels);
  building.area=building.rings[0].slice(1).reduce((area,[x,z],i)=>{
   const [a,b]=building.rings[0][i];return area+a*z-b*x;
  },0);
  building.area=Math.abs(building.area)/2;
  building.height=building.area>65&&i%3===0?6.6:3.55;
  building.roofY=building.maxGroundY+building.height;
  const [x,z]=building.bounds,key=`${Math.floor(x/240)}/${Math.floor(z/240)}`;
  if(!blocks.has(key))blocks.set(key,[]);
  blocks.get(key).push(building);
  index.insert({...building,roofY:building.roofY+1.6},building.bounds);
 }
 const balconies=[];
 for(const buildings of blocks.values()){
  const group=makeBuildings(root,{origin:world.origin,terrain,buildings},{atlas,localDetails:false,onBalcony:spot=>{if(contains(spot.x,spot.z))balconies.push(spot);}});
  for(const mesh of group.children)mesh.castShadow=false;
 }
 const {nightLamps,colliders}=makeTeglieDetails(root,{origin:world.origin,terrain,buildings:zone.buildings},
  {...extension,pavementAt,elevationAt:height},zone.details??[],inside,contains);
 const boundaryIndex=new SpatialIndex(24);
 for(const b of colliders)boundaryIndex.insert(b,b.bounds);
 // Prepare the horizontal bounds once so fog can also cap geometry work.
 const tileBounds=root.children.map(child=>{
  const box=new THREE.Box3().setFromObject(child);
  return {child,box};
 });
 let lastX=Infinity,lastZ=Infinity,lastRange;
 function updateVisibility(x,z,range){
  if(range===lastRange&&Math.hypot(x-lastX,z-lastZ)<20)return;
  lastX=x;lastZ=z;lastRange=range;
  for(const {child,box} of tileBounds){
   const dx=Math.max(box.min.x-x,0,x-box.max.x),dz=Math.max(box.min.z-z,0,z-box.max.z);
   child.visible=Math.hypot(dx,dz)<=range;
  }
 }
 world.teglie=zone.arrival??zone.center;
 world.terrain=terrain;
 world.roads=[...world.roads,...zone.roads];
 world.buildings=[...world.buildings,...zone.buildings];
 return {network,center:zone.center,gate:zone.gate,roads:extension.roads,height,
  contains,nightLamps,balconies,updateVisibility,
  solidsNear(x,z,r,includeBuildings){
   const box=[x-r,z-r,x+r,z+r],boundaries=boundaryIndex.box(box);
   return includeBuildings?boundaries.concat(index.box(box)):boundaries;
  }};
}
