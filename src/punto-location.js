import ClipperLib from 'clipper-lib';
import {inBuilding,nearest,elevation} from './world-math.js';
// WGS84 lon/lat -> ETRS89/GRS80 UTM33 using proj4, in metres. No local recentering.
export const PUNTO_GPS={latitude:40.6599007,longitude:15.3972878};
export const PUNTO_UTM={x:533583.708874587,y:4501079.795523997};
export function puntoPosition(origin){if(!origin)throw Error('Origine GIS mancante');return {x:PUNTO_UTM.x-origin.x,z:-(PUNTO_UTM.y-origin.y)};}
export function puntoSpawn(world){const p=puntoPosition(world.origin);let best=null;for(const road of world.roads)for(let i=1;i<road.points.length;i++){const n=nearest([p.x,p.z],road.points[i-1],road.points[i]);if(!best||n.d<best.d)best={...n,road};}return {...p,yaw:best?Math.atan2(best.q[0]-p.x,best.q[1]-p.z):0,street:best?.road.name||'Via Valle'};}
export function garageLocal(g,x,z){const dx=x-g.x,dz=z-g.z;return {u:dx*g.dx+dz*g.dz,v:dx*g.dz-dz*g.dx};}
export function garageWallCuts(g,a,b){if(!g)return [];const p=garageLocal(g,...a),q=garageLocal(g,...b);let lo=0,hi=1;for(const [from,to,min,max]of [[p.u,q.u,g.min,g.max],[p.v,q.v,-g.half,g.half]]){const d=to-from;if(Math.abs(d)<1e-9){if(from<min||from>max)return [];}else{const t0=(min-from)/d,t1=(max-from)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}}return hi>lo?[lo,hi]:[];}
export function preparePuntoGarage(world){
 if(world.puntoGaragePrepared)return;world.puntoGaragePrepared=true;const p=puntoSpawn(world),g={...p,dx:Math.sin(p.yaw),dz:Math.cos(p.yaw),min:-3,max:9,half:1.85,ceiling:elevation(world.terrain,p.x,p.z)+3.1};
 g.ring=[[-3,-g.half],[9,-g.half],[9,g.half],[-3,g.half],[-3,-g.half]].map(([u,v])=>[p.x+g.dx*u+g.dz*v,p.z+g.dz*u-g.dx*v]);
 for(const b of world.buildings){if(!inBuilding([p.x,p.z],b))continue;b.puntoGarage=g;const paths=b.rings.map((r,i)=>{const path=r.slice(0,-1).map(([x,z])=>({X:Math.round(x*1000),Y:Math.round(z*1000)}));if(ClipperLib.Clipper.Orientation(path)!==(i===0))path.reverse();return path;});const clip=g.ring.slice(0,-1).map(([x,z])=>({X:Math.round(x*1000),Y:Math.round(z*1000)}));if(!ClipperLib.Clipper.Orientation(clip))clip.reverse();const c=new ClipperLib.Clipper(),tree=new ClipperLib.PolyTree();c.AddPaths(paths,ClipperLib.PolyType.ptSubject,true);c.AddPath(clip,ClipperLib.PolyType.ptClip,true);c.Execute(ClipperLib.ClipType.ctDifference,tree,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);b.collisionParts=ClipperLib.JS.PolyTreeToExPolygons(tree).map((poly,i)=>{const rings=[poly.outer,...poly.holes].map(r=>{const points=r.map(p=>[p.X/1000,p.Y/1000]);return [...points,points[0]];}),points=rings.flat();return {id:`${b.id}/garage/${i}`,rings,bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))],roofY:b.roofY};});world.puntoGarage=g;
 }
}
export const buildingCollisionParts=b=>b.collisionParts||[b];
