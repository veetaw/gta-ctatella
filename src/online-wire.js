export const ROOM_SIZE = 6;
export const POSE_BYTES = 17;
export const KINDS = ['foot','panda','punto','rambo','motocross','ape','offroad','ferrari','helicopter'];
export const WEAPONS = {
 pistol:{cap:12,reserve:60,delay:.23,damage:32,pellets:1,spread:0,muzzle:.171},
 shotgun:{cap:2,reserve:20,delay:.64,damage:25,pellets:6,spread:.145,muzzle:.54},
 smg:{cap:30,reserve:120,delay:.105,damage:18,pellets:1,spread:.05,muzzle:.31},
};
export function writePose(view, offset, [kind,x,y,z,yaw,speed]){
 view.setUint8(offset,KINDS.indexOf(kind));
 view.setInt32(offset+1,Math.round(x*100));
 view.setInt32(offset+5,Math.round(y*100));
 view.setInt32(offset+9,Math.round(z*100));
 view.setInt16(offset+13,Math.round(yaw*1000));
 view.setInt16(offset+15,Math.round(speed*100));
}
export function readPose(view,offset=0){
 const kind=KINDS[view.getUint8(offset)];
 if(!kind)return null;
 return [kind,view.getInt32(offset+1)/100,view.getInt32(offset+5)/100,view.getInt32(offset+9)/100,
  view.getInt16(offset+13)/1000,view.getInt16(offset+15)/100];
}
