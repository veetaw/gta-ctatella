import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {makeCar,updateCar} from '../src/actors.js';
import {setVehicleQuality,updateVehicleVisuals} from '../src/vehicle-visuals.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async blob=>loadImage(Buffer.from(await blob.arrayBuffer()));
globalThis.document={createElement:()=>createCanvas(256,64)};
globalThis.ProgressEvent=class {constructor(type,options){Object.assign(this,{type,...options});}};
const originalFetch=globalThis.fetch;globalThis.fetch=async(request,...args)=>{const url=typeof request==='string'?request:request.url;if(url.startsWith('file:'))return new Response(await fs.readFile(new URL(url)));return originalFetch(request,...args);};
const scene=new THREE.Scene();for(const kind of ['ferrari','corvette']){const car=makeCar(scene,kind),spec=JSON.stringify(car.spec),rootScale=car.root.scale.clone(),originals=[...car.body.children];
const terrain={cols:2,rows:2,cell:100,minX:-50,minZ:-50,maxX:50,maxZ:50,heights:[0,0,0,0]};updateCar(car,terrain,0);
try{
 await setVehicleQuality('hq');updateCar(car,terrain,.016);assert.ok(originals.every(mesh=>!mesh.visible));assert.ok(car.wheels.every(mesh=>!mesh.visible));assert.equal(JSON.stringify(car.spec),spec);assert.ok(rootScale.equals(car.root.scale));
 const detail=car.body.children.find(mesh=>!originals.includes(mesh));assert.ok(detail.visible);detail.traverse(mesh=>{if(mesh.isMesh&&mesh.material.map)assert.ok(mesh.geometry.attributes.uv,'textured HQ surfaces keep UV coordinates');});
 const bounds=new THREE.Box3().setFromObject(detail);assert.ok(bounds.max.x-bounds.min.x<=car.spec.width+.02);assert.ok(bounds.max.z-bounds.min.z<=car.spec.length+.02);
 const wheels=car.root.children.filter(child=>child!==car.body&&!car.wheels.includes(child)&&child!==car.rider);assert.equal(wheels.length,4);for(const wheel of wheels){const b=new THREE.Box3().setFromObject(wheel);assert.ok(Math.abs(b.min.y)<.015,'HQ tires contact the same physical ground');}
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,100);updateVehicleVisuals(camera);assert.equal(detail.visible,false);assert.ok(originals.every(mesh=>mesh.visible));camera.position.set(0,2,8);updateVehicleVisuals(camera);assert.equal(detail.visible,true);
 await setVehicleQuality('original');assert.ok(originals.every(mesh=>mesh.visible));assert.ok(car.wheels.every(mesh=>mesh.visible));assert.equal(detail.visible,false);assert.equal(JSON.stringify(car.spec),spec);
 console.log('PASS: HQ '+kind+' geometry, footprint, tire contact, LOD and original restore.');
}finally{}
}globalThis.fetch=originalFetch;
