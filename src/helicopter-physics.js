export const HELICOPTER_SPEC={id:'helicopter',label:'Elicottero',gears:[0,8,16,24],maxSpeed:28,width:2,length:6};
export const OFFLINE_HELICOPTER_MAX_SPEED=400/3.6;
export function advanceHelicopter(h,input,dt,elevationAt,solidsNear,terrain,isReady=()=>true){
 h.yaw+=input.turn*1.35*dt;
 const target=input.forward*(input.maxSpeed??HELICOPTER_SPEC.maxSpeed);
 h.speed+=(target-h.speed)*(1-Math.exp(-dt*1.7));
 const strafe=h.strafeSpeed??0;
 h.strafeSpeed=strafe+((input.strafe??0)*12-strafe)*(1-Math.exp(-dt*2.8));
 if(input.maxSpeed!==undefined){
  const horizontalSpeed=Math.hypot(h.speed,h.strafeSpeed);
  if(horizontalSpeed>input.maxSpeed){
   const scale=input.maxSpeed/horizontalSpeed;
   h.speed*=scale;
   h.strafeSpeed*=scale;
  }
 }
 const sin=Math.sin(h.yaw),cos=Math.cos(h.yaw);
 const nx=h.x+(sin*h.speed+cos*h.strafeSpeed)*dt,nz=h.z+(cos*h.speed-sin*h.strafeSpeed)*dt;
 if(nx>terrain.minX+12&&nx<terrain.maxX-12&&nz>terrain.minZ+12&&nz<terrain.maxZ-12&&isReady(nx,nz)){h.x=nx;h.z=nz;}else{h.speed*=Math.exp(-dt*8);h.strafeSpeed*=Math.exp(-dt*8);}
 const ground=elevationAt(h.x,h.z);
 let floor=ground-.055;
 // Fly above roofs instead of letting the rotorcraft pass through buildings.
 for(const b of solidsNear(h.x,h.z,4))if(Number.isFinite(b.roofY)&&h.x>b.bounds[0]-3&&h.x<b.bounds[2]+3&&h.z>b.bounds[1]-3&&h.z<b.bounds[3]+3)floor=Math.max(floor,b.roofY+3.5);
 h.verticalSpeed+=(input.lift*7-h.verticalSpeed)*(1-Math.exp(-dt*3));
 const nextY=h.y+h.verticalSpeed*dt;
 const impact=nextY<floor?(floor>ground+3&&h.y<floor-.3?Math.hypot(h.speed,h.strafeSpeed,h.verticalSpeed):Math.max(0,-h.verticalSpeed-4)):0;
 h.y=Math.max(floor,Math.min(ground+180,nextY));
 if(h.y<=floor+.001&&h.verticalSpeed<0)h.verticalSpeed=0;
 h.altitude=Math.max(0,h.y-ground);
 return impact;
}
