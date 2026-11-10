import {buildProcessionFigure} from './procession-figures.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {worldLocation} from './game-locations.js';
export const PROCESSION_GPS={lat:40.656598,lon:15.403656},MUNICIPIO_GPS={lat:40.6565631,lon:15.403496},MONUMENT_GPS={lat:40.6565144,lon:15.4036027};
export function processionLocation(origin){const position=worldLocation(origin,PROCESSION_GPS),target=worldLocation(origin,MONUMENT_GPS);return {...position,yaw:Math.atan2(target.x-position.x,target.z-position.z)};}
// Bake the many small sculptural details by material, once at creation.
export function bake(group){group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),buckets=new Map();group.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(g);o.geometry.dispose();});group.clear();for(const [mat,parts] of buckets){const mesh=new THREE.Mesh(mergeGeometries(parts,false),mat);parts.forEach(g=>g.dispose());mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}}
export function makeProcession(scene,{origin,height,figure='gregory'}){
 const location=processionLocation(origin),root=new THREE.Group();root.name='San Gregorio Magno · vara e quattro portatori';root.position.set(location.x,height(location.x,location.z),location.z);root.rotation.y=location.yaw;scene.add(root);
 const material=(color,metalness=0,roughness=.82)=>new THREE.MeshStandardMaterial({color,metalness,roughness,envMap:metalness?(scene.userData.vehicleEnvironment??null):null});
 const m={ivory:material('#eee6cb'),white:material('#faf8f0'),red:material('#c82029'),gold:material('#d8a638',.65,.3),silver:material('#c5d1d8',.85,.2),wood:material('#41271c'),sage:material('#b4cba1'),green:material('#2b6a43'),skin:material('#c79776'),hair:material('#48392e'),black:material('#262724'),yellow:material('#f9c92c'),saffron:material('#e8ad39')};
 const add=(parent,geo,mat,p=[0,0,0])=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(...p);parent.add(mesh);return mesh;};
 const box=(p,s,pos,mat)=>add(p,new THREE.BoxGeometry(...s),mat,pos);
 const oval=(p,s,pos,mat)=>{const o=add(p,new THREE.SphereGeometry(1,10,7),mat,pos);o.scale.set(...s);return o;};
 const rod=(p,a,b,r,mat)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.clone().sub(from),mesh=add(p,new THREE.CylinderGeometry(r,r,d.length(),8),mat,from.add(to).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh;};
 const vara=new THREE.Group();vara.name='Vara · legno, stanghe e imbottiture salvia';root.add(vara);
 box(vara,[1.75,.15,2],[0,1.49,0],m.wood);box(vara,[1.82,.05,2.07],[0,1.59,0],m.gold);box(vara,[1.6,.04,1.85],[0,1.63,0],m.red);
 for(const x of [-.66,.66]){box(vara,[.12,.14,4.65],[x,1.43,0],m.wood);for(const z of [-1.65,1.65]){const pad=add(vara,new THREE.CylinderGeometry(.17,.17,.68,12),m.sage,[x,1.43,z]);pad.rotation.x=Math.PI/2;for(const dz of [-.27,.27]){const band=add(vara,new THREE.TorusGeometry(.172,.018,5,12),m.green,[x,1.43,z+dz]);}}}
 // Dense floral cushion: raised sunflower disks, individual petals, white flowers and leaves.
 for(let i=0;i<19;i++){const x=(i%7-3)*.23,z=.77+Math.floor(i/7)*.12,y=1.74+Math.sin(i*3)*.065;oval(vara,[.17,.055,.12],[x,y-.07,z],m.green);const sunflower=figure==='gregory'&&i%3!==0;for(let k=0;k<(sunflower?9:6);k++){const a=k*Math.PI*2/(sunflower?9:6),petal=oval(vara,[.045,.08,.025],[x+Math.cos(a)*.085,y+Math.sin(a)*.085,z+.045],sunflower?m.yellow:m.white);petal.rotation.z=a-Math.PI/2;}oval(vara,[.052,.052,.026],[x,y,z+.075],sunflower?m.wood:m.gold);}
 const saint=new THREE.Group();saint.name='San Gregorio · triregno, colomba, libro e ferula';saint.position.y=1.65;saint.scale.setScalar(.88);vara.add(saint);
 // Flared alb and red hem; the open cope is a partial conical shell with red lining.
 add(saint,new THREE.CylinderGeometry(.22,.40,1.03,16),m.white,[0,.54,0]);add(saint,new THREE.CylinderGeometry(.39,.41,.12,16),m.red,[0,.085,0]);
 for(const [radius,mat] of [[1,m.ivory],[.975,m.red]]){const cope=add(saint,new THREE.CylinderGeometry(.29*radius,.53*radius,1.13,20,1,true,.66,Math.PI*2-1.32),mat,[0,.64,-.025]);cope.material.side=THREE.DoubleSide;}
 for(const side of [-1,1]){rod(saint,[side*.19,1.19,.20],[side*.34,.12,.42],.025,m.gold);for(let i=0;i<5;i++){oval(saint,[.019,.039,.018],[side*(.22+i*.022),1.04-i*.18,.25+i*.035],m.gold);}rod(saint,[side*.08,.18,.36],[side*.08,.95,.25],.012,m.gold);}
 add(saint,new THREE.TorusGeometry(.43,.025,5,20,Math.PI*2-1.32),m.gold,[0,.09,0]).rotation.x=Math.PI/2;
 oval(saint,[.27,.14,.21],[0,1.15,0],m.ivory);box(saint,[.25,.045,.045],[0,1.13,.25],m.gold);
 oval(saint,[.16,.20,.15],[0,1.4,.015],m.skin);oval(saint,[.115,.10,.055],[0,1.29,.135],m.ivory);for(const x of [-.04,.04])oval(saint,[.055,.018,.025],[x,1.37,.165],m.ivory);oval(saint,[.04,.05,.05],[0,1.41,.166],m.skin);
 for(const x of [-.065,.065])oval(saint,[.014,.012,.015],[x,1.45,.159],m.black);
 oval(saint,[.178,.12,.16],[0,1.55,0],m.gold);
 const tiara=add(saint,new THREE.LatheGeometry([[.17,0],[.185,.07],[.17,.21],[.13,.34],[.06,.43],[0,.46]].map(v=>new THREE.Vector2(...v)),16),m.silver,[0,1.57,0]);
 for(const [y,r] of [[1.63,.18],[1.76,.16],[1.9,.105]]){const ring=add(saint,new THREE.TorusGeometry(r,.024,6,20),m.gold,[0,y,0]);ring.rotation.x=Math.PI/2;for(let k=0;k<8;k++){const a=k*Math.PI/4;oval(saint,[.017,.024,.017],[Math.cos(a)*r,y+.025,Math.sin(a)*r],m.gold);}}
 rod(saint,[0,2.02,0],[0,2.15,0],.012,m.gold);rod(saint,[-.045,2.1,0],[.045,2.1,0],.012,m.gold);
 for(const x of [-.10,.10]){const ribbon=box(saint,[.07,.40,.02],[x,1.42,-.17],m.black);ribbon.rotation.z=x;box(saint,[.075,.025,.023],[x,1.225,-.17],m.gold);}
 // Right hand blesses with two individually raised fingers.
 rod(saint,[-.23,1.06,.02],[-.4,.95,.20],.10,m.ivory);rod(saint,[-.4,.95,.20],[-.44,1.31,.30],.08,m.ivory);oval(saint,[.07,.10,.045],[-.44,1.38,.31],m.skin);
 for(const x of [-.47,-.425])rod(saint,[x,1.4,.32],[x,1.56,.32],.018,m.skin);rod(saint,[-.39,1.36,.32],[-.36,1.42,.35],.02,m.skin);
 rod(saint,[.24,1.04,0],[.32,.9,.26],.1,m.ivory);rod(saint,[.32,.9,.26],[.12,1.02,.39],.065,m.skin);
 const book=new THREE.Group();book.rotation.z=-.18;book.position.set(.14,1.05,.35);saint.add(book);box(book,[.26,.33,.075],[0,0,0],m.gold);box(book,[.245,.315,.085],[0,0,.006],m.red);box(book,[.018,.21,.015],[0,0,.055],m.gold);box(book,[.14,.018,.015],[0,.025,.055],m.gold);
 const ferula=new THREE.Group();ferula.position.set(.29,.82,.30);ferula.rotation.z=-.20;saint.add(ferula);rod(ferula,[0,-.7,0],[0,1.25,0],.018,m.silver);for(const [y,w] of [[.9,.33],[1.05,.25],[1.19,.17]])rod(ferula,[-w/2,y,0],[w/2,y,0],.017,m.gold);
 const dove=new THREE.Group();dove.name='Colomba bianca';dove.position.set(-.25,1.49,.14);saint.add(dove);oval(dove,[.10,.055,.07],[0,0,0],m.white);oval(dove,[.043,.045,.043],[.07,.025,.04],m.white);rod(dove,[.095,.025,.06],[.145,.023,.08],.015,m.gold);for(const side of [-1,1]){const wing=oval(dove,[.15,.026,.08],[side*.11,.085,-.025],m.white);wing.rotation.z=side*.65;}
 if(figure!=='gregory'){buildProcessionFigure(saint,{figure,m,add,oval,rod,box});if(figure==='peter')for(const side of [-1,1]){oval(vara,[.08,.08,.05],[side*.7,1.77,1.03],m.saffron);for(const x of [-1,1]){const bow=add(vara,new THREE.ConeGeometry(.12,.25,3),m.saffron,[side*.7+x*.12,1.77,1.03]);bow.rotation.z=x*Math.PI/2;}}}
 bake(vara);
 // Four shared-geometry bearers, articulated above and below the knee.
 const template=new THREE.Group(),upper=new THREE.Group();template.add(upper);
 const ceremonial=figure==='gregory',shirt=ceremonial?m.white:material('#ffffff'),trousers=ceremonial?m.skin:material('#3c4550');
 upper.name=ceremonial?'Camice, fascia e medaglione':'Portatore in abiti civili';
 add(upper,new THREE.CylinderGeometry(.22,ceremonial?.32:.25,ceremonial?.70:.52,12),shirt,[0,ceremonial?.95:1.04,0]);
 if(ceremonial){
  box(upper,[.52,.085,.37],[0,.96,0],m.saffron);for(const x of [.22,.30])box(upper,[.075,.43,.025],[x,.70,.20],m.saffron);
  const scarf=add(upper,new THREE.ConeGeometry(.28,.26,3),m.saffron,[0,1.30,.06]);scarf.rotation.y=Math.PI;
  oval(upper,[.075,.10,.02],[0,1.18,.263],m.green);oval(upper,[.03,.047,.012],[0,1.18,.286],m.ivory);
 }else{
  box(upper,[.38,.15,.28],[0,.76,0],trousers);
  rod(upper,[-.075,1.25,.15],[0,1.21,.19],.018,m.ivory);
  rod(upper,[.075,1.25,.15],[0,1.21,.19],.018,m.ivory);
 }
 oval(upper,[.077,.087,.073],[0,1.40,0],m.skin);
 oval(upper,[.145,.183,.134],[0,1.60,.012],m.skin);
 oval(upper,[.151,.078,.144],[0,1.737,-.021],m.hair);
 oval(upper,[.040,.042,.04],[0,1.605,.142],m.skin);
 oval(upper,[.043,.009,.012],[0,1.55,.139],m.hair);
 for(const x of [-.06,.06]){
  oval(upper,[.012,.01,.009],[x,1.645,.139],m.black);
  oval(upper,[.024,.007,.008],[x,1.67,.133],m.hair);
  oval(upper,[.027,.046,.023],[x*2.25,1.61,.003],m.skin);
 }
 for(const side of [-1,1]){
  rod(upper,[side*.19,1.25,0],[side*.32,1.05,.06],.072,shirt);
  rod(upper,[side*.32,1.05,.06],[side*.28,1.40,.10],.05,m.skin);oval(upper,[.054,.067,.049],[side*.28,1.40,.10],m.skin);
 }
 bake(upper);
 for(const side of [-1,1]){
  const leg=new THREE.Group();leg.position.set(side*.14,.68,0);template.add(leg);
  rod(leg,[0,0,0],[0,-.54,0],.077,trousers);
  oval(leg,[.084,.055,.151],[0,-.608,.055],ceremonial?m.white:m.black);
  box(leg,[.166,.033,.28],[0,-.652,.055],m.black);bake(leg);
 }
 const bearers=[];for(const x of [-.88,.88])for(const z of [-1.65,1.65]){const b=template.clone(true);b.position.set(x,0,z);b.name=`Portatore ${x<0?'sinistro':'destro'} ${z>0?'anteriore':'posteriore'}`;root.add(b);bearers.push(b);} // Template shares baked buffers between all four clones.
 // Ten instanced batches share every tunic, sash, face and articulated calf.
 const bearerBatches=[];
 for(const mesh of template.children[0].children){const batch=new THREE.InstancedMesh(mesh.geometry,mesh.material,4);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;root.add(batch);if(!ceremonial&&mesh.material===shirt){
  ['#455e73','#7a5744','#4d6750','#66556a'].forEach((color,i)=>batch.setColorAt(i,new THREE.Color(color)));
 }
 bearerBatches.push({batch,part:0});}
 for(const mesh of template.children[1].children){const batch=new THREE.InstancedMesh(mesh.geometry,mesh.material,8);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;root.add(batch);bearerBatches.push({batch,part:1});}
 for(const b of bearers)for(const part of b.children)part.clear();
 const matrix=new THREE.Matrix4(),zero=new THREE.Matrix4().makeScale(0,0,0);
 function updateBearerBatches(){for(const {batch,part} of bearerBatches){bearers.forEach((b,i)=>{b.updateMatrix();const parts=part?b.children.slice(1):[b.children[0]];parts.forEach((p,k)=>{p.updateMatrix();matrix.multiplyMatrices(b.matrix,p.matrix);batch.setMatrixAt(part?i*2+k:i,b.visible?matrix:zero);});});batch.instanceMatrix.needsUpdate=true;}}
 updateBearerBatches();
 const confetti=new THREE.InstancedMesh(new THREE.PlaneGeometry(.045,.07),new THREE.MeshBasicMaterial({vertexColors:false,side:THREE.DoubleSide}),32);confetti.frustumCulled=false;confetti.visible=false;root.add(confetti);const dummy=new THREE.Object3D();for(let i=0;i<32;i++)confetti.setColorAt(i,new THREE.Color(['#eec744','#ffffff','#369861','#d94736'][i%4]));
 let kick=0,wrong=0,burst=-10,time=0,replaced=1;
 function update(dt,walking=false){time+=dt;kick=Math.max(0,kick-dt*3);wrong=Math.max(0,wrong-dt*2);const wave=Math.sin(time*15),bend=kick*.11;vara.position.y=bend;vara.rotation.z=kick*wave*.08+wrong*Math.sin(time*28)*.13;vara.rotation.x=kick*Math.cos(time*13)*.065;
  bearers.forEach(b=>{b.children[0].position.y=-bend*.6;b.children.slice(1).forEach((leg,i)=>leg.rotation.x=kick*wave*(i?-.2:.2)+(walking?Math.sin(time*8+i*Math.PI)*.35:0));});updateBearerBatches();const age=time-burst;confetti.visible=age>=0&&age<1.5;if(confetti.visible){for(let i=0;i<32;i++){const a=i*2.4,speed=.5+(i%7)*.12;dummy.position.set(Math.cos(a)*speed*age,2.6+age*(2+i%3*.2)-2.6*age*age,Math.sin(a)*speed*age);dummy.rotation.set(age*3,a,age*5);dummy.updateMatrix();confetti.setMatrixAt(i,dummy.matrix);}confetti.instanceMatrix.needsUpdate=true;}}
 function bearerPose(index=replaced){const b=bearers[index],v=root.localToWorld(new THREE.Vector3(b.position.x,-kick*.066,b.position.z));return {x:v.x,z:v.z,y:v.y,yaw:root.rotation.y,kick};}
 function closestBearer(x,z){
  let best={index:0,distance:Infinity};
  bearers.forEach((_,index)=>{const p=bearerPose(index),d=Math.hypot(p.x-x,p.z-z);if(d<best.distance)best={index,distance:d};});
  return best;
 }
 return {root,vara,bearers,location,update,bearerPose,closestBearer,react(good){if(good){kick=1;burst=time;}else wrong=1;},replacePlayer(active,index=replaced){bearers[replaced].visible=true;replaced=index;bearers[replaced].visible=!active;updateBearerBatches();},reset(){kick=wrong=0;burst=-10;update(0);}};
}
