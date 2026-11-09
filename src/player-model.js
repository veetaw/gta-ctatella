import * as THREE from 'three';
import {bake} from './procession-model.js';

export function makePerson(scene){
 const root=new THREE.Group();root.name='Ctatella · personaggio';
 const mat=(color,roughness=.87)=>new THREE.MeshStandardMaterial({color,roughness});
 const shirt=mat('#852c43'),rib=mat('#542233'),seam=mat('#a94f61'),denim=mat('#364856'),denimLight=mat('#4b6171'),stitch=mat('#777d78'),skin=mat('#bf8b69'),shade=mat('#a46952'),hair=mat('#302821'),hairLight=mat('#4a382d'),sole=mat('#c4bfb0'),shoe=mat('#252a2b'),trim=mat('#646967'),glasses=mat('#262627',.42),lens=mat('#464c50',.23);
 function mesh(parent,geometry,material,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);parent.add(o);return o;}
 function oval(parent,m,x,y,z,rx,ry,rz,n=12){return mesh(parent,new THREE.SphereGeometry(1,n,8).scale(rx,ry,rz),m,x,y,z);}
 function box(parent,m,x,y,z,w,h,d){return mesh(parent,new THREE.BoxGeometry(w,h,d),m,x,y,z);}
 function loft(parent,m,profile,depth,x=0,y=0,z=0,n=18){const g=new THREE.LatheGeometry(profile.map(([h,r])=>new THREE.Vector2(r,h)),n);g.scale(1,1,depth);return mesh(parent,g,m,x,y,z);}
 function line(parent,m,a,b,r=.004){const v=new THREE.Vector3().fromArray(a),d=new THREE.Vector3().fromArray(b).sub(v);const o=mesh(parent,new THREE.CylinderGeometry(r,r,d.length(),6),m,...v.addScaledVector(d,.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
 const torso=[[.83,0],[.85,.245],[.92,.258],[1.06,.25],[1.22,.28],[1.37,.313],[1.43,.28],[1.47,.148],[1.48,.105]];
 loft(root,shirt,torso,.69);loft(root,rib,[[.845,.246],[.869,.249]],.69);
 loft(root,denim,[[.71,0],[.73,.226],[.82,.255],[.91,.249],[.92,0]],.7);
 loft(root,skin,[[1.41,.091],[1.57,.095],[1.64,.083]],.9,0,0,.012,14);
 const collar=mesh(root,new THREE.TorusGeometry(.109,.013,7,22).rotateX(Math.PI/2).scale(1,1,.87),rib,0,1.465,.021);
 collar.rotation.x=.14;
 loft(root,skin,[[1.52,0],[1.54,.071],[1.57,.108],[1.63,.133],[1.71,.143],[1.8,.141],[1.866,.116],[1.905,.059],[1.918,0]],.96,0,0,.02,24);
 loft(root,hair,[[1.748,.126],[1.80,.144],[1.853,.142],[1.9,.111],[1.928,.056],[1.935,0]],.93,0,0,-.019,24);
 for(let i=0;i<5;i++){const lock=oval(root,i===2?hairLight:hair,-.088+i*.043,1.899-Math.abs(i-2)*.007,.034,.052,.023,.077);lock.rotation.z=-.32;}
 for(const side of [-1,1]){
  oval(root,skin,side*.141,1.706,.013,.027,.047,.027);oval(root,shade,side*.155,1.706,.033,.011,.022,.008,8);
  oval(root,skin,side*.087,1.678,.103,.052,.041,.036);
  box(root,glasses,side*.069,1.738,.147,.118,.052,.018);
  box(root,lens,side*.069,1.738,.158,.097,.035,.009);
  line(root,glasses,[side*.124,1.746,.147],[side*.148,1.73,.001],.006);
  line(root,hair,[side*.025,1.78,.146],[side*.107,1.775,.129],.006);
 }
 box(root,glasses,0,1.747,.158,.035,.009,.012);
 const nose=oval(root,skin,0,1.687,.153,.026,.044,.037);nose.rotation.x=-.22;
 oval(root,shade,0,1.623,.134,.036,.008,.009,12);
 for(const side of [-1,1]){line(root,seam,[side*.26,1.34,-.08],[side*.23,.94,-.087]);line(root,stitch,[side*.102,.88,-.164],[side*.19,.865,-.128]);}
 // Only the print is textured, fitted to the curved cloth without a backing card.
 for(const [text,sign,width] of [['BACCANALIA',1,.50],['ctatella',-1,.44]]){
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#fff5e4';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 78px Arial';ctx.fillText(text,256,64,484);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const g=new THREE.PlaneGeometry(width,.115,14,1),pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i)+1.255,rad=.28+(y-1.22)*.22;pos.setXYZ(i,x*sign,y,sign*(.006+.69*Math.sqrt(Math.max(0,rad*rad-x*x))));}
  g.computeVertexNormals();
  const logo=mesh(root,g,new THREE.MeshStandardMaterial({map:texture,alphaTest:.35,side:THREE.DoubleSide,roughness:1}));logo.name=`Maglia · ${text}`;
 }
 const logoMeshes=root.children.filter(o=>o.name.startsWith('Maglia'));for(const logo of logoMeshes)root.remove(logo);bake(root);root.add(...logoMeshes);
 const legs=[],arms=[];
 for(const side of [-1,1]){
  const leg=new THREE.Group();leg.position.set(side*.143,.82,0);root.add(leg);legs.push(leg);
  loft(leg,denim,[[-.665,0],[-.663,.077],[-.56,.084],[-.36,.097],[-.19,.106],[-.04,.118],[.04,.098],[.055,0]],.89);
  loft(leg,denimLight,[[-.67,.078],[-.633,.082]],.9);
  line(leg,stitch,[side*.114,-.07,-.01],[side*.082,-.64,-.005],.003);
  for(const y of [-.34,-.39,-.56])line(leg,denimLight,[-.057,y,.068],[.051,y+.015,.076],.005);
  oval(leg,sole,0,-.793,.045,.096,.032,.164);
  oval(leg,shoe,0,-.748,.033,.094,.066,.15);
  oval(leg,trim,0,-.757,.124,.087,.042,.065);
  for(let i=0;i<3;i++)line(leg,sole,[-.037,-.699+i*.006,.047-i*.026],[.037,-.699+i*.006,.042-i*.026],.004);
  bake(leg);
  const arm=new THREE.Group();arm.position.set(side*.32,1.4,0);arm.rotation.z=side*.10;root.add(arm);arms.push(arm);
  loft(arm,shirt,[[-.215,0],[-.213,.088],[-.153,.105],[-.06,.119],[.031,.096],[.06,0]],.93,side*.023);
  loft(arm,rib,[[-.214,.091],[-.188,.095]],.93,side*.023);
  loft(arm,skin,[[-.484,.045],[-.418,.053],[-.33,.073],[-.245,.082],[-.194,.077]],.91,side*.052);
  oval(arm,skin,side*.063,-.512,.016,.057,.079,.051);
  oval(arm,skin,side*.026,-.495,.051,.022,.044,.025,9);
  if(side<0){loft(arm,glasses,[[-.479,.051],[-.448,.054]],.93,side*.052);box(arm,trim,side*.052,-.462,.055,.065,.038,.015);}
  bake(arm);
 }
 root.visible=false;scene.add(root);return {root,limbs:[...legs,arms[1],arms[0]],x:0,z:0,yaw:0};
}
