import * as THREE from 'three';
import {drawingCanvas,TEXTURE_ANISOTROPY} from './device-profile.js';
// Two shared facade panels: portal and high grille are painted together.
// No separate residential window meshes and no texture per building.
export function baccoFacadeMaterial(){
 const c=drawingCanvas(2048,512),g=c.getContext('2d');
 for(let variant=0;variant<2;variant++){
 g.save();g.translate(variant*1024,0);g.scale(128,512/3.5);const y=v=>3.5-v,center=4;
 const arch=(half,spring,rise)=>{g.beginPath();g.moveTo(center-half,y(0));g.lineTo(center-half,y(spring));g.quadraticCurveTo(center,y(spring+2*rise),center+half,y(spring));g.lineTo(center+half,y(0));g.closePath();};
 arch(1.075,1.9,.35);g.fillStyle='#777264';g.fill();
 for(const side of [-1,1])for(let row=0;row<6;row++){g.fillStyle=row%2?'#c1b9a6':'#aaa38f';g.fillRect(center+side*(side<0?1.075:.87),y((row+1)*.31),.205,.295);}
 for(let i=0;i<12;i++){const a=-1+2*i/12,b=-1+2*(i+1)/12;g.beginPath();g.moveTo(center+a*1.075,y(1.9+.35*(1-a*a)));g.lineTo(center+b*1.075,y(1.9+.35*(1-b*b)));g.lineTo(center+b*.87,y(1.84+.25*(1-b*b)));g.lineTo(center+a*.87,y(1.84+.25*(1-a*a)));g.closePath();g.fillStyle=i%3?'#bbb3a0':'#cbc2ad';g.fill();g.strokeStyle='#655f52';g.lineWidth=.012;g.stroke();}
 arch(.87,1.84,.25);g.save();g.clip();g.fillStyle=variant?'#343736':'#3b291d';g.fill();
 for(let x=center-.87;x<center+.87;x+=.14){g.fillStyle=variant?'#ffffff0c':'#9a724122';g.fillRect(x+.013,y(2.2),.115,2.2);g.strokeStyle='#151a18';g.lineWidth=.015;g.beginPath();g.moveTo(x,y(0));g.lineTo(x,y(2.2));g.stroke();}
 for(const h of [.45,1.35]){g.fillStyle='#20221f';g.fillRect(center-.82,y(h),1.64,.05);}g.fillStyle='#a18b5e';for(const x of [center-.07,center+.07])g.fillRect(x,y(1.03),.025,.13);g.restore();
 g.fillStyle='#b7af9b';g.fillRect(center-.36,y(2.58),.72,.28);g.fillStyle='#202b2a';g.fillRect(center-.28,y(2.53),.56,.18);g.strokeStyle='#42473f';g.lineWidth=.024;for(const x of [-.2,-.1,0,.1,.2]){g.beginPath();g.moveTo(center+x,y(2.35));g.lineTo(center+x,y(2.53));g.stroke();}g.beginPath();g.moveTo(center-.28,y(2.44));g.lineTo(center+.28,y(2.44));g.stroke();g.restore();
 }
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=TEXTURE_ANISOTROPY;return new THREE.MeshStandardMaterial({map,transparent:true,alphaTest:.35,roughness:.98,side:THREE.DoubleSide});
}
export function addBaccoLantern(parent,f,roof){
 const iron=new THREE.MeshStandardMaterial({color:'#292c27',roughness:.8}),warm=new THREE.MeshStandardMaterial({color:'#d8bd82',emissive:'#b87b32',emissiveIntensity:.35,roughness:.5}),x=Math.min(f.width/2-.13,f.doorWidth/2+.25),height=Math.min(f.floorY+2.35,roof.heightAt(f.center)-.15);
 const at=(u,y,d)=>new THREE.Vector3(f.center[0]+f.dx*u+f.nx*d,y,f.center[1]+f.dz*u+f.nz*d);
 function rod(a,b,r=.018){const delta=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),5),iron);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(m);}
 rod(at(x,height-.28,.025),at(x,height+.1,.025),.035);let previous=at(x,height-.12,.04);for(let i=1;i<=8;i++){const t=i/8,p=at(x,height-.12+.28*Math.sin(t*Math.PI/1.8),.04+t*.55);rod(previous,p);previous=p;}
 const center=at(x,height-.05,.58),bulb=new THREE.Mesh(new THREE.BoxGeometry(.14,.22,.14),warm);bulb.position.copy(center);parent.add(bulb);for(const h of [-.14,.14]){const cap=new THREE.Mesh(new THREE.ConeGeometry(.17,.10,4),iron);cap.position.copy(center);cap.position.y+=h;parent.add(cap);}for(const u of [-.085,.085])for(const d of [-.085,.085])rod(at(x+u,center.y-.14,.58+d),at(x+u,center.y+.14,.58+d),.012);
}
