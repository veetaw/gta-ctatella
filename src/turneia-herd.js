import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Shared geometry and instancing keep the entire flock at seven draw calls.
export function makeTurneiaHerd(scene){
 const root=new THREE.Group();root.name='Turneia · 2 Lu Muanz tricolore e 24 pecore';scene.add(root);
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:1});
 function body(ox){const parts=[];const ellipsoid=(x,y,z,sx,sy,sz)=>{parts.push(new THREE.SphereGeometry(1,8,6).scale(sx,sy,sz).translate(x,y,z));};
 ellipsoid(0,ox?1.05:.65,0,ox?.52:.34,ox?.55:.34,ox?.95:.52);ellipsoid(0,ox?1.35:.77,ox?.98:.53,ox?.3:.18,ox?.36:.21,ox?.38:.23);
 if(!ox)for(let i=0;i<5;i++)ellipsoid(Math.sin(i*2)*.18,.8,Math.cos(i*2)*.26,.26,.22,.26);
 return mergeGeometries(parts.map(g=>{const a=g.toNonIndexed();g.dispose();return a;}),false);}
 function details(ox){const parts=[];for(const x of [-1,1])for(const z of [-1,1])parts.push(new THREE.BoxGeometry(ox?.16:.09,ox?.65:.39,ox?.17:.1).translate(x*(ox?.35:.23),ox?.38:.22,z*(ox?.61:.34)));
 for(const x of [-1,1])parts.push(new THREE.ConeGeometry(ox?.11:.09,ox?.55:.17,6).rotateZ(-x*.55).translate(x*(ox?.34:.21),ox?1.8:.95,ox?.96:.57));
 const result=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());return result;}
 const sheepBody=new THREE.InstancedMesh(body(false).scale(.65,.65,.65),mat('#f6f1df'),24),sheepDetails=new THREE.InstancedMesh(details(false).scale(.65,.65,.65),mat('#52453c'),24),oxBody=new THREE.InstancedMesh(body(true),mat('#957352'),2),oxDetails=new THREE.InstancedMesh(details(true),mat('#eadcba'),2);
 const cloth=new THREE.BoxGeometry(.36,.12,1.45),clothMeshes=['#008c45','#ffffff','#cd212a'].map(color=>new THREE.InstancedMesh(cloth,mat(color),2));
 const meshes=[sheepBody,sheepDetails,oxBody,oxDetails,...clothMeshes];for(const mesh of meshes){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;root.add(mesh);}
 const dummy=new THREE.Object3D();
 return {root,render(animals,height){animals.forEach((a,i)=>{dummy.scale.setScalar(i<2?.42:1);dummy.position.set(a.x,height(a.x,a.z),a.z);dummy.rotation.set(0,a.yaw||0,0);dummy.updateMatrix();for(const mesh of i<2?[oxBody,oxDetails]:[sheepBody,sheepDetails])mesh.setMatrixAt(i<2?i:i-2,dummy.matrix);if(i<2)clothMeshes.forEach((mesh,k)=>{dummy.position.set(a.x+Math.cos(a.yaw||0)*(k-1)*.36*.42,height(a.x,a.z)+1.56*.42,a.z-Math.sin(a.yaw||0)*(k-1)*.36*.42);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});});for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;}};
}
