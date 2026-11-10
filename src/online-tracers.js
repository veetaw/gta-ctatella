import * as THREE from 'three';

const CAPACITY=96;
const SPEED=220;
const LENGTH=5;

export function createOnlineTracers(scene){
 const active=[];
 const positions=new Float32Array(CAPACITY*6);
 const geometry=new THREE.BufferGeometry();
 const position=new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('position',position);
 geometry.setDrawRange(0,0);
 const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xffdc87,toneMapped:false}));
 lines.frustumCulled=false;
 scene.add(lines);

 return {
  shot({x,y,z,endpoints}){
   if(!Array.isArray(endpoints))return;
   for(const [tx,ty,tz] of endpoints){
    const direction=new THREE.Vector3(tx-x,ty-y,tz-z);
    const distance=direction.length();
    if(!Number.isFinite(distance)||distance<.05)continue;
    if(active.length===CAPACITY)active.shift();
    active.push({x,y,z,direction:direction.divideScalar(distance),distance,travel:0});
   }
  },
  update(dt){
   let offset=0;
   for(let i=active.length-1;i>=0;i--){
    const shot=active[i];
    const {x,y,z,direction,distance}=shot;
    if(shot.travel>distance+LENGTH){active.splice(i,1);continue;}
    const head=Math.min(distance,shot.travel+SPEED*dt);
    const tail=Math.max(0,head-LENGTH);
    positions.set([x+direction.x*tail,y+direction.y*tail,z+direction.z*tail,
     x+direction.x*head,y+direction.y*head,z+direction.z*head],offset);
    offset+=6;
    shot.travel+=SPEED*dt;
   }
   geometry.setDrawRange(0,offset/3);
   if(offset)position.needsUpdate=true;
  },
  clear(){active.length=0;geometry.setDrawRange(0,0);},
 };
}
