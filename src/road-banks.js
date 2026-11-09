import {cellarAccesses,outsideAccessSegments} from './cellar-access.js';
import {cleanTriangle} from './mesh-quality.js';
import earcut,{flatten} from 'earcut';
import {ROAD_OFFSET,SHOULDER,barycentric,subtractRoads,polygonsOverlap} from './road-network.js';

// Trim shoulders out of pavement instead of displacing their vertices. Shared
// untrimmed edges then keep identical heights, without torn triangles or spikes.
export function* bankBatches(network){
  const accesses=cellarAccesses(network.world);
  for(const road of network.roads){
    const positions=[],seals=[];
    const add=(a,b,c,target=positions)=>{if(!cleanTriangle([a,b,c]))return;if(target===positions){const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3,y=(a[1]+b[1]+c[1])/3,surface=network.pavementAt(x,z);if(surface&&y>surface.y-.005)return;}target.push(...a,...b,...c);};
    function clippedTriangle(a,b,c){
      const vertices=[a,b,c],points=vertices.map(p=>[p[0],p[2]]);
      const bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
      const cuts=network.triangleIndex.box(bounds).filter(t=>t.bounds[0]<bounds[2]&&t.bounds[2]>bounds[0]&&t.bounds[1]<bounds[3]&&t.bounds[3]>bounds[1]&&polygonsOverlap(points,t.points));
      if(!cuts.length&&!accesses.some(f=>f.bounds[0]<bounds[2]&&f.bounds[2]>bounds[0]&&f.bounds[1]<bounds[3]&&f.bounds[3]>bounds[1])){add(a,b,c);return;}
      const polygons=subtractRoads([...points,points[0]],cuts.map(t=>({poly:[...t.points,t.points[0]]})).concat(accesses.filter(f=>f.bounds[0]<bounds[2]&&f.bounds[2]>bounds[0]&&f.bounds[1]<bounds[3]&&f.bounds[3]>bounds[1])));
      for(const polygon of polygons){const f=flatten(polygon),indices=earcut(f.vertices,f.holes,2);for(let i=0;i<indices.length;i+=3){
        const tri=indices.slice(i,i+3).map(j=>[f.vertices[j*2],f.vertices[j*2+1]]);
        const result=tri.map(p=>{const w=barycentric(...p,...points);return w?[p[0],w.reduce((s,v,i)=>s+v*vertices[i][1],0),p[1]]:null;});
        if(result.every(Boolean))add(...result);
      }}
    }
    for(const side of ['left','right'])for(let i=1;i<road.sections.length;i++){
      const a=road.sections[i-1],b=road.sections[i],sign=side==='left'?1:-1;
      const point=(s,d)=>{const x=s[side][0]+s.nx*sign*d,z=s[side][1]+s.nz*sign*d;return [x,d===0?s.y+ROAD_OFFSET-.012:network.elevationAt(x,z)-.025,z];};
      for(let band=0;band<2;band++){
        const p=point(a,band/2*SHOULDER),q=point(b,band/2*SHOULDER),s=point(a,(band+1)/2*SHOULDER),t=point(b,(band+1)/2*SHOULDER);
        clippedTriangle(p,q,s);clippedTriangle(s,q,t);
      }
      const p=point(a,0),q=point(b,0),s=[p[0],p[1]-4,p[2]],t=[q[0],q[1]-4,q[2]];
      const seal=(a,b)=>{for(const [u,v] of outsideAccessSegments([a[0],a[2]],[b[0],b[2]],accesses)){const y=r=>{const dx=b[0]-a[0],dz=b[2]-a[2],f=((r[0]-a[0])*dx+(r[1]-a[2])*dz)/(dx*dx+dz*dz||1);return a[1]+(b[1]-a[1])*f;},p=[u[0],y(u),u[1]],q=[v[0],y(v),v[1]],s=[p[0],p[1]-4,p[2]],t=[q[0],q[1]-4,q[2]];add(p,q,s,seals);add(s,q,t,seals);}};
      seal(p,q);
      const u=point(a,SHOULDER),v=point(b,SHOULDER);
      if(!network.pavementAt(u[0],u[2])&&!network.pavementAt(v[0],v[2])&&!network.pavementAt((u[0]+v[0])/2,(u[2]+v[2])/2)){
        seal(u,v);
      }
    }
    yield {positions,seals};
  }
}
