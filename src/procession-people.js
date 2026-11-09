import * as THREE from 'three';
import {bake,processionLocation} from './procession-model.js';

const material=color=>new THREE.MeshStandardMaterial({color,roughness:.92});
const skin=[material('#bb8766'),material('#d1a185'),material('#a37358')],hair=[material('#392d29'),material('#685048'),material('#292925')];
const pants=[material('#2e3d46'),material('#514838'),material('#3e3f48')],shoe=material('#272c29'),eyes=material('#302827');
const tops=['#627485','#a17b61','#53644e','#a98391','#747679','#ddd0b6'].map(material);
const bandCoat=material('#293848'),brass=new THREE.MeshStandardMaterial({color:'#d9ae59',roughness:.38,metalness:.38}),drum=material('#ece3cc');

function add(g,shape,mat,x,y,z){const mesh=new THREE.Mesh(shape,mat);mesh.position.set(x,y,z);g.add(mesh);return mesh;}
function oval(g,mat,x,y,z,a,b,c){return add(g,new THREE.SphereGeometry(1,8,6).scale(a,b,c),mat,x,y,z);}
function box(g,mat,x,y,z,a,b,c){return add(g,new THREE.BoxGeometry(a,b,c),mat,x,y,z);}
function person(i,instrument,uniform=false){
 const root=new THREE.Group(),body=new THREE.Group(),coat=instrument||uniform?bandCoat:tops[i%tops.length],face=skin[i%skin.length],cap=hair[(i+1)%hair.length];
 root.add(body);
 add(body,new THREE.CylinderGeometry(.21,.23,.58,10).scale(1,1,.72),coat,0,1.11,0);
 oval(body,face,0,1.57,.018,.14,.18,.128);oval(body,cap,0,1.704,-.02,.146,.073,.139);
 oval(body,face,0,1.565,.139,.036,.037,.031);
 for(const x of [-.053,.053]){
  oval(body,eyes,x,1.608,.134,.011,.012,.008);
  oval(body,cap,x,1.633,.133,.020,.006,.008);
 }
 oval(body,cap,0,1.517,.134,.041,.009,.008);
 if(instrument||uniform){
  box(body,uniform?shoe:brass,0,1.23,.162,.037,.30,.02);
  add(body,new THREE.CylinderGeometry(.143,.151,.075,10),bandCoat,0,1.735,0);
  box(body,shoe,0,1.715,.123,.24,.021,.143);
 }
 for(const side of [-1,1]){
  oval(body,coat,side*.237,1.18,0,.086,.17,.078);
  const arm=oval(body,coat,side*.251,instrument?1.105:1.00,instrument?.17:.03,.055,.074,.15);
  if(!instrument)arm.rotation.x=Math.PI/2;
  oval(body,face,side*.24,instrument?1.12:.88,instrument?.28:.04,.053,.067,.051);
 }
 if(instrument==='drum'){
  add(body,new THREE.CylinderGeometry(.20,.20,.23,12),brass,0,.97,.32);
  add(body,new THREE.CylinderGeometry(.194,.194,.029,12),drum,0,1.095,.32);
  for(const x of [-.12,.12])box(body,shoe,x,1.17,.37,.022,.022,.31).rotation.x=-.18;
 }else if(instrument){
  const big=instrument==='tuba';
  add(body,new THREE.TorusGeometry(big?.18:.086,.024,6,13),brass,0,1.28,.32);
  add(body,new THREE.CylinderGeometry(big?.145:.084,.035,big?.31:.24,10),brass,0,1.40,big?.43:.48).rotation.x=Math.PI/2;
 }
 bake(body);
 const legs=[-1,1].map(side=>{
  const g=new THREE.Group();root.add(g);g.position.set(side*.112,.80,0);
  add(g,new THREE.CylinderGeometry(.083,.066,.69,7),pants[i%pants.length],0,-.35,0);
  oval(g,shoe,0,-.727,.045,.089,.055,.143);bake(g);return g;
 });
 return {root,legs};
}

export function makeMarchingBand(scene){
 const musicians=['trumpet','trumpet','drum','drum','trumpet','tuba'].map((instrument,i)=>person(i,instrument));
 const group=new THREE.Group();group.name='Banda della Madonna · sei musicisti';
 group.add(...musicians.map(m=>m.root));scene.add(group);
 return {
  update(poses,height,time){
   musicians.forEach(({root,legs},i)=>{
    const p=poses[i];root.visible=!!p?.visible;
    if(!root.visible)return;
    root.position.set(p.x,height(p.x,p.z)+Math.sin(time*6+i)*.021,p.z);root.rotation.y=p.yaw;
    legs.forEach((leg,k)=>leg.rotation.x=Math.sin(time*6+i+k*Math.PI)*.24);
   });
  },
 };
}

export function makeMunicipioCrowd(scene,{origin,height,ready,clear}){
 const center=processionLocation(origin),group=new THREE.Group();group.name='Pubblico ai bordi di Piazza Municipio';scene.add(group);
 let created=false;
 return (x,z)=>{
  const near=Math.hypot(x-center.x,z-center.z)<78&&ready(center.x,center.z);
  group.visible=near;
  if(!near||created)return;
  created=true;
  const occupied=[],centerY=height(center.x,center.z);
  for(let i=0;i<62&&occupied.length<28;i++){
   const angle=(i*2.399963)% (Math.PI*2),radius=7.8+(i%5)*1.08;
   const px=center.x+Math.sin(angle)*radius,pz=center.z+Math.cos(angle)*radius;
   const py=height(px,pz);
   if(Math.abs(py-centerY)>1.8||!clear(px,pz,.45)||occupied.some(p=>Math.hypot(px-p.x,pz-p.z)<.88))continue;
   occupied.push({x:px,z:pz});
   const {root}=person(i);root.position.set(px,py,pz);
   root.rotation.y=Math.atan2(center.x-px,center.z-pz)+Math.sin(i)*.23;
   root.scale.setScalar(.88+(i%5)*.044);group.add(root);
  }
  if(occupied.length)bake(group);
 };
}

export function makePatrolOfficer(scene,index){
 const figure=person(index,null,true);figure.root.visible=false;scene.add(figure.root);
 return figure;
}
