import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {worldLocation} from './game-locations.js';
import {demElevation} from './world-math.js';

export const BACCANALIA_SIGN={lat:40.655282,lon:15.400315};
// Viewing point on Via Cantina Arenara.
const ROAD_VIEW={lat:40.655664,lon:15.4005535};
const glyphs={
 B:[[[0,0],[.48,0],[.64,.07],[.69,.2],[.69,.38],[.61,.49],[.55,.52],[.63,.58],[.65,.7],[.65,.83],[.57,.96],[.45,1],[0,1]],[[.17,.15],[.43,.15],[.52,.21],[.52,.36],[.44,.43],[.17,.43]],[[.17,.58],[.41,.58],[.48,.64],[.48,.79],[.41,.85],[.17,.85]]],
 A:[[[0,0],[.255,1],[.452,1],[.71,0],[.53,0],[.47,.244],[.235,.244],[.177,0]],[[.27,.395],[.433,.395],[.353,.741]]],
 C:[[[.68,.86],[.57,.97],[.45,1],[.19,1],[.06,.93],[0,.79],[0,.2],[.06,.067],[.19,0],[.46,0],[.59,.044],[.68,.148],[.55,.27],[.46,.164],[.245,.164],[.179,.23],[.179,.767],[.245,.836],[.453,.836],[.55,.74]]],
 N:[[[0,0],[.18,0],[.18,.665],[.495,0],[.695,0],[.695,1],[.515,1],[.515,.335],[.20,1],[0,1]]],
 L:[[[0,0],[.62,0],[.62,.17],[.18,.17],[.18,1],[0,1]]],
 I:[[[0,0],[.19,0],[.19,1],[0,1]]],
};
const word='BACCANALIA',letterHeight=5.1,gap=.13;
const widthOf=letter=>Math.max(...glyphs[letter][0].map(([x])=>x));
const totalWidth=[...word].reduce((sum,letter)=>sum+widthOf(letter),0)+(word.length-1)*gap;

export function makeBaccanaliaSign(scene,world){
 const anchor=worldLocation(world.origin,BACCANALIA_SIGN),view=worldLocation(world.origin,ROAD_VIEW);
 const yaw=Math.atan2(view.x-anchor.x,view.z-anchor.z),cos=Math.cos(yaw),sin=Math.sin(yaw);
 const x=anchor.x-sin*6,z=anchor.z-cos*6;
 const ground=(u,v)=>demElevation(world.terrain,x+cos*u+sin*v,z-sin*u+cos*v);
 const base=ground(0,0),faces=[],supports=[];
 const half=totalWidth*letterHeight/2;let crest=base;
 for(let u=-half;u<=half;u+=.5)crest=Math.max(crest,ground(u,0));
 const lower=crest-base+.75;
 function outline(points){return points.map(([a,b])=>new THREE.Vector2(a*letterHeight,b*letterHeight));}
 function beam(a,b,width){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),axis=end.clone().sub(start);
  const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.clone().normalize());
  const g=new THREE.BoxGeometry(width,axis.length(),width);
  g.applyQuaternion(rotation);g.translate(...start.lerp(end,.5).toArray());supports.push(g);
 }
 let cursor=-totalWidth*letterHeight/2;
 for(const letter of word){
  const [outer,...holes]=glyphs[letter],width=widthOf(letter)*letterHeight;
  const shape=new THREE.Shape(outline(outer));
  for(const hole of holes)shape.holes.push(new THREE.Path(outline(hole)));
  const panel=new THREE.ExtrudeGeometry(shape,{depth:.23,steps:1,bevelEnabled:false,curveSegments:1});
  panel.translate(cursor,lower,0);faces.push(panel);
  for(const u of [cursor+width*.22,cursor+width*.78]){
   const foot=ground(u,-.25)-base-.55,rear=ground(u,-1.75)-base-.55;
   beam([u,foot,-.25],[u,lower+letterHeight*.88,-.25],.115);
   beam([u,rear,-1.75],[u,lower+letterHeight*.69,-.25],.095);
  }
  beam([cursor,lower+.55,-.23],[cursor+width,lower+.55,-.23],.095);
  beam([cursor,lower+letterHeight*.68,-.23],[cursor+width,lower+letterHeight*.68,-.23],.095);
  cursor+=width+gap*letterHeight;
 }
 const sign=new THREE.Group();sign.name='BACCANALIA · insegna sulla collina';sign.position.set(x,base,z);sign.rotation.y=yaw;
 const letters=new THREE.Mesh(mergeGeometries(faces),new THREE.MeshStandardMaterial({color:'#fff9eb',roughness:.8,emissive:'#e9dccc',emissiveIntensity:.16}));
 const frame=new THREE.Mesh(mergeGeometries(supports),new THREE.MeshStandardMaterial({color:'#535753',roughness:.86}));
 faces.forEach(g=>g.dispose());supports.forEach(g=>g.dispose());letters.castShadow=true;sign.add(letters,frame);scene.add(sign);return sign;
}
