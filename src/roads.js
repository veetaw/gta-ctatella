import ClipperLib from 'clipper-lib';
import earcut,{flatten} from 'earcut';
import {makeUrbanAprons} from './urban-details.js';
import {createPavingMaterial} from './paving-material.js';
import * as THREE from 'three';
import {ROAD_OFFSET,barycentric} from './road-network.js';
import {bankBatches} from './road-banks.js';
import {createAsphaltMaterial} from './road-material.js';

export function roadMaterialRegions(world){const districts=world.pavingDistricts||[];return [...districts,...(world.pavingAreas||[]).filter(a=>!districts.some(d=>d.areaIds.includes(a.id)))];}
export function roadMaterialIndex(tri,regions){const b=tri.bounds;return regions.findIndex(a=>b[2]>=a.bounds[0]-1.4&&b[0]<=a.bounds[2]+1.4&&b[3]>=a.bounds[1]-1.4&&b[1]<=a.bounds[3]+1.4)+1;}

export function makeRoads(scene,network,cache){
  const regions=roadMaterialRegions(network.world),asphalt=createAsphaltMaterial(),materials=[asphalt,...regions.map(a=>createPavingMaterial(a))],buckets=materials.map(()=>({p:[],uv:[]}));
  const scale=10000,path=r=>r.slice(0,-1).map(p=>({X:Math.round(p[0]*scale),Y:Math.round(p[1]*scale)}));
  function emit(tri,polygons,material){const out=buckets[material];for(const polygon of polygons){const f=flatten(polygon),ids=earcut(f.vertices,f.holes,2);for(let i=0;i<ids.length;i+=3){let points=ids.slice(i,i+3).map(j=>[f.vertices[j*2],f.vertices[j*2+1]]);const [a,b,c]=points;if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0)points=[a,c,b];
   for(const p of points){const w=barycentric(...p,...tri.points);if(!w)throw Error('Degenerate road triangle');out.p.push(p[0],w.reduce((s,v,i)=>s+v*tri.y[i],0)+ROAD_OFFSET+(material?.018:0),p[1]);out.uv.push(p[0]/(material?2:4),p[1]/(material?2:4));}
  }}}
  // Stone has an explicit 18 mm visual separation; logarithmic depth can ignore polygonOffset.
  // Split the actual triangles at the exact paving boundary. No soft texture
  // mask, elevated duplicate ribbon or whole-street material assignment.
  for(const tri of [...network.triangles,...network.surfaceTriangles]){
   if(!barycentric(...tri.points[0],...tri.points))continue;
   let remaining=[[...tri.points,tri.points[0]]];remaining=[remaining];
   for(let index=0;index<regions.length;index++){const area=regions[index],b=tri.bounds;if(b[0]>area.bounds[2]||b[2]<area.bounds[0]||b[1]>area.bounds[3]||b[3]<area.bounds[1])continue;
    const next=[];for(const polygon of remaining){const clipper=new ClipperLib.Clipper(),tree=new ClipperLib.PolyTree();clipper.AddPaths(polygon.map(path),ClipperLib.PolyType.ptSubject,true);clipper.AddPaths((area.polygons||[area.rings]).flatMap(r=>r.map(path)),ClipperLib.PolyType.ptClip,true);clipper.Execute(ClipperLib.ClipType.ctIntersection,tree,ClipperLib.PolyFillType.pftEvenOdd,ClipperLib.PolyFillType.pftEvenOdd);
     const pieces=ClipperLib.JS.PolyTreeToExPolygons(tree).map(p=>[p.outer,...p.holes].map(r=>{const q=r.map(p=>[p.X/scale,p.Y/scale]);return [...q,q[0]];}));emit(tri,pieces,index+1);
     if(pieces.length){const diff=new ClipperLib.Clipper(),free=new ClipperLib.PolyTree();diff.AddPaths(polygon.map(path),ClipperLib.PolyType.ptSubject,true);diff.AddPaths(pieces.flatMap(r=>r.map(path)),ClipperLib.PolyType.ptClip,true);diff.Execute(ClipperLib.ClipType.ctDifference,free,ClipperLib.PolyFillType.pftEvenOdd,ClipperLib.PolyFillType.pftEvenOdd);next.push(...ClipperLib.JS.PolyTreeToExPolygons(free).map(p=>[p.outer,...p.holes].map(r=>{const q=r.map(p=>[p.X/scale,p.Y/scale]);return [...q,q[0]];})));}else next.push(polygon);
    }remaining=next;
   }emit(tri,remaining,0);
  }
  const road=new THREE.Group();road.name='Exact asphalt / basolato boundary';scene.add(road);
  for(let i=0;i<buckets.length;i++){const b=buckets[i];if(!b.p.length)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,materials[i]);mesh.name=i?'GPS route · basolato':'Standard asphalt';mesh.receiveShadow=true;road.add(mesh);}
  const bank=new THREE.Group(),seal=new THREE.Group();bank.name='Smooth clipped road shoulders';seal.name='Buried road edge foundations';
  const material=new THREE.MeshStandardMaterial({color:'#918977',roughness:1,side:THREE.DoubleSide});
  function part(positions,group){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;group.add(mesh);}
  if(cache){for(const [key,group] of [['bank',bank],['seal',seal]])for(const geometry of cache[key]){const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;group.add(mesh);}}
  else for(const batch of bankBatches(network)){part(batch.positions,bank);part(batch.seals,seal);}
  makeUrbanAprons(scene,network);scene.add(bank,seal);return {road,bank,seal};
}
