import {drawingCanvas,TEXTURE_ANISOTROPY} from './device-profile.js';
import * as THREE from 'three';
export const PLASTER=['#d5b77d','#e6d3a4','#d4c2a0','#b5b0a0','#cfb78c','#d6cbb6','#c6b79e'];
const TILE=256,COLS=8;
export function createFacadeMaterial(){
  const atlas=drawingCanvas(2048),mask=drawingCanvas(2048);const ctx=atlas.getContext('2d'),mg=mask.getContext('2d');const slots=new Map();let count=0;
  for(let palette=0;palette<7;palette++)for(const type of ['blank','door','garage','cellar','green','brown','roller','arch','balcony']){
    const slot=count++,tx=(slot%COLS)*TILE,ty=Math.floor(slot/COLS)*TILE;slots.set(`${palette}/${type}`,slot);ctx.save();mg.save();ctx.translate(tx,ty);mg.translate(tx,ty);ctx.beginPath();ctx.rect(0,0,TILE,TILE);ctx.clip();mg.fillStyle='#000';mg.fillRect(0,0,TILE,TILE);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,TILE,TILE);
    let seed=(slot+1)*731;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<2600;i++){ctx.fillStyle=i%2?'#fff1':'#6a5e4910';ctx.fillRect(random()*TILE,random()*TILE,1+random()*2,1+random()*2);}
    const px=x=>x/5*TILE,py=y=>TILE-y/3.2*TILE;
    function opening(x,y,width,height,arched=false){const left=px(x-width/2),top=py(y+height),w=px(width),h=height/3.2*TILE;ctx.fillStyle='#e5d5b8';ctx.fillRect(left-4,top-5,w+8,h+10);ctx.fillStyle='#4c4940';ctx.fillRect(left-1,top-1,w+2,h+2);mg.fillStyle='#fff';mg.fillRect(left-5,top-6,w+10,h+12);if(arched){ctx.fillStyle='#dfcfad';ctx.beginPath();ctx.ellipse(left+w/2,top,w/2+4,9,0,Math.PI,0);ctx.fill();ctx.fillStyle='#364447';ctx.beginPath();ctx.ellipse(left+w/2,top+2,w/2,7,0,Math.PI,0);ctx.fill();}return {left,top,w,h};}
    if(type==='door'||type==='garage'){
      const p=opening(2.5,.04,type==='garage'?2.55:1.2,type==='garage'?2.35:2.65,type==='door');ctx.fillStyle=type==='garage'?(palette%2?'#6e6a5c':'#75604b'):'#534333';ctx.fillRect(p.left,p.top,p.w,p.h);ctx.strokeStyle='#302c2599';ctx.lineWidth=1;
      for(let x=p.left+3;x<p.left+p.w;x+=type==='garage'?8:12){ctx.beginPath();ctx.moveTo(x,p.top);ctx.lineTo(x,p.top+p.h);ctx.stroke();}if(type==='door'){ctx.strokeStyle='#aa8b5e88';ctx.strokeRect(p.left+5,p.top+7,p.w/2-8,p.h-15);ctx.strokeRect(p.left+p.w/2+3,p.top+7,p.w/2-8,p.h-15);ctx.fillStyle='#b89c68';ctx.fillRect(p.left+p.w*.47,p.top+p.h*.54,2,6);}else{ctx.fillStyle='#352f29';ctx.fillRect(p.left+p.w/2,p.top,2,p.h);}
    }else if(type==='cellar'){
      const p=opening(2.5,1.12,1.35,.73,palette%2===0);ctx.fillStyle='#475151';ctx.fillRect(p.left,p.top,p.w,p.h);ctx.strokeStyle='#252f2b';ctx.lineWidth=2;for(let x=p.left+5;x<p.left+p.w;x+=7){ctx.beginPath();ctx.moveTo(x,p.top);ctx.lineTo(x,p.top+p.h);ctx.stroke();}
    }else if(type!=='blank'){
      const balcony=type==='balcony',p=opening(2.5,balcony?.08:.93,1.14,balcony?2.55:1.5,type==='arch'||(palette%3===0&&type==='balcony'));
      ctx.fillStyle='#3a4e51';ctx.fillRect(p.left,p.top,p.w,p.h);ctx.fillStyle='#8faaa8';ctx.fillRect(p.left+4,p.top+4,p.w*.42-4,p.h*.43);ctx.fillStyle='#667f80';ctx.fillRect(p.left+p.w*.52,p.top+4,p.w*.42-3,p.h*.43);ctx.fillStyle='#d7c5a4';ctx.fillRect(p.left+p.w*.48,p.top,3,p.h);ctx.fillRect(p.left,p.top+p.h*.5,p.w,3);
      if(['green','brown','balcony'].includes(type)){ctx.fillStyle=type==='brown'||palette%3===1?'#655244':'#445a49';for(const x of [p.left-16,p.left+p.w+3]){ctx.fillRect(x,p.top,13,p.h);ctx.fillStyle='#26362c88';for(let y=p.top+4;y<p.top+p.h;y+=5)ctx.fillRect(x+1,y,11,1);ctx.fillStyle=type==='brown'||palette%3===1?'#655244':'#445a49';}}
      if(type==='roller'){ctx.fillStyle='#c5bda9';ctx.fillRect(p.left,p.top,p.w,p.h*.38);ctx.strokeStyle='#8f8c7d';for(let y=p.top+3;y<p.top+p.h*.38;y+=4){ctx.beginPath();ctx.moveTo(p.left,y);ctx.lineTo(p.left+p.w,y);ctx.stroke();}}
      if(type==='arch'){ctx.strokeStyle='#354039';ctx.lineWidth=1.5;ctx.strokeRect(p.left-3,p.top+p.h*.7,p.w+6,p.h*.3);for(let x=p.left;x<p.left+p.w;x+=7){ctx.beginPath();ctx.moveTo(x,p.top+p.h*.7);ctx.lineTo(x,p.top+p.h);ctx.stroke();}}
      ctx.fillStyle='#eee0c3';ctx.fillRect(p.left-4,p.top+p.h+2,p.w+8,4);
    }
    ctx.restore();mg.restore();
  }
  const map=new THREE.CanvasTexture(atlas),maskMap=new THREE.CanvasTexture(mask);map.colorSpace=THREE.SRGBColorSpace;for(const t of [map,maskMap])t.anisotropy=TEXTURE_ANISOTROPY;
  const material=new THREE.MeshStandardMaterial({map,vertexColors:true,roughness:.94,side:THREE.DoubleSide});
  configureFacadeMaterial(material,maskMap);
  const uv=(palette,type,u,v)=>{const slot=slots.get(`${palette}/${type}`);return [((slot%COLS)*TILE+3+u*(TILE-6))/2048,1-(Math.floor(slot/COLS)*TILE+3+(1-v)*(TILE-6))/2048];};
  return {material,uv};
}
export function configureFacadeMaterial(material,maskMap){
  material.userData.mobileKind='facade';material.userData.mobileMaskMap=maskMap;
  material.onBeforeCompile=shader=>{
    shader.uniforms.facadeMask={value:maskMap};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float groundY; attribute float edgeDistance; attribute float roofDistance; varying float vGround; varying float vEdge; varying float vRoof; varying vec3 vWallPosition;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGround=position.y-groundY;vEdge=edgeDistance;vRoof=roofDistance;vWallPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D facadeMask; varying float vGround; varying float vEdge; varying float vRoof; varying vec3 vWallPosition;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float opening=texture2D(facadeMask,vMapUv).r;
      #ifdef USE_COLOR
      // Keep wood, shutters and glazing independent from the sampled plaster tint.
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb/max(vColor,vec3(0.001)),opening);
      #endif
      float plinth=(1.0-smoothstep(0.76,0.84,vGround))*(1.0-opening);
      float grain=fract(sin(dot(floor(vWallPosition.xz*6.0),vec2(12.9898,78.233)))*43758.5453);
      vec3 stone=vec3(0.34,0.32,0.28)*(0.9+grain*0.15);
      diffuseColor.rgb=mix(diffuseColor.rgb,stone,plinth*0.78);
      float damp=(1.0-smoothstep(0.0,1.8,vGround))*0.10+(1.0-smoothstep(0.0,0.8,vRoof))*0.07;
      diffuseColor.rgb*=1.0-damp*(1.0-opening)*(0.55+grain*0.45);
      float pipe=(1.0-smoothstep(0.029,0.041,abs(vEdge-0.17)))*step(0.1,vGround);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.12,0.13,0.11)+vec3(0.055)*smoothstep(0.15,0.19,vEdge),pipe);
    `);
  };
  return material;
}
