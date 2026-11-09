import {MOBILE,TEXTURE_ANISOTROPY} from './device-profile.js';
import {indexNearbyDetail} from './distance-detail.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Bake only the static world, before actors are installed. Preserve custom facade
// attributes and shader materials, and collapse road material runs into one draw.
export function batchStaticWorld(scene,renderer){
 scene.updateMatrixWorld(true);const buckets=new Map(),remove=[],canonical=new Map();let before=0;
 scene.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||mesh.material?.isShaderMaterial||mesh.userData.keepGeometry)return;
  const source=mesh.geometry;if(!source.attributes.position?.count)return;
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const groups=Array.isArray(mesh.material)?source.groups:[{start:0,count:source.index?.count??source.attributes.position.count,materialIndex:0}];
  before+=groups.length;
  for(const range of groups){if(!range.count)continue;let mat=mats[range.materialIndex];
   // Materials with custom shader closures must retain their identity.
   if(mat.onBeforeCompile===THREE.Material.prototype.onBeforeCompile){const signature=JSON.stringify([mat.type,mat.color?.getHex(),mat.emissive?.getHex(),mat.emissiveIntensity,mat.roughness,mat.metalness,mat.side,mat.transparent,mat.opacity,mat.alphaTest,...['map','bumpMap','roughnessMap','normalMap'].map(k=>mat[k]?.uuid),mat.polygonOffset,mat.polygonOffsetFactor,mat.polygonOffsetUnits]);if(canonical.has(signature))mat=canonical.get(signature);else canonical.set(signature,mat);}
   const schema=Object.entries(source.attributes).map(([k,a])=>`${k}:${a.itemSize}:${a.normalized}`).sort().join(',');
   const secondary=/DBT|shoulder|foundation|aprons|intersection/i.test(mesh.name+' '+mesh.parent?.name)||/rail|cornice/i.test(mesh.name);const shadow=!MOBILE&&mesh.castShadow&&!mat.transparent&&!/railings/i.test(mesh.name)&&!(secondary&&['49534d','c4bfac','807055'].includes(mat.color?.getHexString()));
   const key=`${mat.uuid}/${shadow}/${mesh.receiveShadow}/${secondary}/${schema}`;
   if(!buckets.has(key))buckets.set(key,{material:mat,shadow,receive:mesh.receiveShadow,secondary,names:new Set(),geometries:[]});
   let geo;
   if(groups.length===1&&!source.index)geo=source.clone();else{
    geo=new THREE.BufferGeometry();for(const [name,attr]of Object.entries(source.attributes)){const data=new attr.array.constructor(range.count*attr.itemSize);for(let j=0;j<range.count;j++){const n=source.index?source.index.getX(range.start+j):range.start+j;for(let k=0;k<attr.itemSize;k++)data[j*attr.itemSize+k]=attr.array[n*attr.itemSize+k];}geo.setAttribute(name,new THREE.BufferAttribute(data,attr.itemSize,attr.normalized));}
   }
   geo.clearGroups();geo.applyMatrix4(mesh.matrixWorld);buckets.get(key).geometries.push(geo);buckets.get(key).names.add(mesh.name||mesh.parent?.name||'terrain');
  }remove.push(mesh);
 });
 const result=new THREE.Group();result.name='Static world · batched by material';
 for(const b of buckets.values()){const geo=b.geometries.length===1?b.geometries[0]:mergeGeometries(b.geometries,false);if(!geo)throw Error('Static material batch failed');if(b.geometries.length>1)for(const g of b.geometries)g.dispose();geo.computeBoundingSphere();const mesh=new THREE.Mesh(geo,b.material);mesh.castShadow=b.shadow;mesh.receiveShadow=b.receive;mesh.name=[...b.names].slice(0,2).join(' / ');if(b.secondary)mesh.userData.updateDetail=indexNearbyDetail(mesh,260);else if(geo.attributes.position.count>15000)mesh.userData.updateDetail=indexNearbyDetail(mesh,Infinity,true);result.add(mesh);
  if(mesh.castShadow&&geo.attributes.position.count>3000){
   // Use the exact same walls/eaves/roofs for nearby shadows, sharing vertex
   // buffers. A colorless proxy prevents the shadow pass processing the town.
   mesh.castShadow=false;const shadowGeo=new THREE.BufferGeometry();for(const [name,attr]of Object.entries(geo.attributes))shadowGeo.setAttribute(name,attr);shadowGeo.boundingSphere=geo.boundingSphere;
   const proxy=new THREE.Mesh(shadowGeo,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:b.material.side}));proxy.castShadow=true;proxy.name='Local shadow geometry';proxy.userData.updateDetail=indexNearbyDetail(proxy,110);result.add(proxy);
  }}
 for(const m of remove){m.removeFromParent();m.geometry.dispose();}scene.add(result);
 const maxAniso=Math.min(TEXTURE_ANISOTROPY,renderer.capabilities.getMaxAnisotropy());scene.traverse(m=>{if(!m.isMesh)return;for(const mat of Array.isArray(m.material)?m.material:[m.material])for(const k of ['map','bumpMap','roughnessMap','normalMap'])if(mat[k]){mat[k].generateMipmaps=true;mat[k].minFilter=THREE.LinearMipmapLinearFilter;mat[k].anisotropy=maxAniso;mat[k].needsUpdate=true;}});
 result.userData.updateDetail=(x,z,camera)=>{for(const m of result.children)m.userData.updateDetail?.(x,z,camera);};result.userData={...result.userData,sourceDraws:before,materialBatches:result.children.length};document.documentElement.dataset.geometry=JSON.stringify(result.children.map(m=>({name:m.name,triangles:m.geometry.attributes.position.count/3,shadow:m.castShadow})).sort((a,b)=>b.triangles-a.triangles).slice(0,18));return result;
}
const sunForward=new THREE.Vector3(),sunRight=new THREE.Vector3(),sunUp=new THREE.Vector3(),sunPoint=new THREE.Vector3(),worldUp=new THREE.Vector3(0,1,0);
export function snapSunShadow(light,sun,x,y,z){
 // Snap in light-space, not world X/Z: the shadow projection then stays on
 // the same 4096² texel lattice when the vehicle moves by a fraction of a pixel.
 const forward=sunForward.copy(sun).normalize(),right=sunRight.crossVectors(worldUp,forward).normalize(),up=sunUp.crossVectors(forward,right),p=sunPoint.set(x,y,z),texel=180/light.shadow.mapSize.x;
 const a=p.dot(right),b=p.dot(up);p.addScaledVector(right,Math.round(a/texel)*texel-a).addScaledVector(up,Math.round(b/texel)*texel-b);
 light.target.position.copy(p);light.position.copy(p).addScaledVector(sun,350);
}
