import {makePistol} from './pistol-model.js';
import * as THREE from 'three';
export function makeRaidModels(scene){
 const root=new THREE.Group();root.name='Invasori · pool di otto';scene.add(root);const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.92}),cloth=mat('#815447'),skin=mat('#c69a7c'),dark=mat('#292d2a'),metal=mat('#414846'),red=new THREE.MeshBasicMaterial({color:'#ec674f'}),parts=[];
 function batch(geometry,material,count,pose){const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);parts.push({mesh,pose,count});}
 batch(new THREE.CylinderGeometry(.2,.25,.65,7).translate(0,1.09,0),cloth,8,()=>({}));
 batch(new THREE.SphereGeometry(.15,7,5).translate(0,1.63,0),skin,8,()=>({}));
 batch(new THREE.SphereGeometry(.18,7,5).scale(1,.55,1).translate(0,1.76,-.02),dark,8,()=>({}));
 batch(new THREE.BoxGeometry(.14,.65,.16),dark,16,(e,k,t)=>({x:k?.13:-.13,y:.4,z:Math.sin(t*7+k*Math.PI+e.slot)*.09,rx:e.moving?Math.sin(t*7+k*Math.PI)*.24:0}));
 batch(new THREE.BoxGeometry(.13,.14,.54),metal,8,()=>({x:.23,y:1.25,z:.3}));
 batch(new THREE.BoxGeometry(.11,.13,.4),cloth,16,(_e,k)=>({x:k?.26:-.19,y:1.25,z:.18,ry:k?0:.5}));
 batch(new THREE.BoxGeometry(.06,.06,.06),red,8,e=>({x:.23,y:1.25,z:.6,scale:e.cooldown<.55?1:0}));
 batch(new THREE.BoxGeometry(.55,.045,.045),red,8,e=>({y:2.02,scale:Math.max(.1,e.hp/e.maxHp)}));
 const dummy=new THREE.Object3D(),zero=new THREE.Matrix4().makeScale(0,0,0);
 function render(enemies,time){root.visible=enemies.some(e=>e.active);for(const {mesh,pose,count}of parts){const copies=count/8;for(let slot=0;slot<8;slot++){const e=enemies[slot];for(let k=0;k<copies;k++){const index=slot*copies+k;if(!e?.active){mesh.setMatrixAt(index,zero);continue;}const p=pose(e,k,time),c=Math.cos(e.yaw),s=Math.sin(e.yaw);dummy.position.set(e.x+c*(p.x||0)+s*(p.z||0),e.y+(p.y||0),e.z-s*(p.x||0)+c*(p.z||0));dummy.rotation.set(p.rx||0,e.yaw+(p.ry||0),0);dummy.scale.setScalar(p.scale??1);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}}mesh.instanceMatrix.needsUpdate=true;}}
 const pistol=makePistol();
 render([],0);return {root,gun:pistol.gun,selectGun:pistol.select,render,fire:pistol.fire,updateGun:pistol.update};
}
