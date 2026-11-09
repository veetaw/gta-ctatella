import * as THREE from 'three';
// One indexed draw per material. Only the index list changes when the actor
// crosses a 20 m cell; transforms and GIS vertices never move.
export function indexNearbyDetail(mesh,radius=260,viewOnly=false){
 const geo=mesh.geometry,pos=geo.attributes.position,source=geo.index?.array,count=source?.length??pos.count,cells=new Map();
 // Count first, then fill typed bins directly. Avoid millions of boxed indices,
 // temporary arrays and Vector3s while the full town is being uploaded.
 const visit=fill=>{for(let i=0;i<count;i+=3){const a=source?source[i]:i,b=source?source[i+1]:i+1,c=source?source[i+2]:i+2,x=(pos.getX(a)+pos.getX(b)+pos.getX(c))/3,z=(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3,key=`${Math.floor(x/40)},${Math.floor(z/40)}`;let cell=cells.get(key);if(!cell){cell={count:0,offset:0,box:new THREE.Box3()};cells.set(key,cell);}if(!fill){cell.count+=3;for(let k=0;k<3;k++){const id=k===0?a:k===1?b:c,px=pos.getX(id),py=pos.getY(id),pz=pos.getZ(id);cell.box.min.x=Math.min(cell.box.min.x,px);cell.box.min.y=Math.min(cell.box.min.y,py);cell.box.min.z=Math.min(cell.box.min.z,pz);cell.box.max.x=Math.max(cell.box.max.x,px);cell.box.max.y=Math.max(cell.box.max.y,py);cell.box.max.z=Math.max(cell.box.max.z,pz);}}else{cell.array[cell.offset++]=a;cell.array[cell.offset++]=b;cell.array[cell.offset++]=c;}}};
 visit(false);for(const cell of cells.values())cell.array=new Uint32Array(cell.count);visit(true);const typed=cells,buffer=new THREE.BufferAttribute(new Uint32Array(count),1),frustum=new THREE.Frustum(),matrix=new THREE.Matrix4();buffer.setUsage(THREE.DynamicDrawUsage);geo.setIndex(buffer);let last='';
 return (x,z,camera)=>{let key=`${Math.floor(x/20)},${Math.floor(z/20)}`;if(viewOnly){if(!camera)return;key+=viewKey(camera);frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));for(const plane of frustum.planes)plane.constant+=20;}if(key===last)return;last=key;let offset=0;
  const append=c=>{buffer.array.set(c.array,offset);offset+=c.array.length;};
  if(viewOnly){for(const c of typed.values())if(frustum.intersectsBox(c.box))append(c);}else for(let j=Math.floor((z-radius)/40);j<=Math.floor((z+radius)/40);j++)for(let i=Math.floor((x-radius)/40);i<=Math.floor((x+radius)/40);i++){if(Math.hypot(i*40+20-x,j*40+20-z)>radius+29)continue;const c=typed.get(`${i},${j}`);if(c)append(c);}
  geo.setDrawRange(0,offset);buffer.clearUpdateRanges();buffer.addUpdateRange(0,offset);buffer.needsUpdate=true;};
}
function viewKey(c){return [c.position.x,c.position.y,c.position.z].map(v=>Math.floor(v/5)).join('/')+'/'+[c.quaternion.x,c.quaternion.y,c.quaternion.z,c.quaternion.w].map(v=>Math.round(v*50)).join('/');}
export function terrainDistanceDetail(ground){
 // Refined DEM tiles have a 5 x 5 vertex lattice. Far tiles use their four
 // existing corners; the LOD boundary is stitched using every edge vertex.
 const refined=ground.children[1];if(!refined)return()=>{};const geo=refined.geometry,p=geo.attributes.position,source=geo.index?.array;if(!source||p.count%25)return()=>{};
 const tiles=[];for(let i=0;i<p.count;i+=25){let low=Infinity,high=-Infinity;for(let j=0;j<25;j++){low=Math.min(low,p.getY(i+j));high=Math.max(high,p.getY(i+j));}tiles.push({start:i,x:p.getX(i+12),z:p.getZ(i+12),sphere:new THREE.Sphere(new THREE.Vector3(p.getX(i+12),(low+high)/2,p.getZ(i+12)),Math.hypot(3.54,(high-low)/2)+1)});}
 const buffer=new THREE.BufferAttribute(new Uint32Array(source.length),1);buffer.setUsage(THREE.DynamicDrawUsage);geo.setIndex(buffer);let last='';const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4();
 return(x,z,camera)=>{const key=`${Math.floor(x/20)},${Math.floor(z/20)}`+(camera?viewKey(camera):'');if(camera)frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));for(const plane of frustum.planes)plane.constant+=20;if(last===key)return;last=key;let n=0;
  for(const t of tiles){if(camera&&!frustum.intersectsSphere(t.sphere))continue;const d=Math.hypot(t.x-x,t.z-z),a=t.start;if(d<230){const start=a/25*96;buffer.array.set(source.subarray(start,start+96),n);n+=96;}else if(d<240){const boundary=[];const edges=[{ids:[0,5,10,15],dx:-5,dz:0},{ids:[20,21,22,23],dx:0,dz:5},{ids:[24,19,14,9],dx:5,dz:0},{ids:[4,3,2,1],dx:0,dz:-5}];for(const edge of edges)boundary.push(...(Math.hypot(t.x+edge.dx-x,t.z+edge.dz-z)<240?edge.ids:[edge.ids[0]]));for(let k=0;k<boundary.length;k++){buffer.array[n++]=a+12;buffer.array[n++]=a+boundary[k];buffer.array[n++]=a+boundary[(k+1)%boundary.length];}}else{buffer.array.set([a,a+20,a+4,a+4,a+20,a+24],n);n+=6;}}
  geo.setDrawRange(0,n);buffer.clearUpdateRanges();buffer.addUpdateRange(0,n);buffer.needsUpdate=true;
 };
}
