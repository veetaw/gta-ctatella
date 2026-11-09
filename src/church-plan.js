import earcut,{flatten} from 'earcut';
import {offsetFootprint} from './building-plan.js';
export function churchPlan(b){
 const ring=b.rings[0],edge=b.church?.frontEdge??0,a=ring[edge],c=ring[(edge+1)%ring.length],length=Math.hypot(c[0]-a[0],c[1]-a[1]),dx=(c[0]-a[0])/length,dz=(c[1]-a[1])/length,center=[(a[0]+c[0])/2,(a[1]+c[1])/2];
 const across=p=>(p[0]-center[0])*dx+(p[1]-center[1])*dz,us=ring.map(across),lo=Math.min(...us),hi=Math.max(...us),mid=(lo+hi)/2,half=(hi-lo)/2;
 let nx=-dz,nz=dx;const target=b.church?.frontFaces||[center[0]*2-(b.bounds[0]+b.bounds[2])/2,center[1]*2-(b.bounds[1]+b.bounds[3])/2];if((target[0]-center[0])*nx+(target[1]-center[1])*nz<0){nx=-nx;nz=-nz;}
 const rise=b.church?.ridgeRise??1.6,heightAt=p=>b.roofY+rise*Math.max(0,1-Math.abs(across(p)-mid)/half),parts=offsetFootprint(b.rings,b.church?.overhang??.4),triangles=[];
 // Insert the exact ridge intersection into every triangle, so neither roof
 // plane bridges over the ridge even on concave or skewed surveyed footprints.
 const clip=(poly,sign)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],ua=(across(a)-mid)*sign,uc=(across(c)-mid)*sign;if(ua>=-1e-9)out.push(a);if((ua>0&&uc<0)||(ua<0&&uc>0)){const t=ua/(ua-uc);out.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t]);}}return out;};
 for(const part of parts){const f=flatten(part),ids=earcut(f.vertices,f.holes,2);for(let i=0;i<ids.length;i+=3){const p=ids.slice(i,i+3).map(j=>[f.vertices[j*2],f.vertices[j*2+1]]);for(const sign of [-1,1]){const q=clip(p,sign);for(let j=1;j<q.length-1;j++)triangles.push([q[0],q[j],q[j+1]].map(p=>[p[0],heightAt(p)+.08,p[1]]));}}}
 return {edge,a,c,center,length,dx,dz,nx,nz,across,mid,half,heightAt,parts,triangles,ridgeRise:rise,hasShutters:false,upperWindows:b.church?.upperWindows??3,portalCount:b.church?.portalCount??1,bellCount:['mother-church','san-vito'].includes(b.church?.variant)?0:1,crossCount:['mother-church','san-vito'].includes(b.church?.variant)?0:1};
}
