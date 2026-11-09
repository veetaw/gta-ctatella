import {cameraCollisionFraction} from './camera-clearance.js';
export function segmentSphere(a,b,c,r){
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,ox=a.x-c.x,oy=a.y-c.y,oz=a.z-c.z,A=dx*dx+dy*dy+dz*dz,C=ox*ox+oy*oy+oz*oz-r*r;
 if(C<=0)return 0;if(A<1e-12)return Infinity;const B=ox*dx+oy*dy+oz*dz,D=B*B-A*C;if(D<0)return Infinity;const t=(-B-Math.sqrt(D))/A;return t>=0&&t<=1?t:Infinity;
}
export function bodyHit(a,b,x,y,z){return Math.min(...[.4,.9,1.4].map(h=>segmentSphere(a,b,{x,y:y+h,z},.36)));}
export function traceCover(a,b,solidsNear,height){
 const reach=Math.hypot(b.x-a.x,b.z-a.z)/2+.2,solids=solidsNear((a.x+b.x)/2,(a.z+b.z)/2,reach);let fraction=1,solid=null;
 for(const s of solids){const shape=Number.isFinite(s.roofY)?s:{...s,roofY:height((s.bounds[0]+s.bounds[2])/2,(s.bounds[1]+s.bounds[3])/2)+1.2},t=cameraCollisionFraction(a,b,[shape],.025);if(t<fraction){fraction=t;solid=s;}}
 const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/1.5));for(let i=1;i<=steps;i++){const t=i/steps;if(t>=fraction)break;const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(a.y+(b.y-a.y)*t<height(x,z)+.04){fraction=t;solid=null;break;}}
 return {fraction,solid};
}
