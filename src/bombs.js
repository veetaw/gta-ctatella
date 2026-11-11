import {playBombSound} from './engine-audio.js';
import * as THREE from 'three';
import {createBombSimulation} from './bomb-physics.js';
export function makeBombs(scene,surfaceAt){
 const simulation=createBombSimulation(surfaceAt),dummy=new THREE.Object3D(),color=new THREE.Color();
 const bombs=new THREE.InstancedMesh(new THREE.SphereGeometry(.18,8,6),new THREE.MeshStandardMaterial({color:'#363c32',roughness:.8}),8),fire=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:'#fff0c1',transparent:true,opacity:.85,depthWrite:false}),8),smoke=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:'#3b3a37',transparent:true,opacity:.55,depthWrite:false}),8);
 bombs.name='Pooled arcade bombs';fire.name='Pooled explosion flashes';smoke.name='Pooled explosion smoke';for(const mesh of [bombs,fire,smoke]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);}
 function pose(mesh,i,x,y,z,scale,stretch=1){dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(scale,scale*stretch,scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
 let sounded=0;
 const update=dt=>{simulation.update(dt);const count=simulation.stats().explosions;if(count>sounded){playBombSound();sounded=count;}if(count<sounded)sounded=count;for(let i=0;i<8;i++){const b=simulation.bombs[i],e=simulation.bursts[i];pose(bombs,i,b.x,b.y,b.z,b.active?(b.shell?1.7:1):0,1.7);const t=e.age;pose(fire,i,e.x,e.y+1,e.z,e.active?Math.max(0,1-t/.55)*(1+t*12)*e.scale:0);color.setHSL(.12*Math.max(0,1-t/.55),1,.55);fire.setColorAt(i,color);pose(smoke,i,e.x,e.y+1+t*3,e.z,e.active?(1+t*3)*Math.max(0,1-t/2)*e.scale:0,1.25);}for(const mesh of [bombs,fire,smoke])mesh.instanceMatrix.needsUpdate=true;if(fire.instanceColor)fire.instanceColor.needsUpdate=true;};update(0);
 return {...simulation,update};
}
