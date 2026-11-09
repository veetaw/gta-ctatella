import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRoadNetwork,ROAD_OFFSET} from '../src/road-network.js';
import {terrainGeometry,cutBelowRoad} from '../src/terrain-geometry.js';
import {bankBatches} from '../src/road-banks.js';
import {elevation,demElevation,wheelPose} from '../src/world-math.js';

const w=JSON.parse(await fs.readFile('public/world-data.json'));
console.time('Road network');const network=createRoadNetwork(w);console.timeEnd('Road network');
let sections=0,maxCross=0,samples=0,mameli=0;
for(let ri=0;ri<network.roads.length;ri++){
  const r=network.roads[ri];
  for(let i=1;i<r.sections.length-1;i++){
    const s=r.sections[i],half=r.width*.4;
    const left=network.pavementAt(s.x+s.nx*half,s.z+s.nz*half),right=network.pavementAt(s.x-s.nx*half,s.z-s.nz*half);
    assert(left&&right,`Ribbon gap: ${r.name||r.id} section ${i}`);
    maxCross=Math.max(maxCross,Math.abs(left.y-right.y));sections++;
    assert(Math.abs(left.y-right.y)<1e-6,`Cross-slope: ${r.name||r.id} section ${i}`);
    if(/mameli/i.test(r.name)&&i>5&&i<r.sections.length-5){
      const pose=wheelPose(w.terrain,s.x,s.z,Math.atan2(s.nz,-s.nx));
      assert.equal(pose.roll,0,'Via Mameli: chassis banking');
      for(const p of pose.points)assert(Math.abs(p.y-.34-elevation(w.terrain,p.x,p.z))<1e-8);
      mameli++;
    }
    if(!s.constrained&&Math.abs(s.y-s.originalY)<1e-9){assert(Math.abs(s.y-s.rawY)<3,'Longitudinal DEM profile lost');samples++;}
  }
  for(let i=1;i<r.sections.length;i++)assert(Math.abs((r.sections[i].s-r.sections[i-1].s)/4-(r.sections[i].s/4-r.sections[i-1].s/4))<1e-10);
}
assert(mameli>200&&samples>50000);
for(let i=0;i<network.triangles.length;i+=7){
  const t=network.triangles[i],x=t.points.reduce((s,p)=>s+p[0],0)/3,z=t.points.reduce((s,p)=>s+p[1],0)/3,y=t.y.reduce((s,v)=>s+v,0)/3+ROAD_OFFSET;
  assert(Math.abs(elevation(w.terrain,x,z)-y)<.0001,'Physics/rendered ribbon mismatch');
  assert(t.y.every(Number.isFinite)&&t.uv.flat().every(Number.isFinite));
  assert(t.uv.every(p=>p[0]>-.002&&p[0]<1.002),'Width UV stretch');
}
assert.equal(elevation(w.terrain,w.terrain.minX,w.terrain.minZ),demElevation(w.terrain,w.terrain.minX,w.terrain.minZ),'Terrain away from roads modified');
console.log(`PASS: ${sections} transverse sections, maximum banking difference ${maxCross.toExponential(2)} m.`);
console.log(`PASS: Via Mameli ${mameli} car poses with zero chassis roll and exact wheel contact.`);
console.log(`PASS: longitudinal DEM profile, ${samples} unaffected sections, shared junctions and 4 m UV tiling.`);
console.time('Road-adapted terrain');const geometries=terrainGeometry(w,network);console.timeEnd('Road-adapted terrain');
const mesh=geometries[1],p=mesh.attributes.position,t=w.terrain,cell=t.cell/4,stride=(t.cols-1)*4+1,grid=new Map();
for(let i=0;i<p.count;i++){
  const x=Math.round((p.getX(i)-t.minX)/cell),z=Math.round((p.getZ(i)-t.minZ)/cell),key=z*stride+x;
  assert(Number.isFinite(p.getY(i)));if(grid.has(key))assert.equal(grid.get(key),p.getY(i),'Crack between terrain tiles');grid.set(key,p.getY(i));
}
let clearance=Infinity,checked=0;
const allPavedTriangles=[...network.triangles,...network.surfaceTriangles];
for(let i=0;i<allPavedTriangles.length;i+=3){
  const tri=allPavedTriangles[i],x=tri.points.reduce((s,p)=>s+p[0],0)/3,z=tri.points.reduce((s,p)=>s+p[1],0)/3,y=tri.y.reduce((s,v)=>s+v,0)/3+ROAD_OFFSET;
  if(x<=t.minX||x>=t.maxX||z<=t.minZ||z>=t.maxZ)continue;
  const u=(x-t.minX)/cell,v=(z-t.minZ)/cell,a=Math.floor(u),b=Math.floor(v),fx=u-a,fz=v-b,h=(x,z)=>grid.get(z*stride+x);
  const corners=[h(a,b),h(a+1,b),h(a,b+1),h(a+1,b+1)];assert(corners.every(Number.isFinite),'Missing terrain under road');
  const ground=fx+fz<1?corners[0]+(corners[1]-corners[0])*fx+(corners[2]-corners[0])*fz:corners[3]+(corners[2]-corners[3])*(1-fx)+(corners[1]-corners[3])*(1-fz);
  clearance=Math.min(clearance,y-ground);assert(ground<y-.055,`Uphill terrain clips road ${tri.road}`);checked++;
}
// A hill triangle can cross the road even when all three corners are outside it.
const r=network.roads.find(r=>/mameli/i.test(r.name)),s=r.sections[Math.floor(r.sections.length/2)];
const uphill=[s.x-6,s.y+8,s.z-5,s.x+6,s.y+8,s.z-5,s.x,s.y+8,s.z+8];cutBelowRoad(uphill,null,network);assert(uphill[1]<s.y&&uphill[4]<s.y&&uphill[7]<s.y);
console.log(`PASS: ${checked} actual ribbon/terrain clearance probes, minimum ${(clearance*100).toFixed(2)} cm; no tile cracks.`);
console.time('Clipped shoulders');let shoulderTriangles=0;
for(const bank of bankBatches(network))for(let i=0;i<bank.positions.length;i+=9){
  const p=bank.positions.slice(i,i+9);assert(p.every(Number.isFinite),'Invalid shoulder geometry');
  const x=(p[0]+p[3]+p[6])/3,z=(p[2]+p[5]+p[8])/3,y=(p[1]+p[4]+p[7])/3,surface=network.pavementAt(x,z);
  assert(!surface||y<surface.y-.004,'Shoulder clips asphalt');shoulderTriangles++;
}
console.timeEnd('Clipped shoulders');console.log(`PASS: ${shoulderTriangles} clipped shoulder triangles, no asphalt occlusion.`);
await fs.mkdir('artifacts' ,{recursive:true});await fs.writeFile('artifacts/road-verification.json',JSON.stringify({roads:network.roads.length,sections,maxCrossSlopeHeightDifference:maxCross,mameliZeroRollPoses:mameli,terrainClearanceProbes:checked,minimumClearanceMeters:clearance,offset:ROAD_OFFSET,uvRepeatMeters:4,shoulderTriangles,passed:true},null,2));
for(const g of geometries)g.dispose();
