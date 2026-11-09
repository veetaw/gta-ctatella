import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {HELICOPTER_SPEC} from './helicopter-physics.js';
export function makeHelicopter(scene){
 const root=new THREE.Group(),body=new THREE.Group(),rotor=new THREE.Group(),tailRotor=new THREE.Group();root.name='Elicottero';root.add(body);root.visible=false;scene.add(root);
 const paint=new THREE.MeshStandardMaterial({color:'#cf5635',roughness:.6,metalness:.15}),dark=new THREE.MeshStandardMaterial({color:'#202b30',roughness:.7}),glass=new THREE.MeshStandardMaterial({color:'#5c91a5',metalness:.25,roughness:.15}),metal=new THREE.MeshStandardMaterial({color:'#bbc1b6',roughness:.6});
 function mesh(geo,mat,x,y,z,parent=body){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
 function box(w,h,d,mat,x,y,z,parent){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
 const cabin=mesh(new THREE.SphereGeometry(1,12,8),paint,0,1.25,.4);cabin.scale.set(1.12,1.05,1.95);
 const window=mesh(new THREE.SphereGeometry(1,12,8),glass,0,1.55,1.18);window.scale.set(1.01,.73,1.27);
 box(.10,1.35,.12,paint,0,1.4,2.13);box(2.08,.12,.12,paint,0,1.17,1.85);
 const tail=mesh(new THREE.CylinderGeometry(.18,.42,4.1,8),paint,0,1.34,-3);tail.rotation.x=-Math.PI/2;
 box(.16,1.7,1.15,paint,0,2.0,-4.75);box(2.5,.12,.7,paint,0,1.55,-4.15);
 for(const x of [-1.05,1.05]){box(.12,.15,3.8,dark,x,.13,.25);for(const z of [-.7,1.1]){const support=box(.09,.75,.09,metal,x*.8,.52,z);support.rotation.z=-Math.sign(x)*.25;}}
 box(.2,.65,.2,metal,0,2.55,0);body.add(rotor);rotor.position.set(0,2.9,0);box(9.3,.055,.24,dark,0,0,0,rotor);box(.24,.055,9.3,dark,0,0,0,rotor);
 body.add(tailRotor);tailRotor.position.set(.24,2.1,-4.8);box(.06,1.5,.12,dark,0,0,0,tailRotor);box(.06,.12,1.5,dark,0,0,0,tailRotor);
 // Four static material batches plus two animated rotors; no textures.
 body.updateMatrixWorld(true);const buckets=new Map();for(const m of [...body.children]){if(!m.isMesh)continue;const g=m.geometry.clone().applyMatrix4(m.matrix);if(!buckets.has(m.material))buckets.set(m.material,[]);buckets.get(m.material).push(g);body.remove(m);m.geometry.dispose();}
 for(const [mat,parts]of buckets){const m=new THREE.Mesh(mergeGeometries(parts,false),mat);for(const g of parts)g.dispose();body.add(m);}
 return {root,body,rotor,tailRotor,spec:HELICOPTER_SPEC,x:0,z:0,y:0,yaw:0,speed:0,verticalSpeed:0,altitude:0,integrity:100};
}
export function updateHelicopter(h,dt,forward=0,turn=0){h.root.position.set(h.x,h.y,h.z);h.root.rotation.y=h.yaw;h.body.rotation.x=THREE.MathUtils.lerp(h.body.rotation.x,forward*.12,1-Math.exp(-dt*3));h.body.rotation.z=THREE.MathUtils.lerp(h.body.rotation.z,-turn*.12,1-Math.exp(-dt*3));h.rotor.rotation.y=(h.rotor.rotation.y+dt*38)%(Math.PI*2);h.tailRotor.rotation.x=(h.tailRotor.rotation.x+dt*55)%(Math.PI*2);}
