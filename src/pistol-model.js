import * as THREE from 'three';
import {bake} from './procession-model.js';

export function makePistol(){
 const gun=new THREE.Group(),body=new THREE.Group();gun.name='Pistola semiautomatica';gun.add(body);
 const slide=new THREE.MeshStandardMaterial({color:'#505657',roughness:.32,metalness:.62}),frame=new THREE.MeshStandardMaterial({color:'#272c2d',roughness:.56,metalness:.25}),steel=new THREE.MeshStandardMaterial({color:'#81898a',roughness:.32,metalness:.73}),grip=new THREE.MeshStandardMaterial({color:'#171b1b',roughness:.85}),black=new THREE.MeshBasicMaterial({color:'#090c0d'});
 function mesh(geo,m,x,y,z){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);body.add(o);return o;}
 function box(m,x,y,z,w,h,d){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);}
 function profile(points,m,width){const shape=new THREE.Shape();points.forEach(([y,z],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:1,steps:1,bevelThickness:.003,bevelSize:.003});geo.rotateY(-Math.PI/2);geo.translate(width/2,0,0);return mesh(geo,m,0,0,0);}
 profile([[.015,-.081],[.065,-.077],[.073,-.058],[.073,.148],[.061,.163],[.017,.163]],slide,.045);
 profile([[.017,-.074],[.01,.139],[-.017,.138],[-.023,.031],[-.037,-.022],[-.105,-.046],[-.108,-.101],[-.073,-.092],[-.004,-.066]],frame,.044);
 profile([[-.022,-.057],[-.035,-.008],[-.102,-.036],[-.107,-.094],[-.065,-.086]],grip,.052);
 box(grip,0,-.109,-.066,.056,.009,.067);
 for(const side of [-1,1]){
  for(let i=0;i<7;i++){box(frame,side*.024,.044,-.059+i*.007,.004,.036,.0025);box(grip,side*.028,-.048-i*.007,-.057-i*.002,.003,.002,.033);}
  box(steel,side*.024,.047,.019,.004,.017,.037);
 }
 const muzzleGeometry=new THREE.CylinderGeometry(.015,.015,.012,16).rotateX(Math.PI/2);
 mesh(muzzleGeometry,steel,0,.043,.164);mesh(new THREE.CircleGeometry(.009,12),black,0,.043,.171);
 box(frame,0,.081,.139,.012,.014,.013);box(frame,0,.08,-.059,.027,.012,.012);
 for(const x of [-.009,.009])box(steel,x,.085,-.065,.004,.004,.002);
 // Trigger guard and curved trigger beneath the frame.
 const guard=mesh(new THREE.TorusGeometry(.029,.0045,6,18).scale(.68,1,1),frame,0,-.032,.027);guard.rotation.y=Math.PI/2;
 box(steel,0,-.035,.016,.009,.023,.007).rotation.x=-.23;
 const longGuns={};
 for(const id of ['shotgun','smg']){
  const variant=new THREE.Group(),shotgun=id==='shotgun',end=shotgun?.54:.31;
  const put=(geometry,material,x,y,z)=>{
   const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);variant.add(part);
  };
  const block=(w,h,d,x,y,z,material)=>put(new THREE.BoxGeometry(w,h,d),material,x,y,z);
  const stock=shotgun?new THREE.MeshStandardMaterial({color:'#6b3e28',roughness:.58}):grip;
  block(.059,.072,.26,0,.044,.035,frame);
  block(.054,.066,.21,0,.017,-.17,stock);
  block(.048,.093,.048,0,-.046,-.028,grip);
  block(.058,.04,shotgun?.18:.12,0,.024,shotgun?.28:.18,stock);
  if(!shotgun)block(.040,.15,.069,0,-.068,.088,slide);
  for(const x of shotgun?[-.015,.015]:[0])put(new THREE.CylinderGeometry(.013,.014,end-.15,10).rotateX(Math.PI/2),steel,x,.054,(end+.15)/2);
  block(.014,.022,.022,0,.076,end-.05,frame);
  bake(variant);gun.add(variant);variant.visible=false;longGuns[id]=variant;
 }
 bake(body);
 const flash=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:'#ffd073',toneMapped:false}));flash.position.set(0,.043,.205);flash.scale.set(.027,.021,.055);flash.visible=false;gun.add(flash);
 gun.position.set(.4,1.16,.48);gun.visible=false;
 let kick=0,selected=body;
 return {gun,select(id){
  selected=longGuns[id]||body;body.visible=selected===body;
  for(const variant of Object.values(longGuns))variant.visible=variant===selected;
  flash.position.set(0,.043,id==='shotgun'?.57:id==='smg'?.34:.205);
 },fire(){kick=1;},update(dt){kick=Math.max(0,kick-dt*8.5);selected.position.z=-kick*.033;selected.rotation.x=-kick*.15;flash.visible=kick>.55;}};
}
