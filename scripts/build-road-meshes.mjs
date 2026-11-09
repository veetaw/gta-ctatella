import {applyLocalWorldEdits} from '../src/local-world-edits.js';
import {roadSurfaceFeatures} from '../src/dbt-plan.js';
import {buildUrbanAprons,additionalUrbanBuildings} from '../src/urban-aprons.js';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {createRoadNetwork,attachUrbanAprons} from '../src/road-network.js';
import {terrainGeometry} from '../src/terrain-geometry.js';
import {bankBatches} from '../src/road-banks.js';

const inputs=['src/local-world-edits.js','src/cellar-access.js','src/cellar-plan.js','src/church-plan.js','src/historic-paving.js','public/world-data.json','src/road-network.js','src/terrain-geometry.js','src/road-banks.js','src/world-math.js','src/urban-aprons.js','src/mesh-quality.js','public/dbt-extras.json','src/dbt-plan.js'];
const hash=createHash('sha256');for(const file of inputs)hash.update(await fs.readFile(file));const fingerprint=hash.digest('hex');
try{const previous=JSON.parse(await fs.readFile('public/road-cache.json'));await fs.access('public/road-meshes.binz');if(previous.fingerprint===fingerprint){console.log('Road meshes: cache up to date.');process.exit(0);}}catch{}
console.time('Precompute road meshes');
const world=JSON.parse(await fs.readFile('public/world-data.json')),extra=JSON.parse(await fs.readFile('public/dbt-extras.json'));world.dbtExtras=extra;applyLocalWorldEdits(world);world.urbanFootprints=additionalUrbanBuildings(world.dbtExtras.features);Object.assign(world,roadSurfaceFeatures(world,world.dbtExtras.features));const network=createRoadNetwork(world),chunks=[],meshes=[];let offset=0;
const aprons=buildUrbanAprons({...world,buildings:[...world.buildings,...world.urbanFootprints]},network);attachUrbanAprons(network,aprons);await fs.writeFile('public/urban-aprons.json',JSON.stringify(aprons));console.log(`Urban aprons: ${aprons.contacts.length} wall contacts, ${aprons.triangles.length} triangles, ${aprons.rejected} rejected.`);
function array(data,itemSize){const buffer=Buffer.from(data.buffer,data.byteOffset,data.byteLength);const descriptor={offset,length:data.length,itemSize};chunks.push(buffer);offset+=buffer.length;return descriptor;}
function save(geometry,kind){geometry.computeBoundingSphere();const attributes={};for(const [key,attribute] of Object.entries(geometry.attributes))attributes[key]=array(new Float32Array(attribute.array),attribute.itemSize);const index=geometry.index?array(new Uint32Array(geometry.index.array),1):null;meshes.push({kind,attributes,index,sphere:{center:geometry.boundingSphere.center.toArray(),radius:geometry.boundingSphere.radius}});geometry.dispose();}
for(const geometry of terrainGeometry(world,network))save(geometry,'terrain');
for(const bank of bankBatches(network))for(const key of ['positions','seals']){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(bank[key],3));geometry.computeVertexNormals();save(geometry,key==='positions'?'bank':'seal');}
const compressed=gzipSync(Buffer.concat(chunks),{level:6});await fs.writeFile('public/road-meshes.binz.tmp',compressed);await fs.rename('public/road-meshes.binz.tmp','public/road-meshes.binz');await fs.writeFile('public/road-cache.json',JSON.stringify({version:1,fingerprint,bytes:offset,meshes}));
console.timeEnd('Precompute road meshes');console.log(`${meshes.length} mesh buffers: ${(offset/1e6).toFixed(1)} MB raw, ${(compressed.length/1e6).toFixed(1)} MB compressed.`);
