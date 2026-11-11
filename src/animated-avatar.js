import * as THREE from 'three';
import {normalizeAppearance,AVATAR_DEFAULTS} from './avatar-appearance.js';
import {hqEnabled} from './graphics-mode.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from './avatar-assets/character.glb?url';
import maleUrl from './avatar-assets/male.webp?url';
import femaleUrl from './avatar-assets/female.webp?url';

export function installAnimatedAvatar(person,variant){
 let appearance=normalizeAppearance({variant}),avatar,material,surface,renderer,textureCache=new Map(),hqGeometries=new Map(),appearanceVersion=0;
 const meshes=[];
 async function customize(next,webgl){
  appearance=normalizeAppearance({...appearance,...next});renderer=webgl||renderer;const version=++appearanceVersion;
  if(!avatar)return appearance;
  let texture=textureCache.get(appearance.variant);if(!texture){texture=await new THREE.TextureLoader().loadAsync(appearance.variant==='female'?femaleUrl:maleUrl);texture.colorSpace=THREE.SRGBColorSpace;textureCache.set(appearance.variant,texture);}
  if(version!==appearanceVersion)return appearance;
  surface?.dispose();surface=null;material.map=texture;material.bumpMap=null;material.roughnessMap=null;material.roughness=.91;material.bumpScale=0;
  const hq=hqEnabled;let refineAvatarGeometry;if(hq&&renderer){const hqModule=await import('./avatar-hq.js');if(version!==appearanceVersion)return appearance;refineAvatarGeometry=hqModule.refineAvatarGeometry;surface=hqModule.makeAvatarSurface(texture.image,appearance,renderer);Object.assign(material,{map:surface.map,bumpMap:surface.bumpMap,roughnessMap:surface.roughnessMap,roughness:1,bumpScale:.0025});}else if(!hq&&['shirt','trousers','hair','skin'].some(k=>appearance[k]!==AVATAR_DEFAULTS[k])){const {recolorAvatar}=await import('./avatar-colors.js');if(version!==appearanceVersion)return appearance;surface=recolorAvatar(texture.image,appearance);material.map=surface.map;}
  for(const entry of meshes){if(hq&&refineAvatarGeometry&&!hqGeometries.has(entry.mesh))hqGeometries.set(entry.mesh,refineAvatarGeometry(entry.geometry));entry.mesh.geometry=hq&&hqGeometries.has(entry.mesh)?hqGeometries.get(entry.mesh):entry.geometry;}
  avatar.scale.set(1,1,1);if(appearance.variant==='female')avatar.scale.set(.95,.97,.96);material.needsUpdate=true;return appearance;
 }
 const original=[...person.root.children];
 let mixer,actions,active,head,headScale,arm,elbow,hand;
 const start=new THREE.Vector3(),end=new THREE.Vector3(),direction=new THREE.Vector3(),forward=new THREE.Vector3();
 const rotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion(),swing=new THREE.Quaternion();
 function pointArm(bone,child,x,y,z){
  bone.getWorldPosition(start);child.getWorldPosition(end);
  direction.subVectors(end,start).normalize();
  forward.set(x,y,z).transformDirection(person.root.matrixWorld);
  bone.getWorldQuaternion(rotation);bone.parent.getWorldQuaternion(parentRotation).invert();
  bone.quaternion.copy(parentRotation.multiply(swing.setFromUnitVectors(direction,forward)).multiply(rotation));
 }
 function attachWeapon(){
  const gun=person.weapon;
  if(!gun?.visible||!hand)return;
  pointArm(arm,elbow,-.20,-.12,1);
  pointArm(elbow,hand,.13,.05,1);
  hand.getWorldPosition(end);
  gun.position.copy(person.root.worldToLocal(end)).add(direction.set(0,.047,.081));
 }

 Promise.all([
  new GLTFLoader().loadAsync(modelUrl),
  new THREE.TextureLoader().loadAsync(variant==='female'?femaleUrl:maleUrl),
 ]).then(([gltf,texture])=>{
  texture.colorSpace=THREE.SRGBColorSpace;textureCache.set(variant==='female'?'female':'male',texture);
  material=new THREE.MeshStandardMaterial({map:texture,roughness:.91});
  gltf.scene.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;
   meshes.push({mesh,geometry:mesh.geometry});mesh.material.dispose();mesh.material=material;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  });
  if(variant==='female')gltf.scene.scale.set(.95,.97,.96);
  avatar=gltf.scene;person.root.add(gltf.scene);void customize(appearance);
  head=gltf.scene.getObjectByName('Head');headScale=head?.scale.clone().multiplyScalar(.88);
  arm=gltf.scene.getObjectByName('RightArm');elbow=gltf.scene.getObjectByName('RightForeArm');hand=gltf.scene.getObjectByName('RightHand');

  mixer=new THREE.AnimationMixer(gltf.scene);
  actions=Object.fromEntries(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
  actions.jump.setLoop(THREE.LoopOnce,1);
  actions.jump.clampWhenFinished=true;
  active=actions.idle;active.play();mixer.update(.001);
  const materials=new Set();
  for(const child of original){
   child.removeFromParent();child.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();materials.add(mesh.material);}});
  }
  for(const mat of materials){mat.map?.dispose();mat.dispose();}
 }).catch(error=>console.warn('Modello animato non disponibile',error));
 const animate=(dt,speed,jumping)=>{
  if(!mixer||!person.root.visible)return;
  const next=jumping?actions.jump:Math.abs(speed)>.12?actions.run:actions.idle;
  if(next!==active){
   next.reset().play().crossFadeFrom(active,.16,false);
   active=next;
  }
  if(active===actions.run)active.setEffectiveTimeScale(THREE.MathUtils.clamp(.38+Math.abs(speed)*.12,.45,1.28));
  mixer.update(dt);
  if(head)head.scale.copy(headScale);
  if(arm&&elbow)attachWeapon();
 };
 animate.seat=()=>{if(!avatar)return;for(const name of ['LeftUpLeg','RightUpLeg']){const bone=avatar.getObjectByName(name);if(bone)bone.rotation.x=-Math.PI/2;}for(const name of ['LeftLeg','RightLeg']){const bone=avatar.getObjectByName(name);if(bone)bone.rotation.x=Math.PI/2;}};
 animate.customize=customize;animate.appearance=()=>({...appearance});animate.ready=()=>!!avatar;return animate;
}
