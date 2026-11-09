import earcut,{flatten} from 'earcut';
import ClipperLib from 'clipper-lib';
import {inside,inBuilding,nearest,elevation} from './world-math.js';

export function buildingSeed(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export const inRings=(p,rings)=>inside(p,rings[0])&&!rings.slice(1).some(r=>inside(p,r));
export function edgeDistance(p,rings){let d=Infinity;for(const r of rings)for(let i=1;i<r.length;i++)d=Math.min(d,nearest(p,r[i-1],r[i]).d);return d;}
export function offsetFootprint(rings,distance){
  const scale=10000,paths=rings.map((ring,i)=>{const p=ring.slice(0,-1).map(v=>({X:Math.round(v[0]*scale),Y:Math.round(v[1]*scale)}));if(ClipperLib.Clipper.Orientation(p)!==(i===0))p.reverse();return p;});
  const offset=new ClipperLib.ClipperOffset(2,.25*scale);offset.AddPaths(paths,ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);const tree=new ClipperLib.PolyTree();offset.Execute(tree,distance*scale);
  return ClipperLib.JS.PolyTreeToExPolygons(tree).map(p=>[p.outer,...p.holes].map(r=>{const points=r.map(p=>[p.X/scale,p.Y/scale]);return [...points,points[0]];}));
}
function area2(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function containsTriangle(p,a,b,c){const signs=[area2(a,b,p),area2(b,c,p),area2(c,a,p)];return signs.every(v=>v>=-1e-7)||signs.every(v=>v<=1e-7);}
export function roofPlan(building){
  const seed=buildingSeed(building.id),overhang=.35+(seed%101)/1000,rise=1.2+((seed>>>8)%601)/1000;
  const polygons=offsetFootprint(building.rings,overhang),parts=[];
  for(const rings of polygons){const f=flatten(rings),indices=earcut(f.vertices,f.holes,2),original=[];let pole=null,maxD=-1;
    const consider=p=>{if(!inRings(p,rings))return;const d=edgeDistance(p,rings);if(d>maxD){maxD=d;pole=p;}};
    for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3).map(j=>[f.vertices[j*2],f.vertices[j*2+1]]);original.push(tri);consider([(tri[0][0]+tri[1][0]+tri[2][0])/3,(tri[0][1]+tri[1][1]+tri[2][1])/3]);}
    const x=rings[0].map(p=>p[0]),z=rings[0].map(p=>p[1]),minX=Math.min(...x),maxX=Math.max(...x),minZ=Math.min(...z),maxZ=Math.max(...z);
    for(let i=0;i<=12;i++)for(let j=0;j<=12;j++)consider([minX+(maxX-minX)*i/12,minZ+(maxZ-minZ)*j/12]);
    if(!pole)continue;
    const heightAt=p=>building.roofY+.08+rise*Math.min(1,edgeDistance(p,rings)/Math.max(.1,maxD));
    const triangles=[];
    function split(a,b,c,depth=0){const edges=[[a,b,c],[b,c,a],[c,a,b]].sort((x,y)=>Math.hypot(y[0][0]-y[1][0],y[0][1]-y[1][1])-Math.hypot(x[0][0]-x[1][0],x[0][1]-x[1][1]));const [p,q,r]=edges[0];if(depth<10&&Math.hypot(p[0]-q[0],p[1]-q[1])>3.2){const m=[(p[0]+q[0])/2,(p[1]+q[1])/2];split(p,m,r,depth+1);split(m,q,r,depth+1);}else triangles.push([a,b,c].map(p=>[p[0],heightAt(p),p[1]]));}
    for(const tri of original){if(containsTriangle(pole,...tri)){for(let i=0;i<3;i++)if(Math.abs(area2(tri[i],tri[(i+1)%3],pole))>1e-6)split(tri[i],tri[(i+1)%3],pole);}else split(...tri);}
    parts.push({rings,triangles,pole,heightAt,maxD});
  }
  return {overhang,rise,parts};
}

export function facadePlans(building,terrain){
  const seed=buildingSeed(building.id),walls=[];let number=0;
  for(let ri=0;ri<building.rings.length;ri++)for(let i=1;i<building.rings[ri].length;i++){
    const a=building.rings[ri][i-1],b=building.rings[ri][i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.08)continue;
    const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];let nx=dz,nz=-dx;
    if(inBuilding([mid[0]+nx*.12,mid[1]+nz*.12],building)){nx=-nx;nz=-nz;}
    const variant=buildingSeed(`${building.id}/${number++}`),spacing=4.5+(variant%101)/100;
    let n=length<6?(length>=3.2&&variant%3!==0?1:0):Math.max(1,Math.floor((length-2)/spacing)+1);
    const centers=Array.from({length:n},(_,i)=>length/2+(i-(n-1)/2)*spacing);
    const samples=[.15,.35,.5,.65,.85].map(f=>elevation(terrain,a[0]+dx*length*f,a[1]+dz*length*f)).sort((a,b)=>a-b),floorY=samples[2]+.04;
    walls.push({ringIndex:ri,edgeIndex:i-1,a,b,length,dx,dz,nx,nz,floorY,spacing,centers,variant,outer:ri===0,balconies:[],point:s=>[a[0]+dx*s,a[1]+dz*s]});
  }
  const eligible=walls.filter(w=>w.outer&&w.length>8&&building.height>=5.5&&w.floorY+5.8<building.roofY).sort((a,b)=>b.length-a.length);
  const main=eligible[0];if(main){const centers=main.centers.filter(s=>s>1.5&&s<main.length-1.5);const count=main.length>16&&centers.length>2?2:1;for(let i=0;i<count;i++){const center=centers[Math.min(centers.length-1,Math.floor((i+1)*centers.length/(count+1)))];if(center!==undefined){const y=main.floorY+3.2;const p=main.point(center),front=[p[0]+main.nx*.95,p[1]+main.nz*.95];if(y-elevation(terrain,...front)>2.7)main.balconies.push({center,y,width:2.25,depth:.9});}}}
  return walls;
}
