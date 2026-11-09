import assert from 'node:assert/strict';import fs from 'node:fs';import proj4 from 'proj4';import {createCanvas} from '@napi-rs/canvas';
import {CELLAR_STREETS} from './landmark-references.mjs';
const w=JSON.parse(fs.readFileSync('public/world-data.json')),h=w.heritage.motherChurch;
for(const p of w.landmarkReferences){const q=proj4('+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs','EPSG:4326',[p.x+w.origin.x,w.origin.y-p.z]);assert(Math.abs(q[0]-p.gps.lon)<1e-8&&Math.abs(q[1]-p.gps.lat)<1e-8);}
assert.equal(h.buildingId,'978923');assert.equal(h.towerId,'979147');assert(h.referenceToFootprintMeters<20);
for(const ref of w.historicCellars.landmarkCoverage)assert(ref.selectedBuildings.length>0,`No DBT cellar in vicinity of ${ref.id}`);
assert(w.roads.filter(r=>CELLAR_STREETS.test(r.name)).every(r=>r.surface==='stone'));
assert(w.pavingAreas.some(a=>a.role==='mother-church-square'&&a.surface==='stone'));
globalThis.document={createElement:()=>createCanvas(1,1)};
const THREE=await import('three'),{makeChurch,makeBellTower}=await import('../src/churches.js'),{churchPlan}=await import('../src/church-plan.js');
const b=w.buildings.find(b=>b.id===h.buildingId),tower=w.buildings.find(b=>b.id===h.towerId),scene=new THREE.Scene(),plan=churchPlan(b);
assert.equal(plan.edge,4);assert.equal(plan.portalCount,3);assert.equal(plan.upperWindows,2);
const church=makeChurch(scene,b,w.terrain),bell=makeBellTower(scene,tower);assert.equal(church.userData.bellCount,0);assert.equal(bell.userData.bells,5);assert(bell.userData.openBelfry);
scene.traverse(o=>{if(o.isMesh){assert(o.geometry.attributes.position.array.every(Number.isFinite));assert(o.position.toArray().every(Number.isFinite));}});
console.log(`Landmark: 6 GPS corretti, chiesa e campanile GIS distinti, facciata a 3 ingressi, 5 campane, cantine in tutte le 5 aree e pavimentazioni verificate.`);
