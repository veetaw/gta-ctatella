import * as THREE from 'three';

export {AVATAR_DEFAULTS,normalizeAppearance} from './avatar-appearance.js';

// One curved subdivision level, retaining the original rig and four influences.
// The source mesh is never modified; HQ is generated only on explicit selection.
let sharedGeometry;
export function refineAvatarGeometry(source){
 if(sharedGeometry)return sharedGeometry;
 const g=source.index?source.toNonIndexed():source.clone(),pos=g.attributes.position,norm=g.attributes.normal;
 const groups=new Map();const key=i=>[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>v.toFixed(5)).join(',');
 for(let i=0;i<pos.count;i++){const k=key(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
 const normals=new Float32Array(norm.array.length),a=new THREE.Vector3(),b=new THREE.Vector3(),sum=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){a.fromBufferAttribute(norm,i);sum.set(0,0,0);for(const j of groups.get(key(i))){b.fromBufferAttribute(norm,j);if(a.dot(b)>.35)sum.add(b);}sum.normalize().toArray(normals,i*3);}
 norm.array.set(normals);
 const buffers=Object.fromEntries(Object.entries(g.attributes).map(([name,attr])=>[name,[]]));
 const get=(name,i)=>Array.from({length:g.attributes[name].itemSize},(_,k)=>g.attributes[name].array[i*g.attributes[name].itemSize+k]);
 function vertex(i){return Object.fromEntries(Object.keys(buffers).map(name=>[name,get(name,i)]));}
 function midpoint(v,w){const result={};for(const name of Object.keys(buffers))result[name]=v[name].map((x,k)=>(x+w[name][k])*.5);
  const p=new THREE.Vector3().fromArray(v.position),q=new THREE.Vector3().fromArray(w.position),n=new THREE.Vector3().fromArray(v.normal),m=new THREE.Vector3().fromArray(w.normal),edge=q.clone().sub(p);
  p.add(q).multiplyScalar(.5).addScaledVector(m,edge.dot(m)/8).addScaledVector(n,-edge.dot(n)/8);result.position=p.toArray();result.normal=n.add(m).normalize().toArray();
  if(v.skinIndex){const weights=new Map();for(const point of [v,w])point.skinIndex.forEach((id,k)=>weights.set(id,(weights.get(id)||0)+point.skinWeight[k]*.5));const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),total=top.reduce((s,p)=>s+p[1],0)||1;result.skinIndex=Array.from({length:4},(_,i)=>top[i]?.[0]||0);result.skinWeight=Array.from({length:4},(_,i)=>(top[i]?.[1]||0)/total);}
  return result;
 }
 function triangle(...vertices){for(const v of vertices)for(const name of Object.keys(buffers))buffers[name].push(...v[name]);}
 for(let i=0;i<pos.count;i+=3){const a=vertex(i),b=vertex(i+1),c=vertex(i+2),ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangle(a,ab,ca);triangle(ab,b,bc);triangle(ca,bc,c);triangle(ab,bc,ca);}
 const refined=new THREE.BufferGeometry();for(const [name,data] of Object.entries(buffers)){const old=g.attributes[name];refined.setAttribute(name,new THREE.BufferAttribute(new old.array.constructor(data),old.itemSize,old.normalized));}
 refined.computeBoundingBox();refined.computeBoundingSphere();g.dispose();sharedGeometry=refined;return refined;
}

export function makeAvatarSurface(image,appearance,renderer){
 const size=renderer.userData?.mobile?512:1024,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,size,size);
 const pixels=ctx.getImageData(0,0,size,size),data=pixels.data,bump=ctx.createImageData(size,size),rough=ctx.createImageData(size,size);
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const colors=Object.fromEntries(['shirt','trousers','hair','skin'].map(k=>[k,rgb(appearance[k])]));
 for(let i=0;i<data.length;i+=4){const x=(i/4)%size,y=Math.floor(i/4/size),r=data[i],g=data[i+1],b=data[i+2];
  const skin=r>140&&g>65&&g<200&&b<175&&r>g*1.18&&g>b*1.04;
  const shirt=r>g*1.45&&b>g*1.15&&r<190&&y>size*.47;
  const hair=y<size*.48&&r<95&&r>g*1.05&&g>b;
  const trousers=y>size*.74&&x>size*.61&&r<100&&Math.abs(r-g)<14;
  const region=skin?'skin':shirt?'shirt':hair?'hair':trousers?'trousers':null;
  // Deterministic pores and a restrained woven fabric; original UV/logo preserved.
  const noise=((Math.imul(x+11,374761393)^Math.imul(y+7,668265263))>>>0)%101/100-.5;
  const weave=(Math.sin(x*Math.PI*.5)*Math.sin(y*Math.PI*.5));
  if(region){const base=region==='skin'?180:region==='shirt'?75:region==='hair'?42:35,luma=(r*.2126+g*.7152+b*.0722)/base;
   for(let k=0;k<3;k++)data[i+k]=Math.max(0,Math.min(255,colors[region][k]*luma+noise*(skin?1.8:3)));}
  const h=region?128+noise*(skin?9:5)+(shirt||trousers?weave*9:0):128;
  const roughness=skin?178:hair?184:shirt?225:trousers?218:200;
  for(let k=0;k<3;k++){bump.data[i+k]=h;rough.data[i+k]=roughness;}bump.data[i+3]=rough.data[i+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 function texture(pixels){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.getContext('2d').putImageData(pixels,0,0);return new THREE.CanvasTexture(canvas);}
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
 const bumpMap=texture(bump),roughnessMap=texture(rough);for(const t of [map,bumpMap,roughnessMap]){t.flipY=true;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
 return {map,bumpMap,roughnessMap,dispose(){for(const t of [map,bumpMap,roughnessMap])t.dispose();}};
}
