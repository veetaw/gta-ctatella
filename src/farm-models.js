import * as THREE from 'three';
import {bake} from './procession-model.js';

const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.91});
const wood=mat('#79563d'),post=mat('#ae916b'),leaf=mat('#4e7133'),vineLeaf=mat('#73883e'),fruit=mat('#563650');
const canvas=mat('#c4b99c'),steel=mat('#52564f'),paint=mat('#879281'),rubber=mat('#242625'),glass=mat('#455d60');
const skin=mat('#c78f6b'),cloth=mat('#686b45'),denim=mat('#333f46'),pink=mat('#c88d85'),darkPink=mat('#a75e5d'),sack=mat('#a68a60');

const wheatSack=mat('#3264ac'),wheatTie=mat('#172f62');

function mesh(group,geometry,material,x,y,z){
 const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);group.add(m);return m;
}
function box(g,m,x,y,z,w,h,d){return mesh(g,new THREE.BoxGeometry(w,h,d),m,x,y,z);}
function oval(g,m,x,y,z,w,h,d){return mesh(g,new THREE.IcosahedronGeometry(1,1).scale(w,h,d),m,x,y,z);}
function beam(g,m,a,b,thickness){
 const dir=new THREE.Vector3().subVectors(b,a),p=a.clone().lerp(b,.5);
 const piece=box(g,m,p.x,p.y,p.z,thickness,dir.length(),thickness);
 piece.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
}
function finish(g){bake(g);return g;}

export function makeVines(scene,plot,rows,height){
 const root=new THREE.Group();root.name='Vigneto di Via Serrone';root.position.set(plot.x,height(plot.x,plot.z),plot.z);scene.add(root);
 const y=(x,z)=>height(plot.x+x,plot.z+z)-root.position.y;
 const stems=new THREE.Group();root.add(stems);
 const plants=rows.map(z=>{
  const sparse=new THREE.Group(),pampini=new THREE.Group(),grapes=new THREE.Group();
  root.add(sparse,pampini,grapes);
  for(const x of [-6,0,6])box(stems,post,x,y(x,z)+.65,z,.13,1.42,.13);
  for(const x of [-6,0])for(const h of [.64,1.15])beam(stems,steel,new THREE.Vector3(x,y(x,z)+h,z),new THREE.Vector3(x+6,y(x+6,z)+h,z),.019);
  for(let i=0;i<7;i++){
   const x=i*1.66-5,ground=y(x,z);
   beam(stems,wood,new THREE.Vector3(x,ground-.05,z),new THREE.Vector3(x+.10,ground+.91,z-.06),.078);
   for(const side of [-1,1]){
    oval(sparse,side===1?leaf:vineLeaf,x+side*.34,ground+1.20,z,.48,.28,.39);
    oval(pampini,side===1?vineLeaf:leaf,x+side*.25,ground+.94,z+side*.24,.53,.34,.43);
    for(let k=0;k<4;k++)oval(grapes,fruit,x+side*(.23+k*.035),ground+.81-k*.05,z+side*.32,.08,.087,.079);
   }
  }
  finish(sparse);
  return {pampini:finish(pampini),grapes:finish(grapes)};
 });
 finish(stems);
 return {root,show(trimmed,picked){
  for(const [i,row] of plants.entries()){row.pampini.visible=i>=trimmed;row.grapes.visible=i>=picked;}
 }};
}

export function makeGrapeCrate(){
 const g=new THREE.Group();
 box(g,wood,0,.034,0,.43,.068,.32);
 for(const x of [-.205,.205])box(g,post,x,.13,0,.034,.205,.33);
 for(const z of [-.149,.149])for(const y of [.10,.19])box(g,post,0,y,z,.41,.062,.031);
 for(let i=0;i<8;i++)oval(g,fruit,(i%4-1.5)*.091,.16+(i%3)*.018,(Math.floor(i/4)-.5)*.135,.066,.066,.079);
 return finish(g);
}
function makeSack(fabric,tie){
 const g=new THREE.Group();
 oval(g,fabric,0,.19,0,.225,.24,.17);oval(g,fabric,0,.41,0,.09,.06,.08);box(g,tie,0,.373,0,.15,.023,.115);
 return finish(g);
}
export function makePotatoSack(){return makeSack(sack,wood);}
export function makeWheatSack(){
 const bag=makeSack(wheatSack,wheatTie);
 bag.scale.setScalar(2);
 return bag;
}

export function makeVendor(scene,location,yaw,height){
 const truck=new THREE.Group();truck.name='Camion telato · Lu patanar';
 truck.position.set(location.x,height(location.x,location.z),location.z);truck.rotation.y=yaw;scene.add(truck);
 box(truck,steel,0,.55,0,2.10,.26,5.35);
 box(truck,paint,0,1.28,1.77,2.12,1.66,1.74);
 box(truck,glass,0,1.65,2.647,1.77,.50,.024);
 for(const x of [-1.07,1.07]){
  box(truck,glass,x,1.66,1.89,.03,.46,.78);
  box(truck,steel,x*1.15,1.67,2.28,.15,.22,.12);
  for(const z of [-1.69,1.86])mesh(truck,new THREE.CylinderGeometry(.40,.40,.24,12).rotateZ(Math.PI/2),rubber,x,.40,z);
  box(truck,canvas,x,1.62,-1.02,.054,1.57,3.3);
 }
 box(truck,post,0,.78,-1.02,2.09,.18,3.32);
 box(truck,canvas,0,2.44,-1.02,2.22,.13,3.40);
 box(truck,canvas,0,2.23,-2.70,2.18,.28,.14);
 for(const x of [-.91,.91])box(truck,steel,x,1.58,-2.68,.069,1.60,.069);
 for(const x of [-.73,.73])box(truck,post,x,.90,-2.10,.37,.11,.37);
 const bags=Array.from({length:5},(_,i)=>makePotatoSack());
 finish(truck);
 for(const [i,bag] of bags.entries()){bag.position.set((i%3-1)*.58,.86,-2.25+Math.floor(i/3)*.60);truck.add(bag);}
 const seller=new THREE.Group();seller.name='Lu patanar';
 const x=location.x-2.12*Math.sin(yaw)+1.71*Math.cos(yaw),z=location.z-2.12*Math.cos(yaw)-1.71*Math.sin(yaw);
 seller.position.set(x,height(x,z),z);seller.rotation.y=yaw+Math.PI;scene.add(seller);
 oval(seller,cloth,0,1.15,0,.29,.38,.19);oval(seller,skin,0,1.60,0,.143,.18,.142);
 oval(seller,skin,0,1.585,.136,.039,.045,.038);
 oval(seller,wood,0,1.537,.132,.064,.017,.012);
 for(const x of [-.052,.052]){
  oval(seller,rubber,x,1.632,.13,.012,.011,.009);
  oval(seller,wood,x,1.658,.13,.025,.007,.008);
 }
 box(seller,sack,0,1.13,.18,.31,.42,.025);
 oval(seller,cloth,0,1.74,.01,.16,.076,.15);box(seller,cloth,0,1.72,.123,.25,.034,.15);
 for(const side of [-1,1]){
  box(seller,denim,side*.118,.43,0,.19,.75,.20);box(seller,rubber,side*.118,.07,.05,.21,.14,.31);
  oval(seller,cloth,side*.305,1.12,0,.085,.25,.09);oval(seller,skin,side*.325,.93,.025,.065,.099,.069);
 }
 finish(seller);
 return {truck,seller,point:{x,z}};
}

export function makePigPen(scene,pen,height){
 const root=new THREE.Group();root.name='Recinto dei due maiali';root.position.set(pen.x,height(pen.x,pen.z),pen.z);scene.add(root);
 const y=(x,z)=>height(pen.x+x,pen.z+z)-root.position.y;
 const fence=new THREE.Group();root.add(fence);
 const outline=[[-3.3,-2.5],[3.3,-2.5],[3.3,2.5],[-3.3,2.5],[-3.3,-2.5]];
 for(let i=1;i<outline.length;i++){
  const [ax,az]=outline[i-1],[bx,bz]=outline[i];
  for(let j=0;j<=3;j++){
   const x=ax+(bx-ax)*j/3,z=az+(bz-az)*j/3;
   box(fence,post,x,y(x,z)+.48,z,.13,1.15,.13);
   if(j)for(const h of [.36,.76]){
    const px=x-(bx-ax)/3,pz=z-(bz-az)/3;
    beam(fence,wood,new THREE.Vector3(px,y(px,pz)+h,pz),new THREE.Vector3(x,y(x,z)+h,z),.12);
   }
  }
 }
 box(fence,wood,2.35,y(2.35,.4)+.20,.4,.56,.22,1.18);
 finish(fence);
 const pigs=[0,1].map(i=>{
  const pig=new THREE.Group();root.add(pig);
  oval(pig,pink,0,.57,0,.37,.32,.57);oval(pig,pink,0,.53,.52,.27,.25,.31);
  oval(pig,darkPink,0,.47,.76,.157,.113,.097);
  for(const x of [-1,1]){
   oval(pig,darkPink,x*.166,.75,.56,.092,.14,.065).rotation.z=x*.30;
   oval(pig,rubber,x*.152,.63,.678,.024,.025,.022);
   for(const z of [-.28,.28])box(pig,pink,x*.22,.20,z,.116,.38,.126);
  }
  if(i)pig.scale.setScalar(.90);
  return finish(pig);
 });
 return {root,update(time,fed){
  pigs.forEach((pig,i)=>{
   const a=time*.48+i*Math.PI,x=fed?1.83-i*.68:Math.cos(a)*1.9,z=fed?-.43+i*.45:Math.sin(a)*1.19;
   pig.position.set(x,y(x,z),z);pig.rotation.y=fed?.8:Math.atan2(-Math.sin(a)*1.9,Math.cos(a)*1.19);
   pig.rotation.x=fed?.08+Math.sin(time*7+i)*.038:0;
  });
 }};
}
