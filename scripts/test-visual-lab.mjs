import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {normalizeAppearance,refineAvatarGeometry} from '../src/avatar-hq.js';
const bytes=await fs.readFile(new URL('../src/avatar-assets/character.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
let count=0;
gltf.scene.traverse(mesh=>{
 if(!mesh.isSkinnedMesh)return;count++;
 const source=mesh.geometry,original=source.attributes.position.array.slice(),refined=refineAvatarGeometry(source);
 assert.equal(refined.attributes.position.count,source.attributes.position.count*4);
 assert.deepEqual(source.attributes.position.array,original,'source geometry remains identical');
 for(const [name,attr] of Object.entries(refined.attributes)){assert.equal(attr.count,refined.attributes.position.count,name);assert.ok(attr.array.every(Number.isFinite),name+' contains only finite values');}
 const ids=refined.attributes.skinIndex,weights=refined.attributes.skinWeight;
 for(let i=0;i<ids.count;i++){let sum=0;for(let k=0;k<4;k++){const id=ids.array[i*4+k];assert.ok(Number.isInteger(id)&&id>=0&&id<mesh.skeleton.bones.length);sum+=weights.array[i*4+k];}assert.ok(Math.abs(sum-1)<1e-5,'skinning stays normalized');}
 source.computeBoundingBox();const a=source.boundingBox,b=refined.boundingBox;assert.ok(a.min.distanceTo(b.min)<.1&&a.max.distanceTo(b.max)<.1,'HQ silhouette stays within 10 cm of source');
 console.log(`PASS: original avatar preserved; ${source.attributes.position.count/3} → ${refined.attributes.position.count/3} triangles; ${mesh.skeleton.bones.length} bones with valid normalized weights.`);
});assert.ok(count>0);for(const name of ['idle','run','jump'])assert.ok(gltf.animations.some(c=>c.name===name));
assert.equal(normalizeAppearance({shirt:'<script>',quality:'ultra',variant:'bad'}).quality,'original');assert.equal(normalizeAppearance({shirt:'#AABBCC'}).shirt,'#aabbcc');
console.log('PASS: original animations retained; appearance validation rejects invalid values.');
