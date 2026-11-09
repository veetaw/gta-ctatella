import {MOBILE,drawingCanvas,TEXTURE_ANISOTROPY} from './device-profile.js';
import * as THREE from 'three';
import {inside} from './world-math.js';

// The aerial image carries the surveyed white stone ornament. Metric stone
// relief is independent of its 20 cm source resolution and remains sharp on foot.
function stoneMaps(){
 const c=drawingCanvas(1024);const g=c.getContext('2d');g.fillStyle='#514f49';g.fillRect(0,0,1024,1024);
 let seed=82731;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let row=-1;row<7;row++)for(let col=-1;col<5;col++){const x=col*256+(row%2)*128,y=row*1024/6;seed=(((row%6+6)%6)*73856093)^(((col%4+4)%4)*19349663);const tone=146+random()*34;g.fillStyle=`rgb(${tone+6},${tone+4},${tone})`;g.fillRect(x+2,y+2,252,1024/6-4);g.strokeStyle='#b5b0a2';g.lineWidth=2;g.strokeRect(x+3,y+3,250,1024/6-6);for(let i=0;i<220;i++){g.fillStyle=random()<.5?'#22222218':'#ffffff24';g.fillRect(x+4+random()*248,y+4+random()*(1024/6-8),1+random()*3,1+random()*2);}}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=TEXTURE_ANISOTROPY;
 const bump=texture.clone();bump.colorSpace=THREE.NoColorSpace;return {texture,bump};
}
let maps;const photoCache=new Map(),maskCache=new Map(),materialCache=new Map();
export function createPavingMaterial(area,asphalt=null){
 if(area.role==='piazza-croce'){
  const key='croce-dark-stone';if(materialCache.has(key))return materialCache.get(key);const c=drawingCanvas(512),g=c.getContext('2d');g.fillStyle='#393c3b';g.fillRect(0,0,512,512);let seed=9723;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let row=-1;row<5;row++)for(let col=-1;col<5;col++){const x=col*128+(row%2)*64,y=row*128,t=66+random()*18;g.fillStyle=`rgb(${t},${t+2},${t+1})`;g.fillRect(x+2,y+2,124,124);g.strokeStyle='#898b8255';g.lineWidth=1;g.strokeRect(x+3,y+3,122,122);}
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.rotation=Math.PI/4;const material=new THREE.MeshStandardMaterial({map,roughness:.98,polygonOffset:false});materialCache.set(key,material);return material;
 }
 if(area.role==='historic-cellar-street'||area.role==='cellar-main-plaza'){
  const key='gps-route-stone';if(materialCache.has(key))return materialCache.get(key);maps??=stoneMaps();
  const material=new THREE.MeshStandardMaterial({map:maps.texture,bumpMap:MOBILE?null:maps.bump,bumpScale:.022,roughness:.96,polygonOffset:false});materialCache.set(key,material);return material;
 }
 const key=`${area.id}/${asphalt?.uuid||'stone'}`;if(materialCache.has(key))return materialCache.get(key);maps??=stoneMaps();const plain=area.role==='historic-cellar-street'||area.role==='mother-church-square'||area.role==='cellar-main-plaza'||area.role==='san-vito-forecourt';let photo=plain?maps.texture:photoCache.get(area.photo.url);if(!photo){photo=new THREE.TextureLoader().load(MOBILE?area.photo.url.replace(/\.jpg$/,'-mobile.webp'):area.photo.url);photoCache.set(area.photo.url,photo);}photo.colorSpace=THREE.SRGBColorSpace;photo.anisotropy=TEXTURE_ANISOTROPY;
 const b=area.photo.bounds;let mask=maskCache.get(area.id);if(!mask){const maskCanvas=document.createElement('canvas'),size=MOBILE?128:512;maskCanvas.width=maskCanvas.height=size;const ctx=maskCanvas.getContext('2d'),im=ctx.createImageData(size,size);
 const polygons=area.polygons||[area.rings];const segments=polygons.flat().flatMap(r=>r.slice(1).map((q,i)=>[r[i],q]));
 for(let v=0;v<size;v++)for(let u=0;u<size;u++){const x=b[0]+u/(size-1)*(b[2]-b[0]),z=b[1]+v/(size-1)*(b[3]-b[1]);let d=Infinity;for(const [p,q] of segments){const dx=q[0]-p[0],dz=q[1]-p[1],t=Math.max(0,Math.min(1,((x-p[0])*dx+(z-p[1])*dz)/(dx*dx+dz*dz||1)));d=Math.min(d,Math.hypot(x-p[0]-dx*t,z-p[1]-dz*t));}const inArea=polygons.some(rings=>inside([x,z],rings[0])&&!rings.slice(1).some(r=>inside([x,z],r)));const alpha=inArea?1:0;const i=(v*size+u)*4;im.data[i]=im.data[i+1]=im.data[i+2]=alpha*255;im.data[i+3]=255;}ctx.putImageData(im,0,0);mask=new THREE.CanvasTexture(maskCanvas);maskCache.set(area.id,mask);}
 const material=asphalt?asphalt.clone():new THREE.MeshStandardMaterial({map:maps.texture,bumpMap:MOBILE?null:maps.bump,bumpScale:.022,roughness:.96,metalness:.01});
 material.polygonOffset=false;
 material.onBeforeCompile=shader=>{
 Object.assign(shader.uniforms,{heritagePhoto:{value:photo},heritageStone:{value:maps.texture},heritageMask:{value:mask},heritageBounds:{value:new THREE.Vector4(...b)}});
 shader.vertexShader='varying vec2 heritageXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nheritageXZ=position.xz;');
 shader.fragmentShader='varying vec2 heritageXZ;\nuniform sampler2D heritagePhoto,heritageStone,heritageMask;\nuniform vec4 heritageBounds;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 vec2 photoUV=vec2((heritageXZ.x-heritageBounds.x)/(heritageBounds.z-heritageBounds.x),1.0-(heritageXZ.y-heritageBounds.y)/(heritageBounds.w-heritageBounds.y));
 float stoneWeight=texture2D(heritageMask,photoUV).r*step(0.,photoUV.x)*step(photoUV.x,1.)*step(0.,photoUV.y)*step(photoUV.y,1.);
 vec3 source=texture2D(heritagePhoto,photoUV).rgb;
 vec3 granules=texture2D(heritageStone,heritageXZ/2.).rgb;
 vec3 paving=${plain?'granules*1.25':'source*(.34+1.9*granules)'};
 diffuseColor.rgb=mix(diffuseColor.rgb,paving,${asphalt?'stoneWeight':'1.0'});`);
 // Shader uses metric world coordinates for relief, never stretched road UVs.
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 vec2 stoneUV=heritageXZ/2.;float h=texture2D(heritageStone,stoneUV).r;
 vec2 grad=vec2(texture2D(heritageStone,stoneUV+vec2(.001,0.)).r-h,texture2D(heritageStone,stoneUV+vec2(0.,.001)).r-h);
 normal=normalize(normal+vec3(-grad.x,0.,-grad.y)*.25*${asphalt?'stoneWeight':'1.0'});`);
 };
 material.customProgramCacheKey=()=>`heritage-${!!asphalt}-${plain}`;material.userData.surface=area.surface;material.userData.mobileKind='paving';material.userData.mobileArea=area;material.userData.mobileAsphalt=!!asphalt;materialCache.set(key,material);return material;
}
