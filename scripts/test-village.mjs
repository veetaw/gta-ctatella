import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRoadNetwork} from '../src/road-network.js';
import {facadePlans,roofPlan,inRings,edgeDistance} from '../src/building-plan.js';
import {createVillagePlan} from '../src/village-plan.js';
import {elevation} from '../src/world-math.js';

const world=JSON.parse(await fs.readFile('public/world-data.json')),network=createRoadNetwork(world);
let facadeCount=0,shortCount=0,balconies=0,roofTriangles=0;
console.time('Village geometry');
for(const building of world.buildings.filter(b=>!b.cellar&&!b.church&&b.classification!=='church'&&b.classification!=='bell-tower')){
  for(const wall of facadePlans(building,world.terrain)){
    facadeCount++;assert(wall.spacing>=4.5&&wall.spacing<=5.5);
    if(wall.length<6){assert(wall.centers.length<=1);shortCount++;if(wall.centers.length)assert.equal(wall.centers[0],wall.length/2);}
    for(let i=1;i<wall.centers.length;i++)assert(wall.centers[i]-wall.centers[i-1]>=4.5-1e-8);
    for(const balcony of wall.balconies){assert(wall.length>8&&building.height>=5.5);assert(wall.centers.includes(balcony.center));assert(Math.abs(balcony.y-wall.floorY-3.2)<1e-8);assert.equal(balcony.depth,.9);const p=wall.point(balcony.center);assert(balcony.y>elevation(world.terrain,p[0]+wall.nx*.95,p[1]+wall.nz*.95)+2.7);balconies++;}
  }
  const roof=roofPlan(building);assert(roof.overhang>=.35&&roof.overhang<=.45);assert(roof.rise>=1.2&&roof.rise<=1.8);assert(roof.parts.length>0);
  for(const part of roof.parts){assert(part.triangles.length>0);assert(inRings(part.pole,part.rings));assert(Math.abs(part.heightAt(part.pole)-building.roofY-.08-roof.rise)<1e-8);
    for(const ring of part.rings)for(const p of ring)assert(Math.abs(part.heightAt(p)-building.roofY-.08)<1e-7,'Eave not sealed to roof');
    for(const tri of part.triangles){roofTriangles++;assert(tri.flat().every(Number.isFinite));const centroid=[tri.reduce((s,p)=>s+p[0],0)/3,tri.reduce((s,p)=>s+p[2],0)/3];assert(inRings(centroid,part.rings),'Roof outside footprint or over courtyard');for(const p of tri)assert(p[1]>=building.roofY+.0799&&p[1]<=building.roofY+.081+roof.rise);}
  }
}
// A concave plan and a courtyard must remain open under the projecting roof.
for(const rings of [[[[0,0],[12,0],[12,4],[4,4],[4,12],[0,12],[0,0]]],[[[0,0],[20,0],[20,20],[0,20],[0,0]],[[7,7],[7,13],[13,13],[13,7],[7,7]]]]){
  const b={id:'test',rings,roofY:12},roof=roofPlan(b);for(const part of roof.parts)for(const tri of part.triangles){const p=[tri.reduce((s,v)=>s+v[0],0)/3,tri.reduce((s,v)=>s+v[2],0)/3];assert(inRings(p,part.rings));}
}
console.timeEnd('Village geometry');
const village=createVillagePlan(world,network);
for(const kind of ['lamps','signs','trees'])for(const item of village[kind]){assert(village.clear(item.x,item.z,kind==='lamps'?.3:kind==='trees'?1.3:.4));assert(!network.pavementAt(item.x,item.z));assert(Math.abs(item.y-elevation(world.terrain,item.x,item.z))<1e-8);}
assert(village.lamps.length>1000&&village.signs.length>100&&village.trees.length>100);
const junctionSign=village.signs.find(s=>s.names.includes('Via Mameli')&&s.names.includes('Via Gioberti'));assert(junctionSign,'No direction sign at Mameli/Gioberti');
const greenery=village.trees.filter(t=>Math.hypot(t.x-846.763,t.z-475.127)<30);assert(greenery.length>0,'No valid greenery near the junction');
console.log(`PASS: ${facadeCount} facades; 4.5–5.5 m opening spacing; ${shortCount} short walls with <=1 centered opening.`);
console.log(`PASS: ${world.buildings.filter(b=>!b.cellar&&!b.church&&b.classification!=='church'&&b.classification!=='bell-tower').length} residential/public pitched roofs, ${roofTriangles} triangles, sealed 35–45 cm eaves, concave plans and open courtyards.`);
console.log(`PASS: ${balconies} balcony candidates aligned with first-floor openings, 90 cm depth and car headroom.`);
console.log(`PASS: ${village.lamps.length} lamps, ${village.signs.length} signs and ${village.trees.length} junction trees; no placement on roads or inside buildings.`);
console.log(`PASS: Mameli/Gioberti street-name sign and ${greenery.length} nearby vegetation placements.`);
await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/village-verification.json',JSON.stringify({facadeCount,shortWalls:shortCount,balconyCandidates:balconies,roofTriangles,buildings:world.buildings.length,lamps:village.lamps.length,signs:village.signs.length,junctionTrees:village.trees.length,junctionGreenery:greenery.length,passed:true},null,2));
