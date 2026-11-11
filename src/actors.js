import {registerVehicleVisual} from './vehicle-visuals.js';
import {bake} from './procession-model.js';
import {buildPuntoBody} from './punto-body.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {wheelPose,elevation} from './world-math.js';
import {VEHICLES} from './vehicle-physics.js';
function box(parent,size,pos,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);m.castShadow=true;parent.add(m);return m;}
export function makeCar(scene,id='panda',color,{convertible=false}={}){
 const spec=VEHICLES[id],panda=id==='panda',punto=id==='punto',corvette=id==='corvette',rambo=id==='rambo',bike=id==='motocross',root=new THREE.Group(),body=new THREE.Group();root.name=spec.label;root.add(body);scene.add(root);
 const paint=new THREE.MeshStandardMaterial({color:color??(panda?'#d3d1b2':punto?'#235b94':rambo?'#b72824':'#d91519'),metalness:panda?.16:punto?.65:.4,roughness:panda?.36:punto?.23:.2,envMapIntensity:1.15}),black=new THREE.MeshStandardMaterial({color:'#212724',roughness:.88}),glass=new THREE.MeshStandardMaterial({color:'#344d58',metalness:.32,roughness:.08,envMapIntensity:1.7}),metal=new THREE.MeshStandardMaterial({color:'#b3b6ad',metalness:.78,roughness:.28}),light=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.34,emissive:'#5c4631',emissiveIntensity:.12});
 for(const mat of [paint,glass,metal]){mat.envMap=scene.userData.vehicleEnvironment??null;}
 const brakeMat=new THREE.MeshStandardMaterial({color:'#b92416',emissive:'#ff1706',emissiveIntensity:.15,roughness:.28});
 const add=(size,p,mat=paint)=>box(body,size,p,mat);
 function profile(width,points,mat){const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(-z,y):shape.moveTo(-z,y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,steps:1});g.rotateY(Math.PI/2);g.translate(-width/2,0,0);const m=new THREE.Mesh(g,mat);body.add(m);return m;}

 function colored(size,p,color){const m=add(size,p,light),a=m.geometry.attributes.position,mcolors=new Float32Array(a.count*3),c=new THREE.Color(color);for(let i=0;i<a.count;i++)c.toArray(mcolors,i*3);m.geometry.setAttribute('color',new THREE.BufferAttribute(mcolors,3));return m;}
 function cylinder(radius,length,p,mat=metal,axis='z',segments=10){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,segments),mat);if(axis==='z')m.rotation.x=Math.PI/2;else if(axis==='x')m.rotation.z=Math.PI/2;m.position.set(...p);body.add(m);return m;}
 let rider;
 if(id==='armored'){
  profile(2.18,[[-2.5,.08],[-2.5,1.06],[-1.62,1.55],[.79,1.55],[1.56,.98],[2.49,.6],[2.49,.06]],paint);
  add([1.78,.20,.08],[0,1.11,1.25],black).rotation.x=-.65;
  add([.82,.085,.67],[0,1.60,-.38],black);
  for(const x of [-1.1,1.1]){
   add([.10,.32,1.93],[x,.82,-.47]);
   add([.035,.18,1.31],[x*1.06,1.13,-.52],black);
   colored([.26,.16,.05],[x*.76,.42,2.49],'#eee5cc');
   colored([.18,.14,.05],[x*.78,.40,-2.52],'#bf3428');
  }
 }else if(id==='tank'){
  profile(2.35,[[-2.96,-.08],[-2.89,.84],[1.87,.84],[3.0,.36],[2.96,-.08]],paint);
  profile(1.84,[[-1.54,.88],[-1.23,1.60],[.45,1.60],[1.2,1.15],[1.2,.88]],paint);
  cylinder(.12,1.55,[0,1.24,1.91],paint);
  cylinder(.18,.28,[0,1.24,2.66],black);
  add([.72,.09,.70],[.30,1.64,-.35],black);
  for(const x of [-1.24,1.24]){
   profile(.45,[[-2.79,-.42],[-2.96,-.12],[-2.58,.46],[2.52,.46],[2.95,.06],[2.7,-.42]],black).position.x=x;
   for(let z=-2.45;z<=2.5;z+=.31)add([.46,.055,.085],[x,-.38,z],metal);
   for(let z=-2.36;z<=2.4;z+=.78)cylinder(.31,.035,[x*1.19,-.06,z],paint,'x');
   add([.52,.14,5.36],[x,.48,0]);
  }
 }else if(bike){
  profile(.23,[[-.69,.28],[-.37,.34],[.40,.31],[.36,.11],[-.29,.03]],paint);
  add([.27,.13,.65],[0,.38,-.21],black);add([.27,.11,.42],[0,.39,.17]);
  add([.19,.21,.23],[0,.07,.11],metal);
  for(const x of [-.10,.10]){
   add([.065,.57,.066],[x,.23,.64],metal).rotation.x=-.32;
   add([.06,.07,.66],[x,.09,-.42],metal).rotation.x=.17;
  }
  add([.74,.045,.062],[0,.50,.44],black);
  add([.22,.065,.48],[0,.35,.77]);add([.22,.065,.41],[0,.32,-.77]);
  add([.064,.073,.55],[.14,.23,-.45],metal);
  colored([.14,.14,.036],[0,.38,.62],'#f7eddf');
  rider=new THREE.Group();root.add(rider);rider.visible=false;
  const jacket=new THREE.MeshStandardMaterial({color:'#6d2441'}),helmet=new THREE.MeshStandardMaterial({color:'#e7e4da'});
  box(rider,[.36,.44,.21],[0,.68,-.13],jacket).rotation.x=.44;
  box(rider,[.23,.24,.25],[0,1,.02],helmet);
  box(rider,[.22,.075,.042],[0,1,.15],black);
  for(const x of [-.19,.19]){
   box(rider,[.11,.12,.44],[x,.35,-.01],black).rotation.x=.32;
   box(rider,[.11,.28,.11],[x,.23,.13],black).rotation.x=-.62;
   box(rider,[.095,.10,.43],[x*1.28,.60,.23],jacket).rotation.x=.34;
  }
  bake(rider);
 }else if(id==='ape'){
  add([1.26,.23,2.54],[0,.16,0]);add([1.15,.57,1.05],[0,.43,.65]);add([1.08,.50,.88],[0,.93,.64],glass);add([1.18,.09,1.01],[0,1.22,.61]);
  add([1.23,.09,1.32],[0,.29,-.59],metal);add([1.26,.27,.08],[0,.45,-1.27]);add([.26,.20,.05],[0,.49,1.19],metal);
  for(const x of [-.59,.59]){add([.08,.25,1.28],[x,.45,-.58]);colored([.13,.08,.03],[x,.41,-1.32],'#ca2d20');}
 }else if(id==='offroad'){
  add([1.79,.53,4.08],[0,.30,0]);add([1.64,.59,2.45],[0,.85,-.38],glass);add([1.76,.13,2.53],[0,1.18,-.4]);add([1.71,.14,1.25],[0,.62,1.36]);
  for(const x of [-.86,.86]){for(const z of [-1.59,-.62,.30,.84])add([.065,.63,.085],[x,.85,z]);for(const z of [-1.25,1.25])add([.14,.16,.92],[x,.41,z],black);colored([.26,.17,.045],[x*.80,.54,2.06],'#fff3cb');colored([.18,.16,.04],[x*.85,.51,-2.06],'#c9271a');}
  for(const z of [-2.04,2.04])add([1.84,.22,.15],[0,.16,z],black);
  add([.81,.23,.05],[0,.49,2.06],black);cylinder(.34,.18,[0,.79,-2.14],black);
 }else if(panda){
  add([1.45,.61,3.28],[0,.32,0]);add([1.38,.18,.85],[0,.72,1.12]);add([1.32,.68,1.95],[0,.97,-.22],glass);add([1.40,.12,2.02],[0,1.34,-.25]);
  for(const x of [-.69,.69]){for(const z of [-1.15,.20,.78])add([.065,.73,.08],[x,.97,z]);add([.10,.30,3.06],[x,.15,0],black);add([.08,.10,1.8],[x,.81,-.22]);add([.13,.06,.20],[x*1.07,.82,-.1],black);add([.17,.13,.27],[x*1.14,1.02,.72],black);}
  for(const z of [-1.68,1.68]){add([1.50,.22,.16],[0,.13,z],black);colored([.43,.105,.021],[0,.31,z*1.015],'#f1eee1');colored([.035,.105,.023],[-.18,.31,z*1.016],'#2055a4');}
  add([.72,.20,.04],[-.03,.56,1.66],black);for(let i=0;i<5;i++)add([.025,.17,.045],[-.32+i*.105,.56,1.68],metal);
  for(const x of [-.53,.53]){colored([.31,.23,.035],[x,.60,1.66],'#e9e5c8');add([.12,.38,.045],[x,.69,-1.66],brakeMat);colored([.13,.07,.046],[x,.70,-1.69],'#ddb879');}
  for(const x of [-.55,.55]){add([.055,.12,1.7],[x,1.45,-.25],black);add([.045,.08,1.85],[x,1.61,-.25],metal);}for(const z of [-1,-.4,.2,.5])add([1.18,.055,.055],[0,1.59,z],black);
 }else if(punto){buildPuntoBody({body,paint,black,glass,metal,light,brakeMat,add,profile,colored,cylinder});
 }else if(rambo){
  // Short cab over the front axle, narrow articulation and open steel bed.
  add([.7,.22,.8],[0,.04,.10],black);
  cylinder(.16,.18,[0,.11,.08],metal,'y');
  add([1.37,.24,1.57],[0,.25,1.06]);
  add([1.39,.46,.75],[0,.52,1.48]);
  profile(1.23,[[.46,.52],[1.65,.52],[1.48,1.43],[.54,1.43]],glass);
  add([1.34,.10,1.09],[0,1.48,1.00]);
  for(const x of [-.645,.645]){
   const pillar=add([.058,.93,.06],[x,.99,1.56]);pillar.rotation.x=-.18;
   add([.058,.94,.06],[x,.99,.52]);
   add([.055,.82,.045],[x,.98,.99]);
   add([.16,.12,.19],[x*1.20,1.12,1.38],black);
   add([.12,.09,1.02],[x,.58,1.04]);
   add([.17,.11,.72],[x*1.05,.37,1.11],black);
   add([.06,.33,2.01],[x*1.1,.63,-.91]);
   add([.079,.042,2.02],[x*1.1,.81,-.91],metal);
   colored([.24,.15,.045],[x*.77,.52,1.867],'#f3e9c9');
   add([.20,.10,.04],[x*.82,.31,-1.951],brakeMat);
  }
  add([1.43,.12,2.01],[0,.42,-.91],black);
  add([1.43,.33,.07],[0,.63,-1.91]);
  add([1.44,.042,.079],[0,.81,-1.94],metal);
  add([1.43,.32,.06],[0,.63,.09]);
  add([1.43,.14,.16],[0,.23,1.84],black);
  add([.54,.18,.045],[0,.52,1.871],black);
  for(const y of [.46,.52,.58])add([.48,.02,.02],[0,y,1.90],metal);
 }else{
  if(corvette){
   profile(1.91,[[-2.14,-.03],[2.14,-.03],[2.14,.24],[1.37,.43],[.34,.52],[-.66,.46],[-1.58,.55],[-2.14,.45]],paint);
   add([1.55,.17,.08],[0,.24,-2.17],black);
   for(const x of [-.58,.58]){
    colored([.42,.053,.02],[x,.41,-2.22],'#ff3024');
    colored([.39,.05,.025],[x,.303,2.16],'#f3f1d7');
    add([.13,.12,1.45],[x*1.58,.11,-.23],black);
   }
  }else profile(1.91,[[-2.14,-.03],[2.14,-.03],[2.14,.30],[.65,.49],[-.65,.51],[-2.14,.48]],paint);
  if(convertible){
   paint.metalness=.64;paint.roughness=.25;
   paint.emissive.set('#af650d');paint.emissiveIntensity=.19;
   const windshield=add([1.42,.39,.068],[0,.69,.54],glass);windshield.rotation.x=-.32;
   add([1.48,.045,.084],[0,.88,.48],metal);
   add([1.28,.04,.92],[0,.523,-.12],black);
   for(const x of [-.34,.34]){
    add([.34,.09,.44],[x,.59,-.19],black);
    add([.32,.38,.12],[x,.72,-.39],black).rotation.x=.18;
    add([.20,.15,.13],[x,.91,-.42],black);
   }
   for(const x of [-.91,.91])add([.15,.10,.21],[x,.66,.46],paint);
  }else{
  profile(1.55,[[-1.12,.46],[.88,.45],[.24,.86],[-.65,.86]],glass);add([1.38,.09,1.33],[0,.90,-.24]);for(const x of [-.76,.76]){const p=add([.065,.49,.065],[x,.64,.66]);p.rotation.x=-.38;add([.075,.40,.075],[x,.64,-.94]);add([.17,.10,.30],[x*1.28,.64,.58]);add([.08,.12,1.8],[x*1.22,.29,-.1],black);add([.045,.24,.7],[x*1.26,.30,-.69],black);for(let k=0;k<4;k++)add([.05,.025,.5],[x*1.28,.22+k*.055,-.7]);}
  }
  add([1.99,.08,.34],[0,-.025,2.08],black);add([1.72,.14,.15],[0,.19,2.16],black);add([1.88,.15,.31],[0,-.025,-2.10],black);for(const x of [-.65,-.32,.32,.65])add([.045,.18,.33],[x,-.04,-2.12],black);
  for(const x of [-.67,.67]){const l=colored([.44,.07,.05],[x,.255,2.13],'#f8edca');l.rotation.z=-Math.sign(x)*.12;for(const dx of [-.13,.13])cylinder(.09,.045,[x+dx,.39,-2.16],brakeMat);for(const dx of [-.10,.10])cylinder(.065,.21,[x+dx,.02,-2.22]);}
  colored([.45,.12,.025],[0,.23,-2.175],'#e9e5da');colored([.10,.12,.027],[-.18,.23,-2.18],'#2855a1');colored([.085,.10,.022],[0,.51,1.25],'#dfb422');
 }
 // Italian plates are actual canvas glyphs, baked into the common light atlas.
 if(!bike&&id!=='tank'&&id!=='armored'){const plateCanvas=document.createElement('canvas');plateCanvas.width=256;plateCanvas.height=64;const ctx=plateCanvas.getContext('2d');ctx.fillStyle='#eeeddf';ctx.fillRect(0,0,256,64);ctx.fillStyle='#244c8a';ctx.fillRect(0,0,22,64);ctx.fillRect(234,0,22,64);ctx.fillStyle='#262c2c';ctx.font='bold 39px monospace';ctx.textAlign='center';ctx.fillText(panda?'ZA 1984 SG':punto?'AZ 176 SG':rambo?'SG 404 RX':'FE 812 SG',128,46);const plateTex=new THREE.CanvasTexture(plateCanvas);plateTex.colorSpace=THREE.SRGBColorSpace;const plateMat=new THREE.MeshStandardMaterial({map:plateTex,roughness:.7});const plate=add([.43,.11,.012],[0,panda?.31:punto?.40:rambo?.43:.23,id==='ape'||id==='offroad'?-spec.length/2:panda?-1.72:punto?-1.926:rambo?-1.978:-2.19],plateMat);plate.rotation.y=Math.PI;}
 // Merge the body by material; wheel instances stay independently articulated.
 body.updateMatrixWorld(true);const buckets=new Map();for(const m of [...body.children]){const key=m.material.uuid;if(!buckets.has(key))buckets.set(key,{mat:m.material,parts:[]});const original=m.geometry;const g=(original.index?original.toNonIndexed():original.clone()).applyMatrix4(m.matrix);buckets.get(key).parts.push(g);body.remove(m);m.geometry.dispose();}
 for(const b of buckets.values()){const geo=mergeGeometries(b.parts,false),m=new THREE.Mesh(geo,b.mat);for(const g of b.parts)g.dispose();m.castShadow=b.mat===paint;m.receiveShadow=true;body.add(m);}
 const tireGeo=new THREE.CylinderGeometry(spec.radius,spec.radius,bike?.115:panda?.16:punto?.185:rambo?.235:.25,20).rotateZ(Math.PI/2),tire=new THREE.InstancedMesh(tireGeo,black,4),rimParts=[new THREE.CylinderGeometry(spec.radius*.55,spec.radius*.55,bike?.125:panda?.175:punto?.20:rambo?.25:.265,12).rotateZ(Math.PI/2)];
 if(!panda)for(let k=0;k<(punto?10:5);k++){const a=k*Math.PI*2/(punto?10:5),g=new THREE.BoxGeometry(bike?.125:punto?.20:rambo?.26:.275,punto?.022:.045,spec.radius*1.45);g.rotateX(a);rimParts.push(g);}
 const rims=new THREE.InstancedMesh(mergeGeometries(rimParts,false),metal,4);for(const g of rimParts)g.dispose();if(id!=='tank')root.add(tire,rims);tire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);rims.instanceMatrix.setUsage(THREE.DynamicDrawUsage);tire.frustumCulled=rims.frustumCulled=false;
 // Calipers are stationary relative to the chassis, behind the rotating stars.
 if(!panda&&!bike&&id!=='tank'&&id!=='armored'){const parts=[];for(const x of [-spec.track/2,spec.track/2])for(const z of [-spec.wheelbase/2,spec.wheelbase/2])parts.push(new THREE.BoxGeometry(.07,.17,.11).translate(x,.02,z+.14));const m=new THREE.Mesh(mergeGeometries(parts,false),new THREE.MeshStandardMaterial({color:'#dbb528',roughness:.5}));for(const g of parts)g.dispose();body.add(m);}
 return registerVehicleVisual({spec,root,body,rider,brakeMat,integrity:100,throttle:0,braking:false,wheels:[tire,rims],x:0,z:0,yaw:0,speed:0,spin:0,steer:0});
}
const dummy=new THREE.Object3D();
export function updateCar(car,t,dt){const pose=wheelPose(t,car.x,car.z,car.yaw,car.spec);if(car.spec.id==='tank'&&car.crushHop>0){
 const phase=1-car.crushHop/.85;
 const lift=Math.sin(Math.PI*phase);
 pose.y+=1.35*lift;
 pose.pitch-=.2*Math.sin(2*Math.PI*phase);
 car.crushHop=Math.max(0,car.crushHop-dt);
 }car.root.position.set(car.x,pose.y,car.z);const bike=car.spec.id==='motocross',lean=bike?THREE.MathUtils.lerp(car.root.rotation.z,-car.steer*Math.min(.32,Math.abs(car.speed)*.025),dt?1-Math.exp(-dt*8):1):0;car.root.rotation.set(0,car.yaw,lean,'YXZ');const softness=car.spec.id==='panda'?8:22,alpha=dt?1-Math.exp(-dt*softness):1;car.body.rotation.set(THREE.MathUtils.lerp(car.body.rotation.x,pose.pitch,alpha),0,THREE.MathUtils.lerp(car.body.rotation.z,pose.roll,alpha),'YXZ');car.spin+=car.speed*dt/car.spec.radius;pose.points.forEach((p,i)=>{const centered=bike||car.spec.id==='ape'&&p.f>0;dummy.position.set(centered?0:p.r,p.y-pose.y,p.f);dummy.scale.setScalar(centered&&p.r>0?0:1);dummy.rotation.set(pose.pitch,(p.f>0?car.steer*car.spec.turn:0),pose.roll,'YXZ');dummy.rotateX(car.spin);dummy.updateMatrix();for(const mesh of car.wheels)mesh.setMatrixAt(i,dummy.matrix);});for(const m of car.wheels)m.instanceMatrix.needsUpdate=true;
 car.body.position.y=0;car.root.updateMatrixWorld(true);let lift=0;for(const x of [-car.spec.width*.4,0,car.spec.width*.4])for(const z of [-car.spec.length*.4,0,car.spec.length*.4]){const p=new THREE.Vector3(x,-.12,z).applyMatrix4(car.body.matrixWorld);lift=Math.max(lift,elevation(t,p.x,p.z)+.04-p.y);}car.body.position.y=lift;car.visualPose=pose;car.visualUpdate?.(pose);return pose;}
export {makePerson} from './player-model.js';

export function makePoliceEscort(scene,patrolIndex){
 const patrol=patrolIndex!==undefined,strip=patrol?'#b32332':'#194993';
 const vehicle=makeCar(scene,'punto',patrol?'#19283e':'#efefdf');
 vehicle.spec={...vehicle.spec,id:patrol?'carabinieri-'+patrolIndex:'polizia-locale',label:patrol?'Carabinieri':'Polizia Locale'};
 vehicle.root.name=vehicle.spec.label;vehicle.root.visible=false;vehicle.speed=1.05;
 const blue=new THREE.MeshStandardMaterial({color:strip,roughness:.5});
 for(const side of [-1,1]){
  box(vehicle.body,[.028,.14,1.65],[side*.807,.42,.10],blue);
  const label=document.createElement('canvas');label.width=256;label.height=48;
  const ctx=label.getContext('2d');ctx.fillStyle=strip;ctx.fillRect(0,0,256,48);
  ctx.fillStyle='#fff';ctx.font='bold 26px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(patrol?'CARABINIERI':'POLIZIA LOCALE',128,25);
  const map=new THREE.CanvasTexture(label);map.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.35,.17),new THREE.MeshBasicMaterial({map}));
  sign.position.set(side*.826,.425,.10);sign.rotation.y=side*Math.PI/2;vehicle.body.add(sign);
 }
 box(vehicle.body,[.97,.055,.23],[0,1.24,-.23],blue);
 const lights=[-.28,.28].map(x=>{
  const material=new THREE.MeshStandardMaterial({color:'#227de3',emissive:'#006fff'});
  box(vehicle.body,[.35,.11,.22],[x,1.32,-.23],material);
  return material;
 });
 return {vehicle,update(p,t,dt,elapsed){
  vehicle.root.visible=!!p;if(!p)return;
  Object.assign(vehicle,p);
  updateCar(vehicle,t,dt);
  const side=Math.floor(elapsed*4)%2;
  lights.forEach((m,i)=>{m.emissiveIntensity=i===side?2.5:.35;});
 }};
}
