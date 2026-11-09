import ClipperLib from 'clipper-lib';import earcut,{flatten} from 'earcut';
import {nearest,inBuilding} from './world-math.js';
import {SpatialIndex,triangleHeight,subtractRoads} from './road-network.js';
import {cleanTriangle} from './mesh-quality.js';
const bounds=p=>[Math.min(...p.map(p=>p[0])),Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[0])),Math.max(...p.map(p=>p[1]))];
export function buildUrbanAprons(world,network){
 const quads=[],contacts=[],index=new SpatialIndex(10);for(const b of world.buildings)index.insert(b,b.bounds);
 function edgeAt(p){const surface=network.pavementAt(...p);if(surface)return {p,y:surface.y,d:0};let best=null;for(const tri of network.triangleIndex.box([p[0]-4.05,p[1]-4.05,p[0]+4.05,p[1]+4.05]))for(let i=0;i<3;i++){const a=tri.points[i],b=tri.points[(i+1)%3],q=nearest(p,a,b);if(q.d<=4&&(!best||q.d<best.d)){const point=[a[0]+(b[0]-a[0])*q.t,a[1]+(b[1]-a[1])*q.t];best={p:point,d:q.d,y:tri.y[i]+(tri.y[(i+1)%3]-tri.y[i])*q.t+.06};}}return best;}
 for(const building of world.buildings)for(const ring of building.rings)for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.2)continue;const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;let nx=-dz,nz=dx;const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(inBuilding([mid[0]+nx*.1,mid[1]+nz*.1],building)){nx=-nx;nz=-nz;}
  const n=Math.ceil(length/1.2);for(let j=0;j<n;j++){const point=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],p=point(j/n),q=point((j+1)/n),m=[(p[0]+q[0])/2,(p[1]+q[1])/2],center=edgeAt(m);if(!center||center.d<.05||(center.p[0]-m[0])*nx+(center.p[1]-m[1])*nz<.03)continue;
   const u=edgeAt(p)||center,v=edgeAt(q)||center;if(Math.max(u.d,v.d)>4||Math.hypot(u.p[0]-v.p[0],u.p[1]-v.p[1])>3.5)continue;
   const outside=[m[0]+nx*.15,m[1]+nz*.15];if(index.point(...outside).some(b=>b!==building&&inBuilding(outside,b)))continue;
   const insideA=[p[0]-nx*.4,p[1]-nz*.4],insideB=[q[0]-nx*.4,q[1]-nz*.4],poly=[insideA,u.p,v.p,insideB];
   const path=poly.map(p=>({X:Math.round(p[0]*10000),Y:Math.round(p[1]*10000)}));if(!ClipperLib.Clipper.Orientation(path))path.reverse();quads.push(path);contacts.push({buildingId:building.id,wall:[p,q],inside:[insideA,insideB],road:[u.p,v.p],distance:center.d,y:[u.y+.1,v.y+.1]});
  }
 }
 const quadIndex=new SpatialIndex(2),cells=new Set();for(const path of quads){const ring=path.map(p=>[p.X/10000,p.Y/10000]),bb=bounds(ring);quadIndex.insert({path},bb);for(let z=Math.floor(bb[1]);z<=Math.floor(bb[3]);z++)for(let x=Math.floor(bb[0]);x<=Math.floor(bb[2]);x++)cells.add(`${x},${z}`);}
 const patches=[],triangles=[];let rejected=0;
 const vertex=p=>{const edge=edgeAt(p),near=network.closestSegment(...p);return [p[0],edge?edge.y+.1:near?near.y+.16:network.elevationAt(...p)+.1,p[1]];};
 for(const cell of cells){const [x,z]=cell.split(',').map(Number),path=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]].map(p=>({X:p[0]*10000,Y:p[1]*10000}));
  const clipper=new ClipperLib.Clipper();clipper.StrictlySimple=true;clipper.AddPaths(quadIndex.box([x,z,x+1,z+1]).map(q=>q.path),ClipperLib.PolyType.ptSubject,true);clipper.AddPath(path,ClipperLib.PolyType.ptClip,true);const tree=new ClipperLib.PolyTree();clipper.Execute(ClipperLib.ClipType.ctIntersection,tree,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
  const cuts=network.triangleIndex.box([x,z,x+1,z+1]).map(t=>({poly:[...t.points,t.points[0]]}));
  for(const part of ClipperLib.JS.PolyTreeToExPolygons(tree)){const rings=[part.outer,...part.holes].map(r=>{const ps=r.map(v=>[v.X/10000,v.Y/10000]);return [...ps,ps[0]];}),f=flatten(rings),ids=earcut(f.vertices,f.holes,2);
   for(let i=0;i<ids.length;i+=3){const points=ids.slice(i,i+3).map(j=>[f.vertices[j*2],f.vertices[j*2+1]]);
    for(const polygon of subtractRoads([...points,points[0]],cuts)){patches.push(polygon);const q=flatten(polygon),js=earcut(q.vertices,q.holes,2);for(let k=0;k<js.length;k+=3){const ps=js.slice(k,k+3).map(j=>[q.vertices[j*2],q.vertices[j*2+1]]),vertices=ps.map(vertex);
     if(cleanTriangle(vertices))triangles.push(vertices.flat());else {rejected++;
      // Bevel acute boundary remnants with bounded bevel strips.
      // They extend only centimetres into the adjoining curb or buried wall.
      const pairs=[[0,1],[1,2],[2,0]].sort((a,b)=>Math.hypot(ps[b[0]][0]-ps[b[1]][0],ps[b[0]][1]-ps[b[1]][1])-Math.hypot(ps[a[0]][0]-ps[a[1]][0],ps[a[0]][1]-ps[a[1]][1])),[a,b]=pairs[0],length=Math.hypot(ps[a][0]-ps[b][0],ps[a][1]-ps[b][1]);
      if(length<.005)continue;const u=vertex(ps[a]),v=vertex(ps[b]),nx=-(ps[b][1]-ps[a][1])/length,nz=(ps[b][0]-ps[a][0])/length,width=Math.max(.045,length*.06);u[1]+=.001;v[1]+=.001;
      const corners=[[u[0]+nx*width,u[1],u[2]+nz*width],[v[0]+nx*width,v[1],v[2]+nz*width],[v[0]-nx*width,v[1],v[2]-nz*width],[u[0]-nx*width,u[1],u[2]-nz*width]];
      for(const ids of [[0,1,2],[0,2,3]]){const t=ids.map(i=>corners[i]);if(cleanTriangle(t))triangles.push(t.flat());}

     }
    }}
   }
  }
 }
 // A continuous strip penetrates each facade even where boolean clipping
 // creates an acute tip; this is the watertight wall connection, not a skirt.
 const wallBands=[];for(const c of contacts){const [a,b]=c.wall,[u,v]=c.inside,da=[a[0]-u[0],a[1]-u[1]],db=[b[0]-v[0],b[1]-v[1]],p=[[u[0],c.y[0]+.002,u[1]],[a[0]+da[0]*.5,c.y[0]+.002,a[1]+da[1]*.5],[b[0]+db[0]*.5,c.y[1]+.002,b[1]+db[1]*.5],[v[0],c.y[1]+.002,v[1]]];for(const ids of [[0,1,2],[0,2,3]]){const t=ids.map(i=>p[i]);if(cleanTriangle(t))wallBands.push(t.flat());}}
 triangles.unshift(...wallBands);
 const nodes=new Map();for(const r of network.roads)for(const s of [r.sections[0],r.sections.at(-1)]){const key=`${Math.round(s.x*2)},${Math.round(s.z*2)}`;if(!nodes.has(key))nodes.set(key,[]);nodes.get(key).push(s);}
 const junctionDiscs=[];for(const a of nodes.values())if(a.length>=3){const x=a.reduce((sum,s)=>sum+s.x,0)/a.length,z=a.reduce((sum,s)=>sum+s.z,0)/a.length,p=network.pavementAt(x,z);if(!p)continue;const radius=1.5,edge=Array.from({length:24},(_,i)=>[x+Math.cos(i/24*Math.PI*2)*radius,z+Math.sin(i/24*Math.PI*2)*radius]);if(edge.every(q=>{const s=network.pavementAt(...q);return s&&Math.abs(s.y-p.y)<.005;}))junctionDiscs.push({x,z,y:p.y,radius});}
 return {version:1,maxGap:4,wallOverlap:.4,curbHeight:.1,contacts,patches,triangles,rejected,junctionDiscs};
}

export function additionalUrbanBuildings(features){return (features||[]).filter(f=>['minor-building','utility-cabin','greenhouse'].includes(f.category)&&f.rings).map(f=>({id:f.id,rings:f.rings,bounds:f.bounds}));}
