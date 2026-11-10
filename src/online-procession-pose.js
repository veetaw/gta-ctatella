export const PROCESSION_SEATS=4;
export const PROCESSION_JOIN_RADIUS=7;
export const PROCESSION_PACE=1.25;

export function processionBearerPose({x,y,z,yaw},seat){
 const side=seat<2?-.88:.88;
 const along=seat%2===0?-1.65:1.65;
 const c=Math.cos(yaw),s=Math.sin(yaw);
 return ['foot',x+c*side+s*along,y,z-s*side+c*along,yaw,PROCESSION_PACE];
}
