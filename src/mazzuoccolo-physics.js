import {Quaternion,Vector3} from 'three';
import {inBuilding,nearest} from './world-math.js';
export const MAZZUOCCOLO_RADIUS=.33;
// Local X is the long axis. The heavy bulb is off-centre relative to the handle.
export const MAZZUOCCOLO_SHAPE=[[-.12,0,0,.33],[-.30,0,0,.20],[.14,0,0,.245],[.40,0,0,.115],[.70,0,0,.10]];
const v=new Vector3(),turn=new Quaternion(),axis=new Vector3();
export function launchMazzuoccolo(x,z,yaw,power){
 const p=Math.max(0,Math.min(1,power)),speed=5+p*14;
 const orientation=new Quaternion().setFromAxisAngle(axis.set(0,1,0),yaw);
 orientation.multiply(turn.setFromAxisAngle(axis.set(0,0,1),.16));
 return {x,z,y:null,startX:x,startZ:z,vx:Math.sin(yaw)*speed,vz:Math.cos(yaw)*speed,vy:1+p*1.4,orientation,wx:Math.cos(yaw)*speed/.33,wy:.4,wz:-Math.sin(yaw)*speed/.33,spin:0,time:0,quiet:0,path:0,distance:0,bounces:0,grounded:false,status:'rolling'};
}
function support(body,height,x=body.x,z=body.z){
 let floor=-Infinity;for(const [px,py,pz,r] of MAZZUOCCOLO_SHAPE){v.set(px,py,pz).applyQuaternion(body.orientation);floor=Math.max(floor,height(x+v.x,z+v.z)+r-v.y);}return floor;
}
// Circle/polygon narrow phase for the bulb AND the protruding handle, including
// courtyards/holes. Normals always point out of the solid, even for penetration.
export function mazzuoccoloWallContact(body,x,z,solids){
 let hit=null;const point=[0,0];
 for(const [px,py,pz,r] of MAZZUOCCOLO_SHAPE){v.set(px,py,pz).applyQuaternion(body.orientation);const cx=x+v.x,cz=z+v.z;point[0]=cx;point[1]=cz;
  for(const b of solids){if(cx<b.bounds[0]-r||cx>b.bounds[2]+r||cz<b.bounds[1]-r||cz>b.bounds[3]+r)continue;
   let best=null,a=null,c=null;for(const ring of b.rings)for(let i=1;i<ring.length;i++){const n=nearest(point,ring[i-1],ring[i]);if(!best||n.d<best.d){best=n;a=ring[i-1];c=ring[i];}}
   if(!best)continue;const inside=inBuilding(point,b);if(!inside&&best.d>=r)continue;
   let nx=cx-best.q[0],nz=cz-best.q[1],d=Math.hypot(nx,nz);if(d<1e-8){nx=c[1]-a[1];nz=a[0]-c[0];d=Math.hypot(nx,nz)||1;const probe=[cx+nx/d*.01,cz+nz/d*.01];if(inBuilding(probe,b)){nx=-nx;nz=-nz;}}else if(inside){nx=-nx;nz=-nz;}
   const depth=inside?r+best.d:r-best.d;if(!hit||depth>hit.depth)hit={nx:nx/d,nz:nz/d,depth,armX:v.x,armZ:v.z};
  }
 }return hit;
}
function bounce(body,hit){
 body.x+=hit.nx*(hit.depth+.002);body.z+=hit.nz*(hit.depth+.002);
 const normal=body.vx*hit.nx+body.vz*hit.nz;
 if(normal<0){const impulse=-(1+.43)*normal;body.vx=(body.vx+impulse*hit.nx)*.88;body.vz=(body.vz+impulse*hit.nz)*.88;
  // Off-centre impacts on the handle turn the body instead of only reversing it.
  body.wy=Math.max(-8,Math.min(8,body.wy+(hit.armZ*hit.nx-hit.armX*hit.nz)*impulse*2));body.wx*=.72;body.wz*=.72;body.bounces++;
 }
}
export function advanceMazzuoccolo(body,dt,surface){
 if(body.status!=='rolling')return body.status;
 const {height,contact,ready=()=>true}=surface;
 if(body.y===null)body.y=support(body,height)+.035;
 // Swept microsteps keep the thin handle from tunnelling through narrow walls.
 const steps=Math.max(1,Math.ceil(dt/(1/180)),Math.ceil(Math.hypot(body.vx,body.vz)*dt/.06)),h=dt/steps;
 for(let i=0;i<steps&&body.status==='rolling';i++){
  const ox=body.x,oz=body.z,oldFloor=support(body,height),gx=(height(ox+.2,oz)-height(ox-.2,oz))/.4,gz=(height(ox,oz+.2)-height(ox,oz-.2))/.4;
  if(body.grounded){body.vx-=6.54*gx*h;body.vz-=6.54*gz*h;
   // Eccentric mass produces small periodic sideways impulses while tumbling.
   const speed=Math.hypot(body.vx,body.vz),wobble=Math.sin(body.spin)*.055,fx=body.vz*wobble,fz=-body.vx*wobble;
   body.vx+=fx*h;body.vz+=fz*h;
   const drag=(1.25+.035*speed*speed+.16*Math.abs(Math.sin(body.spin)))*h,scale=Math.max(0,1-drag/(speed||1));body.vx*=scale;body.vz*=scale;
   const blend=1-Math.exp(-h*8);body.wx+=(body.vz/.33-body.wx)*blend;body.wz+=(-body.vx/.33-body.wz)*blend;
  }
  body.wy*=Math.exp(-h*1.8);const angular=Math.hypot(body.wx,body.wy,body.wz);
  if(angular>1e-6){axis.set(body.wx,body.wy,body.wz).multiplyScalar(1/angular);turn.setFromAxisAngle(axis,angular*h);body.orientation.premultiply(turn).normalize();}
  body.spin+=angular*h;body.vy-=9.81*h;
  const nx=ox+body.vx*h,nz=oz+body.vz*h;
  if(!ready(nx,nz)){body.status='lost';break;}
  body.x=nx;body.z=nz;body.y+=body.vy*h;
  // Resolve corners iteratively before testing the terrain step.
  for(let pass=0;pass<4&&contact;pass++){const hit=contact(body,body.x,body.z);if(!hit)break;bounce(body,hit);}
  const rotatedOldFloor=support(body,height,ox,oz);
  let floor=support(body,height),travel=Math.hypot(body.x-ox,body.z-oz);
  // Raised kerbs: a sharp step blocks a low body; a flying throw can clear it.
  if(floor-rotatedOldFloor>.075&&floor-rotatedOldFloor>travel*.85&&body.y<floor+.04){
   const length=travel||1;body.x=ox;body.z=oz;bounce(body,{nx:(ox-nx)/length,nz:(oz-nz)/length,depth:0,armX:0,armZ:0});floor=support(body,height);
  }
  body.grounded=body.y<=floor+.002;
  if(body.grounded){const impact=Math.max(0,-body.vy),rise=Math.max(0,floor-oldFloor);body.y=floor;
   body.vy=impact>.9?impact*.24:0;
   if(impact>.9){body.vx*=.95;body.vz*=.95;body.bounces++;}
   if(rise>.002){const speed=Math.hypot(body.vx,body.vz),scale=Math.sqrt(Math.max(0,speed*speed-2*9.81*rise*.35))/(speed||1);body.vx*=scale;body.vz*=scale;}
  }
  body.path+=Math.hypot(body.x-ox,body.z-oz);body.distance=Math.hypot(body.x-body.startX,body.z-body.startZ);body.time+=h;
  body.quiet=body.grounded&&Math.hypot(body.vx,body.vz)<.32&&Math.abs(body.vy)<.3?body.quiet+h:0;
  if(body.quiet>.8||body.time>30){body.status='stopped';body.vx=body.vz=body.vy=body.wx=body.wy=body.wz=0;}
 }
 return body.status;
}
