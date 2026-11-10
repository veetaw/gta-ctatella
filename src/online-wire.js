export const ROOM_SIZE = 6;
export const POSE_BYTES = 17;
export const KINDS = ['foot','panda','punto','rambo','motocross','ape','offroad','ferrari','helicopter'];
export const WEAPONS = {
 pistol:{cap:12,reserve:60,delay:.23,damage:32,pellets:1,spread:0,muzzle:.171},
 shotgun:{cap:2,reserve:20,delay:.64,damage:25,pellets:6,spread:.145,muzzle:.54},
 smg:{cap:30,reserve:120,delay:.105,damage:18,pellets:1,spread:.05,muzzle:.31},
};
const EQUIPMENT=['hands',...Object.keys(WEAPONS)];
export function writePose(view, offset, [kind,x,y,z,yaw,speed,weapon], includeWeapon=true){
 const equipment=includeWeapon&&kind==='foot'?Math.max(0,EQUIPMENT.indexOf(weapon)):0;
 view.setUint8(offset,KINDS.indexOf(kind)|(equipment<<4));
 view.setInt32(offset+1,Math.round(x*100));
 view.setInt32(offset+5,Math.round(y*100));
 view.setInt32(offset+9,Math.round(z*100));
 view.setInt16(offset+13,Math.round(yaw*1000));
 view.setInt16(offset+15,Math.round(speed*100));
}
export function readPose(view,offset=0){
 const code=view.getUint8(offset);
 const kind=KINDS[code&15];
 if(!kind)return null;
 const pose=[kind,view.getInt32(offset+1)/100,view.getInt32(offset+5)/100,view.getInt32(offset+9)/100,
  view.getInt16(offset+13)/1000,view.getInt16(offset+15)/100];
 if(kind==='foot'&&code>>4)pose.push(EQUIPMENT[code>>4]??'hands');
 return pose;
}

export const HIDE_SAVE_RADIUS=24;
export function hideSavePoint(world){
 const plaza=world.heritage?.plazaCenter;
 return plaza?{x:plaza[0],z:plaza[1]}:world.spawn;
}

export const HIDE_START_RADIUS=5;
export function hideStartPoint(world){
 const plaza=hideSavePoint(world);
 const church=world.buildings?.find(building=>building.id===world.heritage?.viaPonteChurchId);
 if(!church)return {...plaza,yaw:0};
 let wall,nearest=Infinity;
 for(const ring of church.rings)for(let i=1;i<ring.length;i++){
  const [x,z]=ring[i-1],dx=ring[i][0]-x,dz=ring[i][1]-z;
  const length=dx*dx+dz*dz;
  if(!length)continue;
  const t=Math.max(0,Math.min(1,((plaza.x-x)*dx+(plaza.z-z)*dz)/length));
  const wx=x+t*dx,wz=z+t*dz,distance=Math.hypot(wx-plaza.x,wz-plaza.z);
  if(distance<nearest){wall={x:wx,z:wz};nearest=distance;}
 }
 if(!wall||nearest<.01)return {...plaza,yaw:0};
 const dx=(wall.x-plaza.x)/nearest,dz=(wall.z-plaza.z)/nearest;
 return {x:wall.x-dx*1.5,z:wall.z-dz*1.5,yaw:Math.atan2(dx,dz)};
}
