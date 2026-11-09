import assert from 'node:assert/strict';
import fs from 'node:fs';
import {leftCellarEvidence} from './cellar-district.mjs';
import {cellarBuildings,cellarPlan} from '../src/cellar-plan.js';
import {installHistoricPaving} from '../src/historic-paving.js';
import {inBuilding,nearest} from '../src/world-math.js';
const w=JSON.parse(fs.readFileSync('public/world-data.json'));w.dbtExtras=JSON.parse(fs.readFileSync('public/dbt-extras.json'));const district=w.cellarDistrict;
assert(district.segments.every(s=>s.source==='gps-route'),'Named roads must not extend the GPS route');
for(const b of w.buildings){if(b.cellar)assert(leftCellarEvidence(b,district),`Cellar outside the left side: ${b.id}`);else if(b.classification==='residential')assert.equal(b.height,b.originalHeight);}
for(const b of cellarBuildings(w)){const p=cellarPlan(b,w.terrain);assert(p.foundation<p.front.floorY);if(!b.cellar.noPortal)assert(Math.hypot(b.cellar.roadPoint[0]-p.front.center[0],b.cellar.roadPoint[1]-p.front.center[1])<=12);assert.equal(b.cellar.floors,1);assert.equal(b.cellar.maxHeight,3.5);if(!b.cellar.noPortal)assert(p.front.doorHeight>2,'Arched entrance must remain full height');const seen=new Set();for(const tri of p.roof.triangles){const key=tri.map(v=>v.map(n=>n.toFixed(5)).join(',')).sort().join('/');assert(!seen.has(key),'Duplicate roof plane');seen.add(key);for(const v of tri)assert(v[1]-p.front.floorY<=3.5+1e-6);}}
assert(w.buildings.find(b=>b.id==='823094').cellar?.parts?.length>10,'The curved San Zaccaria row must be split into low units');assert(!w.buildings.find(b=>b.id==='823104').cellar,'The opposite side must stay residential');
const plaza=w.pavingAreas.find(a=>inBuilding(district.plaza,a));assert(plaza,'Surveyed piazzetta must be paved');
for(const area of w.pavingAreas.filter(a=>a.role!=='piazza-croce'))for(const p of area.rings[0]){const d=Math.min(...district.segments.map(s=>nearest(p,s.a,s.b).d));assert(d<=2.602||inBuilding(p,plaza)||nearest(p,plaza.rings[0][0],plaza.rings[0][1]).d<.01||plaza.rings[0].slice(1).some((q,i)=>nearest(p,plaza.rings[0][i],q).d<.01),'Paving escaped the finite route and surveyed piazzetta');}
assert(w.roads.every(r=>r.surface==='asphalt'),'No entire named street may become stone');
const network={world:w,elevationAt:()=>100,pavementAt:()=>({y:100})};installHistoricPaving(network);assert.equal(network.elevationAt(...district.plaza),100);assert.equal(network.pavementAt(...district.plaza).y,100);
console.log(`PASS: ${cellarBuildings(w).length} left-side cellars, roofs ≤3.5 m, full-height doors, no duplicate slopes; exact paving and flush asphalt transitions.`);
