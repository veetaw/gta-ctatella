import {makeLocalLandmarks} from './local-landmarks.js';
import {drawingCanvas,TEXTURE_ANISOTROPY} from './device-profile.js';
import * as THREE from 'three';
import {createVillagePlan} from './village-plan.js';

export function makeVillageDetails(scene,world,network,photo){
  const pixels=photo.getContext('2d').getImageData(0,0,photo.width,photo.height).data,t=world.terrain;
  const isGreen=(x,z)=>{const px=Math.min(photo.width-1,Math.max(0,Math.floor((x-t.minX)/(t.maxX-t.minX)*photo.width))),py=Math.min(photo.height-1,Math.max(0,Math.floor((z-t.minZ)/(t.maxZ-t.minZ)*photo.height))),i=(py*photo.width+px)*4;return pixels[i+1]>pixels[i]*.99&&pixels[i+1]>pixels[i+2]*1.09&&pixels[i+1]>34&&pixels[i+1]<151;};
  const plan=createVillagePlan(world,network,isGreen),group=new THREE.Group();group.name='Mediterranean village · lighting, signs and greenery';scene.add(group);
  const trunkMaterial=new THREE.MeshStandardMaterial({color:'#75644c',roughness:1}),poleMaterial=new THREE.MeshStandardMaterial({color:'#4a4d43',roughness:.8,metalness:.25}),leafMaterial=new THREE.MeshStandardMaterial({roughness:1,flatShading:true});
  function instances(geometry,material,items,shadow=true){if(!items.length)return;const mesh=new THREE.InstancedMesh(geometry,material,items.length),dummy=new THREE.Object3D(),color=new THREE.Color();items.forEach((item,i)=>{dummy.position.set(...item.p);dummy.scale.set(...item.s);dummy.rotation.set(...(item.r||[0,0,0]));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(item.color)mesh.setColorAt(i,color.set(item.color));});mesh.castShadow=shadow;mesh.receiveShadow=true;group.add(mesh);return mesh;}
  makeVillageLamps(group,plan.lamps);
  const trunks=[],olives=[],pines=[],cypresses=[],bushes=[];
  for(let i=0;i<plan.trees.length;i++){
    const tree=plan.trees[i],{x,z,y,scale:s,species}=tree;
    if(species===0){trunks.push({p:[x,y+1.3*s,z],s:[s,2.6*s,s],r:[.05,0,.1]});for(let j=0;j<5;j++){const a=j*2.399;olives.push({p:[x+Math.cos(a)*.8*s,y+(2.8+(j%2)*.5)*s,z+Math.sin(a)*.8*s],s:[1.45*s,.95*s,1.25*s],r:[0,a,0],color:['#82906a','#74855f','#8e9879'][j%3]});}}
    else if(species===1){trunks.push({p:[x,y+2.1*s,z],s:[1.2*s,4.2*s,1.2*s]});for(let j=0;j<3;j++)pines.push({p:[x+Math.cos(j*2.1)*.75*s,y+(4.1+j*.2)*s,z+Math.sin(j*2.1)*.75*s],s:[2.1*s,.9*s,2*s],r:[0,j,0],color:j%2?'#4e6a3a':'#5d7945'});}
    else if(species===2){trunks.push({p:[x,y+1.2*s,z],s:[.65*s,2.4*s,.65*s]});for(let j=0;j<2;j++)cypresses.push({p:[x,y+(3.2+j*1.4)*s,z],s:[(1-j*.26)*s,(4.9-j)*s,(1-j*.26)*s],r:[0,i,0],color:j?'#435b35':'#4c663b'});}
    else for(let j=0;j<3;j++)bushes.push({p:[x+Math.cos(j*2.1)*.4*s,y+.6*s,z+Math.sin(j*2.1)*.4*s],s:[.8*s,.7*s,.8*s],r:[0,j,0],color:j%2?'#7b8851':'#667d45'});
  }

  instances(new THREE.CylinderGeometry(.12,.2,1,6),trunkMaterial,trunks);const foliage=new THREE.IcosahedronGeometry(1,0);instances(foliage,leafMaterial,olives);instances(foliage,leafMaterial,pines);instances(new THREE.ConeGeometry(.8,1,7),leafMaterial,cypresses);instances(foliage,leafMaterial,bushes);
  const atlas=drawingCanvas(2048,4096);const ctx=atlas.getContext('2d'),slots=new Map();let slot=0;
  function signSlot(text,type){const key=`${type}/${text}`;if(slots.has(key))return slots.get(key);const index=slot++,x=index%8*256,y=Math.floor(index/8)*128;slots.set(key,index);ctx.fillStyle=type==='direction'?'#37647b':type==='warning'?'#d0ad51':'#e4e2d5';ctx.fillRect(x,y,256,128);ctx.strokeStyle=type==='direction'?'#f0ecdb':'#585d51';ctx.lineWidth=5;ctx.strokeRect(x+4,y+4,248,120);
    if(type==='no-entry'){ctx.fillStyle='#b95542';ctx.beginPath();ctx.arc(x+128,y+64,48,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f5edda';ctx.fillRect(x+92,y+55,72,18);}
    else{ctx.fillStyle=type==='direction'?'#faf4df':'#394735';let size=30;ctx.font=`600 ${size}px Arial`;while(ctx.measureText(text).width>192&&size>14){size--;ctx.font=`600 ${size}px Arial`;}ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x+115,y+64);ctx.beginPath();ctx.moveTo(x+225,y+42);ctx.lineTo(x+245,y+64);ctx.lineTo(x+225,y+86);ctx.lineTo(x+225,y+72);ctx.lineTo(x+206,y+72);ctx.lineTo(x+206,y+56);ctx.lineTo(x+225,y+56);ctx.fill();}
    return index;
  }
  const pp=[],uv=[],signPoles=[];
  function plate(sign,text,type,level){const index=signSlot(text,type),width=type==='no-entry'?.52:1.25,height=type==='no-entry'?.52:.38,y=sign.y+2.3+level*.46,yaw=sign.angle,dx=Math.cos(yaw),dz=-Math.sin(yaw);const p=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,v])=>[sign.x+dx*x*width/2,y+v*height/2,sign.z+dz*x*width/2]);const u0=(index%8*256+3)/2048,u1=(index%8*256+253)/2048,v0=1-(Math.floor(index/8)*128+125)/4096,v1=1-(Math.floor(index/8)*128+3)/4096,coords=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];for(const i of [0,1,2,0,2,3]){pp.push(...p[i]);uv.push(...coords[i]);}}
  for(const sign of plan.signs){signPoles.push({p:[sign.x,sign.y+1.45,sign.z],s:[.65,2.9,.65]});if(sign.names.length)sign.names.forEach((n,i)=>plate(sign,n.toLocaleUpperCase('it'),'direction',i));else plate(sign,sign.type==='warning'?'CENTRO':'',sign.type,0);}
  instances(new THREE.CylinderGeometry(.055,.085,1,7),poleMaterial,signPoles,false);
  const texture=new THREE.CanvasTexture(atlas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,TEXTURE_ANISOTROPY);const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));sg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));sg.computeVertexNormals();const material=new THREE.MeshStandardMaterial({map:texture,roughness:.8,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  material.onBeforeCompile=shader=>{shader.vertexShader='attribute vec4 signRect;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = signRect.xy + vMapUv * signRect.zw;\n#endif');};
  const count=pp.length/18,geometry=new THREE.PlaneGeometry(1,1),rects=new Float32Array(count*4),sm=new THREE.InstancedMesh(geometry,material,count),dummy=new THREE.Object3D();
  for(let i=0;i<count;i++){const k=i*18,j=i*12,dx=pp[k+3]-pp[k],dz=pp[k+5]-pp[k+2],width=Math.hypot(dx,dz),height=pp[k+7]-pp[k+1];dummy.position.set((pp[k]+pp[k+6])/2,(pp[k+1]+pp[k+7])/2,(pp[k+2]+pp[k+8])/2);dummy.rotation.set(0,Math.atan2(-dz,dx),0);dummy.scale.set(width,height,1);dummy.updateMatrix();sm.setMatrixAt(i,dummy.matrix);rects.set([uv[j],uv[j+1],uv[j+2]-uv[j],uv[j+5]-uv[j+1]],i*4);}
  geometry.setAttribute('signRect',new THREE.InstancedBufferAttribute(rects,4));sm.name='Instanced street name and direction signs';sm.castShadow=false;group.add(sm);sg.dispose();
  makeLocalLandmarks(scene,world,network);
  group.userData.statistics={lamps:plan.lamps.length,signs:plan.signs.length,trees:plan.trees.length,junctionTrees:plan.trees.filter(t=>t.urban).length};return group;
}

export function makeVillageLamps(group,lamps){
 if(!lamps.length)return;
 const metal=new THREE.MeshStandardMaterial({color:'#4a4d43',roughness:.8,metalness:.25});
 const glass=new THREE.MeshStandardMaterial({color:'#eee5c7',emissive:'#dac894',emissiveIntensity:.18});
 const box=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 const meshes=[new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.085,1,7),metal,lamps.length),
  ...[metal,metal,glass].map(mat=>new THREE.InstancedMesh(box,mat,lamps.length))];
 for(const [i,{x,y,z,nx,nz,height}] of lamps.entries()){
  const yaw=Math.atan2(nx,nz);
  const parts=[[0,height/2,1,height,1],[.32,height-.08,.055,.055,.75],
   [.64,height-.14,.28,.13,.42],[.64,height-.215,.2,.025,.32]];
  parts.forEach(([reach,h,w,t,l],part)=>{
   dummy.position.set(x+nx*reach,y+h,z+nz*reach);
   dummy.rotation.y=yaw;dummy.scale.set(w,t,l);dummy.updateMatrix();
   meshes[part].setMatrixAt(i,dummy.matrix);
  });
 }
 for(const mesh of meshes){mesh.name='Lampioni del paese';mesh.receiveShadow=true;group.add(mesh);}
}
