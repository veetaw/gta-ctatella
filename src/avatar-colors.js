import * as THREE from 'three';
// Color changes remain visible in Normal without loading any HQ implementation.
export function recolorAvatar(image,appearance){
 const c=document.createElement('canvas');c.width=c.height=Math.min(1024,image.width);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data,size=c.width;
 const colors=Object.fromEntries(['shirt','trousers','hair','skin'].map(key=>[key,[1,3,5].map(i=>parseInt(appearance[key].slice(i,i+2),16))]));
 for(let i=0;i<d.length;i+=4){const x=(i/4)%size,y=Math.floor(i/4/size),r=d[i],g=d[i+1],b=d[i+2];const region=r>140&&g>65&&g<200&&b<175&&r>g*1.18&&g>b*1.04?'skin':r>g*1.45&&b>g*1.15&&r<190&&y>size*.47?'shirt':y<size*.48&&r<95&&r>g*1.05&&g>b?'hair':y>size*.74&&x>size*.61&&r<100&&Math.abs(r-g)<14?'trousers':null;if(!region)continue;const base=region==='skin'?180:region==='shirt'?75:region==='hair'?42:35,luma=(r*.2126+g*.7152+b*.0722)/base;for(let k=0;k<3;k++)d[i+k]=Math.min(255,colors[region][k]*luma);}
 ctx.putImageData(pixels,0,0);const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;return {map,dispose(){map.dispose();}};
}
