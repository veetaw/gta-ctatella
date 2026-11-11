import * as THREE from 'three';
import {VEHICLES} from './vehicle-physics.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
let quality='original',revision=0;const templates=new Map(),assetTasks=new Map();
const cars=new Set(),states=new WeakMap();

function floatGeometry(mesh,matrix){
 const source=mesh.geometry,geometry=new THREE.BufferGeometry();
 for(const name of ['position','normal']){const attr=source.attributes[name];if(!attr)continue;const array=new Float32Array(attr.count*3);for(let i=0;i<attr.count;i++){array[i*3]=attr.getX(i);array[i*3+1]=attr.getY(i);array[i*3+2]=attr.getZ(i);}geometry.setAttribute(name,new THREE.BufferAttribute(array,3));}
 if(source.attributes.uv){const uv=source.attributes.uv,array=new Float32Array(uv.count*2);for(let i=0;i<uv.count;i++){array[i*2]=uv.getX(i);array[i*2+1]=uv.getY(i);}geometry.setAttribute('uv',new THREE.BufferAttribute(array,2));}
 if(source.index)geometry.setIndex(source.index.clone());geometry.applyMatrix4(matrix);return geometry.index?geometry.toNonIndexed():geometry;
}
function mergeParts(parts){
 const result=new THREE.Group();for(const {material,geometries} of parts.values()){const geometry=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=material.name==='Body_Color';mesh.receiveShadow=true;result.add(mesh);}return result;
}
function prepare(scene,spec){
 const root=scene.clone(true),box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 // Visual bounds match the existing Ferrari footprint. Driving dimensions stay unchanged.
 const scale=new THREE.Vector3(spec.width/size.x,spec.width/size.x,spec.length/size.z);root.scale.copy(scale);root.rotation.y=Math.PI;root.position.set(center.x*scale.x,-box.min.y*scale.y-spec.radius,center.z*scale.z);root.updateMatrixWorld(true);
 const wheelNames=['wheel_rr','wheel_rl','wheel_fr','wheel_fl'],wheelNodes=wheelNames.map(name=>root.getObjectByName(name)),allWheels=new Set();for(const wheel of wheelNodes)wheel.traverse(o=>allWheels.add(o));
 function parts(objects,offset=new THREE.Vector3()){
  const buckets=new Map();for(const mesh of objects){if(!mesh.isMesh)continue;const material=mesh.material;if(!buckets.has(material.uuid))buckets.set(material.uuid,{material,geometries:[]});const matrix=new THREE.Matrix4().makeTranslation(-offset.x,-offset.y,-offset.z).multiply(mesh.matrixWorld);buckets.get(material.uuid).geometries.push(floatGeometry(mesh,matrix));}return mergeParts(buckets);
 }
 const bodyObjects=[];root.traverse(o=>{if(!allWheels.has(o))bodyObjects.push(o);});const body=parts(bodyObjects);
 const wheels=wheelNodes.map(wheel=>{const objects=[];wheel.traverse(o=>objects.push(o));const result=parts(objects,wheel.getWorldPosition(new THREE.Vector3()));const bounds=new THREE.Box3().setFromObject(result),radius=Math.max(Math.abs(bounds.min.y),Math.abs(bounds.max.y));result.scale.set(1,spec.radius/radius,spec.radius/radius);return result;});
 return {body,wheels};
}
function install(car){
 const template=templates.get(car.spec.id);if(states.has(car)||!template||car.hqPreviewOriginal)return;
 const originals=[...car.body.children],originalWheels=car.wheels.map(wheel=>({wheel,visible:wheel.visible}));
 const body=template.body.clone(true),wheels=template.wheels.map(wheel=>wheel.clone(true)),materials=new Map();
 for(const group of [body,...wheels])group.traverse(mesh=>{if(!mesh.isMesh)return;const source=mesh.material;if(!materials.has(source)){const mat=source.clone();if(mat.name==='Body_Color'){mat.color.set('#d91519');mat.metalness=.7;mat.roughness=.24;}if(mat.name==='Tires'){mat.color.set('#15181b');mat.roughness=.88;mat.metalness=0;}if(mat.name==='plastic_gray'){mat.color.set('#24292c');mat.roughness=.7;}if(mat.name==='metal_gray'||mat.name==='metal_chrome'){mat.color.set('#90989e');mat.metalness=.85;mat.roughness=.26;}if(mat.name==='Glass_Gray'){mat.color.set('#526470');mat.transparent=true;mat.opacity=.6;mat.depthWrite=false;mat.roughness=.1;}mat.envMap=car.body.children.find(o=>o.material?.envMap)?.material.envMap??null;materials.set(source,mat);}mesh.material=materials.get(source);});
 body.visible=false;car.body.add(body);for(const wheel of wheels){wheel.visible=false;car.root.add(wheel);}
 const state={car,body,wheels,originals,originalWheels,active:false};states.set(car,state);
 car.visualUpdate=pose=>{if(!state.active)return;pose.points.forEach((p,i)=>{const wheel=wheels[i];wheel.position.set(p.r,p.y-car.root.position.y,p.f);wheel.rotation.set(pose.pitch,p.f>0?car.steer*car.spec.turn:0,pose.roll,'YXZ');wheel.rotateX(car.spin);});for(const mat of materials.values())if(mat.name==='Taillight_Glass'){mat.emissive.set('#ff1706');mat.emissiveIntensity=car.brakeMat.emissiveIntensity;}};
}
function activate(state,enabled){if(state.active===enabled)return;state.active=enabled;state.body.visible=enabled;for(const wheel of state.wheels)wheel.visible=enabled;for(const mesh of state.originals)mesh.visible=!enabled;for(const {wheel,visible} of state.originalWheels)wheel.visible=enabled?false:visible;if(enabled&&state.car.visualPose)state.car.visualUpdate(state.car.visualPose);}
export function registerVehicleVisual(car){cars.add(car);if(quality==='hq')install(car);return car;}
export async function setVehicleQuality(next){
 const token=++revision;
 if(next==='hq'){await Promise.all(['ferrari','corvette'].map(async id=>{if(templates.has(id))return;let task=assetTasks.get(id);if(!task){const url=id==='ferrari'?new URL('./vehicle-assets/ferrari-hq.glb',import.meta.url).href:new URL('./vehicle-assets/corvette-hq.glb',import.meta.url).href;task=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then(gltf=>prepare(gltf.scene,VEHICLES[id]));assetTasks.set(id,task);}try{templates.set(id,await task);}catch(error){assetTasks.delete(id);throw error;}}));}
 if(token!==revision)return quality;
 quality=next==='hq'?'hq':'original';for(const car of cars){if(quality==='hq')install(car);const state=states.get(car);if(state)activate(state,quality==='hq');}return quality;
}
export function updateVehicleVisuals(camera){if(quality!=='hq')return;for(const car of cars){const state=states.get(car);if(state)activate(state,camera.position.distanceToSquared(car.root.position)<60*60);}}
export function vehicleVisualStats(){return {quality,ready:templates.size===2,supported:['ferrari','corvette']};}
