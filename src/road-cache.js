import * as THREE from 'three';

// Geometry is generated in Node during world/build preparation, avoiding heavy
// clipping on the browser's UI thread. A runtime fallback keeps source dev usable.
export async function loadRoadMeshCache(){
 if(import.meta.env.PROD)return loadProductionRoadCache();
  if(typeof DecompressionStream==='undefined')return null;
  const response=await fetch('/road-cache.json');if(!response.ok)return null;
  const manifest=await response.json();if(manifest.version!==1)return null;
  const compressed=await fetch(`/road-meshes.binz?v=${manifest.fingerprint}`);if(!compressed.ok||!compressed.body)return null;
  const data=await new Response(compressed.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(data.byteLength!==manifest.bytes)throw Error('Cache geometria strade incompleta');
  const result={terrain:[],bank:[],seal:[]};
  for(const entry of manifest.meshes){
    const geometry=new THREE.BufferGeometry();for(const [name,a] of Object.entries(entry.attributes))geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(data,a.offset,a.length),a.itemSize));
    if(entry.index){const a=entry.index;geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data,a.offset,a.length),1));}
    geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(...entry.sphere.center),entry.sphere.radius);result[entry.kind].push(geometry);
  }
  return result;
}

export async function loadProductionRoadCache(){
 const [{getWorldManifest,unpackResponse},{MeshoptDecoder}]=await Promise.all([import('./world-assets.js'),import('meshoptimizer/decoder')]);const manifest=await getWorldManifest();await MeshoptDecoder.ready;const data=new Uint8Array(await unpackResponse(await fetch(manifest.geometry.url))),result={terrain:[],bank:[],seal:[]};
 for(const entry of manifest.meshes){const packed=new Uint8Array(entry.count*entry.stride);MeshoptDecoder.decodeVertexBuffer(packed,entry.count,entry.stride,data.subarray(entry.vertex.offset,entry.vertex.offset+entry.vertex.length));const v=new DataView(packed.buffer),positions=new Float32Array(entry.count*3),normals=new Int8Array(entry.count*3),uv=entry.uv?new Uint16Array(entry.count*2):null;
  for(let i=0;i<entry.count;i++){for(let k=0;k<3;k++){positions[i*3+k]=v.getInt32(i*entry.stride+k*4,true)/1000;normals[i*3+k]=v.getInt8(i*entry.stride+12+k);}if(uv)for(let k=0;k<2;k++)uv[i*2+k]=v.getUint16(i*entry.stride+16+k*2,true);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3,true));if(uv)g.setAttribute('uv',new THREE.BufferAttribute(uv,2,true));if(entry.index){const i=entry.index,array=new Uint32Array(i.count);MeshoptDecoder.decodeIndexBuffer(new Uint8Array(array.buffer),i.count,4,data.subarray(i.offset,i.offset+i.length));g.setIndex(new THREE.BufferAttribute(array,1));}g.boundingSphere=new THREE.Sphere(new THREE.Vector3(...entry.sphere.center),entry.sphere.radius+.002);result[entry.kind].push(g);
 }return result;
}
