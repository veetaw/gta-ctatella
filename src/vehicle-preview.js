import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeCar,updateCar} from './actors.js';
import {setVehicleQuality,updateVehicleVisuals} from './vehicle-visuals.js';
import {makeAtmosphere} from './environment.js';
import {createMaxRendering} from './max-rendering.js';
const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});renderer.userData={mobile:false};renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,4000),atmosphere=makeAtmosphere(scene,renderer);camera.position.set(7.5,4.2,10.5);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.55,0);controls.minDistance=7;controls.maxDistance=20;controls.maxPolarAngle=Math.PI*.48;controls.enableDamping=true;
const terrain={cols:2,rows:2,cell:100,minX:-50,minZ:-50,maxX:50,maxZ:50,heights:[0,0,0,0]};
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:'#5d6261',roughness:.9}));floor.receiveShadow=true;scene.add(floor);
const original=makeCar(scene,'ferrari');original.hqPreviewOriginal=true;original.x=-3;original.z=0;original.yaw=.12;const hq=makeCar(scene,'ferrari');hq.x=3;hq.z=0;hq.yaw=.12;
for(const car of [original,hq]){car.root.visible=true;updateCar(car,terrain,0);}atmosphere.light.target.position.set(0,0,0);atmosphere.light.position.copy(atmosphere.sun).multiplyScalar(350);
Object.assign(atmosphere.light.shadow.camera,{left:-16,right:16,top:16,bottom:-16});atmosphere.light.shadow.camera.updateProjectionMatrix();
const max=createMaxRendering({renderer,scene,camera,atmosphere,mobile:false});await setVehicleQuality('hq');max.enable();
function mode(enabled){if(enabled)max.enable();else max.disable();document.querySelector('#max').setAttribute('aria-pressed',String(enabled));document.querySelector('#normal').setAttribute('aria-pressed',String(!enabled));}
document.querySelector('#normal').onclick=()=>mode(false);document.querySelector('#max').onclick=()=>mode(true);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const clock=new THREE.Clock();function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);controls.update();for(const car of [original,hq])updateCar(car,terrain,dt);atmosphere.sky.position.copy(camera.position);atmosphere.light.position.copy(atmosphere.sun).multiplyScalar(350);updateVehicleVisuals(camera);if(max.active)max.render(dt);else renderer.render(scene,camera);}frame();document.querySelector('#status').textContent='';window.__VISUAL_PREVIEW_READY=true;window.__VEHICLE_PREVIEW={scene,camera,renderer,original,hq,max};
