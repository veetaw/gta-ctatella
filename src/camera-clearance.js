// DBT walls, trees and traffic islands are collision polygons without roofY.
// Never allow one missing height to poison the camera's transform with NaN.
export function cameraRoofClearance(desiredY,focusY,solids){
 const base=Number.isFinite(desiredY)?desiredY:focusY+6.5;
 const ceiling=Math.max(base,focusY+18);
 let height=base;
 for(const solid of solids)if(Number.isFinite(solid.roofY))height=Math.max(height,Math.min(ceiling,solid.roofY+2.5));
 return height;
}

// Continuous swept sphere against the surveyed polygon edges and roof planes.
// Sampling a ray every metre misses thin walls and leaves the near plane inside facades.
import {inBuilding,nearest} from './world-math.js';
export function cameraCollisionFraction(start,end,solids,radius=.3){
 const dx=end.x-start.x,dz=end.z-start.z,dy=end.y-start.y,distance=Math.hypot(dx,dy,dz),a=dx*dx+dz*dz;
 if(!Number.isFinite(distance)||distance<1e-7)return 1;
 let earliest=1;
 for(const solid of solids){
  const roof=solid.roofY,b=solid.bounds;if(!Number.isFinite(roof)||!b||!solid.rings||Math.min(start.y,end.y)>roof+radius||Math.min(start.x,end.x)>b[2]+radius||Math.max(start.x,end.x)<b[0]-radius||Math.min(start.z,end.z)>b[3]+radius||Math.max(start.z,end.z)<b[1]-radius)continue;
  const blocked=t=>{const x=start.x+dx*t,z=start.z+dz*t;if(start.y+dy*t>roof+radius||x<b[0]-radius||x>b[2]+radius||z<b[1]-radius||z>b[3]+radius)return false;const p=[x,z];return inBuilding(p,solid)||solid.rings.some(r=>r.slice(1).some((q,i)=>nearest(p,r[i],q).d<radius));};
  const events=[0,earliest],add=t=>{if(t>=0&&t<=earliest&&Number.isFinite(t))events.push(t);};
  if(Math.abs(dy)>1e-8)add((roof+radius-start.y)/dy);
  for(const ring of solid.rings)for(let i=1;i<ring.length;i++){
   const p=ring[i-1],q=ring[i],ex=q[0]-p[0],ez=q[1]-p[1],length=Math.hypot(ex,ez);if(length<1e-8)continue;
   const nx=-ez/length,nz=ex/length,signed=(start.x-p[0])*nx+(start.z-p[1])*nz,rate=dx*nx+dz*nz;
   if(Math.abs(rate)>1e-8)for(const side of [-radius,radius]){const t=(side-signed)/rate,u=((start.x+dx*t-p[0])*ex+(start.z+dz*t-p[1])*ez)/(length*length);if(u>=0&&u<=1)add(t);}
   if(a>1e-10){const px=start.x-p[0],pz=start.z-p[1],bb=2*(px*dx+pz*dz),c=px*px+pz*pz-radius*radius,discriminant=bb*bb-4*a*c;if(discriminant>=0){const root=Math.sqrt(discriminant);add((-bb-root)/(2*a));add((-bb+root)/(2*a));}}
  }
  events.sort((a,b)=>a-b);for(const t of events)if(blocked(Math.min(1,t+1e-6))){earliest=Math.max(0,t-.025/distance);break;}
 }
 return earliest;
}
