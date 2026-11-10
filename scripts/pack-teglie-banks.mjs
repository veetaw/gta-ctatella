import {gzipSync} from 'node:zlib';

export function packTeglieBanks(batches){
 const tiles=new Map();
 for(const vertices of batches)for(let i=0;i<vertices.length;i+=9){
  const x=(vertices[i]+vertices[i+3]+vertices[i+6])/3,z=(vertices[i+2]+vertices[i+5]+vertices[i+8])/3;
  const key=`${Math.floor(x/180)}/${Math.floor(z/180)}`;
  if(!tiles.has(key))tiles.set(key,{vertices:[],ids:new Map(),indices:[]});
  const tile=tiles.get(key);
  for(let j=i;j<i+9;j+=3){
   const p=[vertices[j],vertices[j+1],vertices[j+2]].map(v=>Math.round(v*100));
   const key=p.join('/');
   let index=tile.ids.get(key);
   if(index===undefined){
    index=tile.ids.size;tile.ids.set(key,index);tile.vertices.push(...p);
   }
   tile.indices.push(index);
  }
 }
 const chunks=[];
 for(const {vertices,indices} of tiles.values()){
  const previous=[0,0,0];
  const deltas=Int32Array.from(vertices,(v,i)=>{
   const axis=i%3,d=v-previous[axis];previous[axis]=v;return d;
  });
  let last=0;
  const indexDeltas=Int32Array.from(indices,i=>{const delta=i-last;last=i;return delta;});
  chunks.push(Buffer.from(Int32Array.of(deltas.length,indexDeltas.length).buffer),
   Buffer.from(deltas.buffer),Buffer.from(indexDeltas.buffer));
 }
 return gzipSync(Buffer.concat(chunks),{level:6});
}
