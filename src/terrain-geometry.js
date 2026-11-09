import {cellarAccesses} from './cellar-access.js';
import {SpatialIndex} from './road-network.js';
import * as THREE from 'three';
import {elevation,inBuilding} from './world-math.js';

export function trianglesOverlap(a,b){
  for(const points of [a,b])for(let i=0;i<3;i++){
    const p=points[i],q=points[(i+1)%3],nx=q[1]-p[1],nz=p[0]-q[0];
    let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
    for(const v of a){const d=v[0]*nx+v[1]*nz;amin=Math.min(amin,d);amax=Math.max(amax,d);}
    for(const v of b){const d=v[0]*nx+v[1]*nz;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d);}
    if(amax<bmin-1e-8||bmax<amin-1e-8)return false;
  }return true;
}

export function terrainGeometry(w,network){
  const t=w.terrain,cols=t.cols-1,rows=t.rows-1,mask=new Uint8Array(cols*rows);
  for(const road of w.roads)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2.5);
    for(let k=0;k<=n;k++){
      const x=a[0]+(b[0]-a[0])*k/Math.max(n,1),z=a[1]+(b[1]-a[1])*k/Math.max(n,1),cx=Math.floor((x-t.minX)/t.cell),cz=Math.floor((z-t.minZ)/t.cell);
      for(let j=-1;j<=1;j++)for(let h=-1;h<=1;h++){const ix=cx+h,iz=cz+j;if(ix>=0&&ix<cols&&iz>=0&&iz<rows)mask[iz*cols+ix]=1;}
    }
  }
  for(const area of [...(w.pavingAreas||[]),...(w.junctionAreas||[]),...(w.roadIslands||[]),...(network?.urbanAprons?.patches||[]).map(rings=>{const p=rings.flat();return {bounds:[Math.min(...p.map(p=>p[0])),Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[0])),Math.max(...p.map(p=>p[1]))]};})]){const b=area.bounds;for(let z=Math.max(0,Math.floor((b[1]-t.minZ)/t.cell)-1);z<=Math.min(rows-1,Math.ceil((b[3]-t.minZ)/t.cell)+1);z++)for(let x=Math.max(0,Math.floor((b[0]-t.minX)/t.cell)-1);x<=Math.min(cols-1,Math.ceil((b[2]-t.minX)/t.cell)+1);x++)mask[z*cols+x]=1;}
  const buildings=new SpatialIndex();for(const b of [...w.buildings,...(w.urbanFootprints||[])])buildings.insert(b,b.bounds);
  const accesses=cellarAccesses(w);
  const groundY=(x,z)=>{for(const f of accesses){if(x<f.bounds[0]||x>f.bounds[2]||z<f.bounds[1]||z>f.bounds[3])continue;const dx=x-f.center[0],dz=z-f.center[1],u=dx*f.dx+dz*f.dz,v=dx*f.nx+dz*f.nz;if(Math.abs(u)<=f.half+.5&&v>=-.5&&v<=f.depth)return Math.min(elevation(t,x,z)-.025,f.floorY-.15);}const p=network?.pavementAt(x,z);if(p)return p.y-.45;if(buildings.point(x,z).some(b=>inBuilding([x,z],b)))return elevation(t,x,z)-.45;return elevation(t,x,z)-.025;};
  const base=new THREE.PlaneGeometry(t.maxX-t.minX,t.maxZ-t.minZ,cols,rows);base.rotateX(-Math.PI/2);
  const a=base.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,groundY(a.getX(i),a.getZ(i)));
  const index=[],old=base.index.array;for(let i=0;i<mask.length;i++)if(!mask[i])for(let j=0;j<6;j++)index.push(old[i*6+j]);base.setIndex(index);base.computeVertexNormals();
  const positions=[],uv=[],indices=[],sub=4;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)if(mask[j*cols+i]){
    const start=positions.length/3;
    for(let z=0;z<=sub;z++)for(let x=0;x<=sub;x++){
      const px=t.minX+(i+x/sub)*t.cell,pz=t.minZ+(j+z/sub)*t.cell;
      positions.push(px,groundY(px,pz),pz);uv.push((px-t.minX)/(t.maxX-t.minX),1-(pz-t.minZ)/(t.maxZ-t.minZ));
    }
    for(let z=0;z<sub;z++)for(let x=0;x<sub;x++){const k=start+z*(sub+1)+x;indices.push(k,k+sub+1,k+1,k+1,k+sub+1,k+sub+2);}
  }
  // A vertex outside the shoulder can be uphill of the road even though the
  // triangle crosses it. Cut every intersecting triangle conservatively below
  // the minimum road height, not just the vertices lying inside the ribbon.
  if(network)cutBelowRoad(positions,indices,network);
  // Neighbouring 5 m tiles duplicate their boundary vertices. Weld their
  // elevations after cutting, otherwise conservative excavation could crack
  // the seam even though the original DEM samples agreed.
  const welded=new Map(),stride=cols*sub+1,key=(x,z)=>Math.round((z-t.minZ)/(t.cell/sub))*stride+Math.round((x-t.minX)/(t.cell/sub));
  for(let i=0;i<positions.length;i+=3){const k=key(positions[i],positions[i+2]);welded.set(k,Math.min(welded.get(k)??Infinity,positions[i+1]));}
  for(let i=0;i<positions.length;i+=3)positions[i+1]=welded.get(key(positions[i],positions[i+2]));
  const refined=new THREE.BufferGeometry();refined.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));refined.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));refined.setIndex(indices);refined.computeVertexNormals();
  return [base,refined];
}

export function cutBelowRoad(positions,indices,network){
  for(let i=0;i<(indices?indices.length:positions.length/3);i+=3){
    const ids=indices?indices.slice(i,i+3):[i,i+1,i+2],p=ids.map(k=>[positions[k*3],positions[k*3+2]]);
    const bb=[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
    let cap=Infinity;
    for(const r of network.triangleIndex.box(bb)){
      const b=r.bounds;if(b[0]>bb[2]||b[2]<bb[0]||b[1]>bb[3]||b[3]<bb[1])continue;
      if(trianglesOverlap(p,r.points))cap=Math.min(cap,...r.y.map(y=>y+.06-.45));
    }
    if(cap!==Infinity)for(const k of ids)positions[k*3+1]=Math.min(positions[k*3+1],cap);
  }
}
