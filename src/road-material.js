import {MOBILE,TEXTURE_ANISOTROPY} from './device-profile.js';
import * as THREE from 'three';
let shared;
// Isotropic asphalt: no painted-in kerbs or lane-width UV assumptions. The
// same quiet aggregate works on clipped ribbons and surveyed junctions.
export function createAsphaltMaterial(){
 if(shared)return shared;
 const size=256,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d'),data=ctx.createImageData(size,size);
 let seed=81273;for(let y=0;y<size;y++)for(let x=0;x<size;x++){seed=Math.imul(seed,1664525)+1013904223>>>0;const grain=(seed/4294967296-.5)*7,value=97+grain,i=(y*size+x)*4;data.data.set([value,value+1,value+1,255],i);}ctx.putImageData(data,0,0);
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.generateMipmaps=true;map.anisotropy=MOBILE?4:TEXTURE_ANISOTROPY;
 shared=new THREE.MeshStandardMaterial({map,roughness:1,metalness:0});return shared;
}
export function createPlainAsphaltMaterial(){return createAsphaltMaterial();}
