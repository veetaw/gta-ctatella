import {installHistoricPaving} from './historic-paving.js';
import ClipperLib from 'clipper-lib';
import earcut,{flatten} from 'earcut';
import {demElevation,nearest,installRoadSurface} from './world-math.js';

export function subtractRoads(ring,cuts){
  const scale=10000,path=r=>r.slice(0,-1).map(p=>({X:Math.round(p[0]*scale),Y:Math.round(p[1]*scale)}));
  const clipper=new ClipperLib.Clipper();clipper.StrictlySimple=true;
  clipper.AddPath(path(ring),ClipperLib.PolyType.ptSubject,true);
  clipper.AddPaths(cuts.map(q=>path(q.poly)),ClipperLib.PolyType.ptClip,true);
  const tree=new ClipperLib.PolyTree();
  clipper.Execute(ClipperLib.ClipType.ctDifference,tree,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
  return ClipperLib.JS.PolyTreeToExPolygons(tree).map(p=>[p.outer,...p.holes].map(r=>r.map(v=>[v.X/scale,v.Y/scale])));
}

export const ROAD_OFFSET=.06;
export const SHOULDER=2.4;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
const bounds=points=>[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
export class SpatialIndex{
  constructor(size=20){this.size=size;this.cells=new Map();}
  insert(item,b){for(let z=Math.floor(b[1]/this.size);z<=Math.floor(b[3]/this.size);z++)for(let x=Math.floor(b[0]/this.size);x<=Math.floor(b[2]/this.size);x++){const key=`${x},${z}`;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(item);}}
  point(x,z){return this.cells.get(`${Math.floor(x/this.size)},${Math.floor(z/this.size)}`)||[];}
  box(b){const found=new Set();for(let z=Math.floor(b[1]/this.size);z<=Math.floor(b[3]/this.size);z++)for(let x=Math.floor(b[0]/this.size);x<=Math.floor(b[2]/this.size);x++)for(const item of this.cells.get(`${x},${z}`)||[])found.add(item);return [...found];}
}
export function barycentric(x,z,a,b,c){const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-10)return null;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/den;return [u,v,1-u-v];}
export function triangleHeight(triangle,x,z){const bb=triangle.bounds;if(bb&&(x<bb[0]-1e-7||x>bb[2]+1e-7||z<bb[1]-1e-7||z>bb[3]+1e-7))return null;const b=barycentric(x,z,...triangle.points);if(!b||b.some(v=>v< -1e-7))return null;return b.reduce((s,v,i)=>s+v*triangle.y[i],0);}

function resample(road,terrain){const points=[];let length=0;for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],distance=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<1e-5)continue;const n=Math.ceil(distance/.8);for(let j=0;j<n;j++){const f=j/n,x=lerp(a[0],b[0],f),z=lerp(a[1],b[1],f);points.push({x,z,s:length+f*distance,rawY:demElevation(terrain,x,z)});}length+=distance;}const p=road.points.at(-1);points.push({x:p[0],z:p[1],s:length,rawY:demElevation(terrain,...p)});for(const p of points){let sum=0,weight=0;for(const q of points){const d=Math.abs(q.s-p.s);if(d>3)continue;const v=1-d/3;sum+=q.rawY*v;weight+=v;}p.y=sum/weight;}return {...road,sections:points,length};}

export function polygonsOverlap(a,b){
  for(const points of [a,b])for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length],nx=q[1]-p[1],nz=p[0]-q[0];
    if(Math.abs(nx)+Math.abs(nz)<1e-10)continue;
    let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
    for(const v of a){const d=v[0]*nx+v[1]*nz;amin=Math.min(amin,d);amax=Math.max(amax,d);}
    for(const v of b){const d=v[0]*nx+v[1]*nz;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d);}
    if(amax<=bmin+1e-7||bmax<=amin+1e-7)return false;
  }return true;
}
export function createRoadNetwork(world){
  const terrain=world.terrain,roads=world.roads.map(r=>resample(r,terrain)).filter(r=>r.sections.length>1);
  const sections=[];
  for(const road of roads){const half=road.width/2;for(let i=0;i<road.sections.length;i++){
    const p=road.sections[i],a=road.sections[Math.max(0,i-1)],b=road.sections[Math.min(road.sections.length-1,i+1)];
    let dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;p.nx=-dz;p.nz=dx;
    p.left=[p.x+p.nx*half,p.z+p.nz*half];p.right=[p.x-p.nx*half,p.z-p.nz*half];p.originalY=p.y;p.index=sections.length;sections.push(p);
  }}
  // Constrain only genuinely overlapping ribbons to the same level. Each local
  // connected overlap becomes a flat junction, with a smooth approach along
  // each road. This avoids different branches choosing conflicting anchors.
  const parent=sections.map((_,i)=>i),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const unite=(a,b)=>{a=root(a);b=root(b);if(a!==b)parent[b]=a;};
  const ends=new SpatialIndex(1);
  for(const road of roads)for(const s of [road.sections[0],road.sections.at(-1)]){for(const other of ends.box([s.x-.3,s.z-.3,s.x+.3,s.z+.3]))if(Math.hypot(s.x-other.x,s.z-other.z)<.3)unite(s.index,other.index);ends.insert(s,[s.x,s.z,s.x,s.z]);}
  const overlaps=new SpatialIndex(6);
  for(const road of roads)for(let i=1;i<road.sections.length;i++){
    const a=road.sections[i-1],b=road.sections[i],poly=[a.left,a.right,b.right,b.left],bb=bounds(poly);
    for(const other of overlaps.box(bb)){
      
      const ob=other.bb;if(bb[0]>=ob[2]||bb[2]<=ob[0]||bb[1]>=ob[3]||bb[3]<=ob[1])continue;
      if([[poly[0],poly[1],poly[2]],[poly[0],poly[2],poly[3]]].some(t=>[[other.poly[0],other.poly[1],other.poly[2]],[other.poly[0],other.poly[2],other.poly[3]]].some(q=>polygonsOverlap(t,q)))){unite(a.index,b.index);unite(a.index,other.a.index);unite(a.index,other.b.index);}
    }
    overlaps.insert({a,b,poly,bb,road,i},bb);
  }
  const groups=new Map();for(const s of sections){const key=root(s.index);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);}
  const junctions=[];for(const members of groups.values())if(members.length>1){const y=members.reduce((v,s)=>v+s.originalY,0)/members.length;junctions.push({y,sections:members.length});for(const s of members){s.y=y;s.constrained=true;}}
  for(const road of roads){const a=road.sections;let left=-1;const next=new Int32Array(a.length);let right=-1;for(let i=a.length-1;i>=0;i--){if(a[i].constrained)right=i;next[i]=right;}
    for(let i=0;i<a.length;i++){
      const s=a[i];if(s.constrained){left=i;continue;}
      right=next[i];const l=left<0?null:a[left],r=right<0?null:a[right],dl=l?s.s-l.s:Infinity,dr=r?r.s-s.s:Infinity;
      if(l&&r&&r.s-l.s<14)s.y=lerp(l.y,r.y,smooth(dl/(dl+dr)));
      else if(dl<7)s.y=s.originalY+(l.y-l.originalY)*(1-smooth(dl/7));
      else if(dr<7)s.y=s.originalY+(r.y-r.originalY)*(1-smooth(dr/7));
    }
  }
  const islandIndex=new SpatialIndex(),islandLevels=new Map();
  const segments=[],segmentIndex=new SpatialIndex(),triangles=[],triangleIndex=new SpatialIndex(),previous=new SpatialIndex();
  for(let ri=0;ri<roads.length;ri++){const road=roads[ri],roadQuads=[];for(let i=1;i<road.sections.length;i++){const a=road.sections[i-1],b=road.sections[i],poly=[a.left,a.right,b.right,b.left,a.left],bb=bounds(poly);const seg={road,ri,a,b,half:road.width/2,bounds:bb};segments.push(seg);segmentIndex.insert(seg,[bb[0]-SHOULDER-2,bb[1]-SHOULDER-2,bb[2]+SHOULDER+2,bb[3]+SHOULDER+2]);roadQuads.push({poly,bb});const cuts=previous.box(bb).filter(q=>q.bb[0]<bb[2]&&q.bb[2]>bb[0]&&q.bb[1]<bb[3]&&q.bb[3]>bb[1]);
      const vertices=[{p:a.left,y:a.y,uv:[0,a.s/4]},{p:a.right,y:a.y,uv:[1,a.s/4]},{p:b.right,y:b.y,uv:[1,b.s/4]},{p:b.left,y:b.y,uv:[0,b.s/4]}];
      // Clip overlapping earlier roads out of the ribbon, avoiding z-fighting and
      // duplicate curbs at junctions. Interpolate new UVs in the original plane.
      for(const indices of [[0,1,2],[0,2,3]]){const source=indices.map(i=>vertices[i]);const ring=[...source.map(v=>v.p),source[0].p];let pieces=[ [ring] ];if(cuts.length)pieces=subtractRoads(ring,cuts);for(const polygon of pieces){const f=flatten(polygon),ids=earcut(f.vertices,f.holes,2);for(let k=0;k<ids.length;k+=3){const points=ids.slice(k,k+3).map(j=>[f.vertices[j*2],f.vertices[j*2+1]]);const weights=points.map(p=>barycentric(...p,...source.map(v=>v.p)));if(weights.some(v=>!v))continue;const y=weights.map(w=>w.reduce((s,v,j)=>s+v*source[j].y,0));const uv=weights.map(w=>[0,1].map(c=>w.reduce((s,v,j)=>s+v*source[j].uv[c],0)));const tri={points,y,uv,road:ri,bounds:bounds(points)};triangles.push(tri);triangleIndex.insert(tri,tri.bounds);}}}
      // Include earlier segments of this same road, including folded hairpins.
      previous.insert({poly,bb},bb);
    }}
  function pavementAt(x,z){for(const tri of islandIndex.point(x,z)){const y=triangleHeight(tri,x,z);if(y!==null)return {y:y+ROAD_OFFSET,triangle:tri};}for(const tri of triangleIndex.point(x,z)){const y=triangleHeight(tri,x,z);if(y!==null)return {y:y+ROAD_OFFSET,triangle:tri};}return null;}
  function closestSegment(x,z){let best=null;for(const segment of segmentIndex.point(x,z)){const n=nearest([x,z],[segment.a.x,segment.a.z],[segment.b.x,segment.b.z]);if(!best||n.d<best.d)best={...n,segment,y:lerp(segment.a.y,segment.b.y,n.t)};}return best;}
  function elevationAt(x,z){const pavement=pavementAt(x,z);if(pavement)return pavement.y;const raw=demElevation(terrain,x,z),near=closestSegment(x,z);if(!near)return raw;const distance=Math.max(0,near.d-near.segment.half),weight=1-smooth(distance/SHOULDER);return lerp(raw,near.y+ROAD_OFFSET,weight);}
  // Extend the drivable surface over the actual surveyed plaza footprints.
  // Sample the existing ribbon/shoulder field before insertion so every seam
  // shares exactly the same elevation and original zero-bank ribbons survive.
  const surfaceTriangles=[],surfaceIndex=new SpatialIndex();
  for(const area of [...(world.pavingAreas||[]),...(world.junctionAreas||[])]){
    const paths=area.rings.map(r=>r.slice(0,-1).map(p=>({X:Math.round(p[0]*10000),Y:Math.round(p[1]*10000)})));
    const emit=points=>{if(Math.abs((points[1][0]-points[0][0])*(points[2][1]-points[0][1])-(points[1][1]-points[0][1])*(points[2][0]-points[0][0]))<1e-7)return;
      const triangle={points,y:points.map(p=>area.surface==='asphalt'?(closestSegment(...p)?.y??(elevationAt(...p)-ROAD_OFFSET)):elevationAt(...p)-ROAD_OFFSET),uv:points.map(p=>[p[0]/2,p[1]/2]),road:-1,surfaceId:area.id,bounds:bounds(points)};surfaceTriangles.push(triangle);surfaceIndex.insert(triangle,triangle.bounds);
    };
    // Clip a regular metric grid rather than subdividing skinny GIS earcut
    // fans. This keeps well-shaped interior triangles and smooth road normals.
    for(let z=Math.floor(area.bounds[1]);z<area.bounds[3];z++)for(let x=Math.floor(area.bounds[0]);x<area.bounds[2];x++)for(const points of [[[x,z],[x+1,z],[x+1,z+1]],[[x,z],[x+1,z+1],[x,z+1]]]){
      const clipper=new ClipperLib.Clipper();clipper.AddPaths(paths,ClipperLib.PolyType.ptSubject,true);clipper.AddPath(points.map(p=>({X:p[0]*10000,Y:p[1]*10000})),ClipperLib.PolyType.ptClip,true);const tree=new ClipperLib.PolyTree();clipper.Execute(ClipperLib.ClipType.ctIntersection,tree,ClipperLib.PolyFillType.pftEvenOdd,ClipperLib.PolyFillType.pftEvenOdd);
      for(const part of ClipperLib.JS.PolyTreeToExPolygons(tree)){const polygon=[part.outer,...part.holes].map(r=>{const p=r.map(v=>[v.X/10000,v.Y/10000]);return [...p,p[0]];}),f=flatten(polygon),ids=earcut(f.vertices,f.holes,2);
        for(let i=0;i<ids.length;i+=3){const p=ids.slice(i,i+3).map(j=>[f.vertices[j*2],f.vertices[j*2+1]]),bb=bounds(p),cuts=[...triangleIndex.box(bb),...surfaceIndex.box(bb)].map(t=>({poly:[...t.points,t.points[0]]}));
          for(const piece of subtractRoads([...p,p[0]],cuts)){const q=flatten(piece),js=earcut(q.vertices,q.holes,2);for(let j=0;j<js.length;j+=3)emit(js.slice(j,j+3).map(k=>[q.vertices[k*2],q.vertices[k*2+1]]));}
        }
      }
    }
  }
  for(const tri of surfaceTriangles)triangleIndex.insert(tri,tri.bounds);
  for(const island of world.roadIslands||[]){const center=[(island.bounds[0]+island.bounds[2])/2,(island.bounds[1]+island.bounds[3])/2],level=(closestSegment(...center)?.y??demElevation(terrain,...center))+.06+.18;islandLevels.set(island.id,level);const f=flatten(island.rings),ids=earcut(f.vertices,f.holes,2);for(let i=0;i<ids.length;i+=3){const points=ids.slice(i,i+3).map(j=>[f.vertices[j*2],f.vertices[j*2+1]]),tri={points,y:[level-.06,level-.06,level-.06],bounds:bounds(points),road:-3,island:true};islandIndex.insert(tri,tri.bounds);triangleIndex.insert(tri,tri.bounds);}}
  const network={world,islandLevels,junctionAreas:world.junctionAreas||[],pavingAreas:world.pavingAreas||[],surfaceTriangles,junctions,roads,segments,triangles,segmentIndex,triangleIndex,pavementAt,closestSegment,elevationAt,terrain};attachUrbanAprons(network,world.urbanAprons);installHistoricPaving(network);installRoadSurface(terrain,network);return network;
}

export function attachUrbanAprons(network,data){
 network.urbanAprons=data||{triangles:[],patches:[],contacts:[]};network.apronTriangles=[];
 for(const raw of data?.triangles||[]){const points=[[raw[0],raw[2]],[raw[3],raw[5]],[raw[6],raw[8]]],tri={points,y:[raw[1]-.06,raw[4]-.06,raw[7]-.06],bounds:bounds(points),road:-2,apron:true};network.apronTriangles.push(tri);network.triangleIndex.insert(tri,tri.bounds);}
 return network;
}
