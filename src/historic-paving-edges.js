import * as THREE from 'three';
import {pavingElevationOffset,HISTORIC_PAVING_OFFSET} from './historic-paving.js';
export function makeHistoricPavingEdges(scene,network){
 const positions=[];for(const a of network.pavingAreas)if(['stone','decorated-square'].includes(a.surface))for(const ring of a.rings)for(let i=1;i<ring.length;i++){
  const p=ring[i-1],q=ring[i],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<.01)continue;
  const nx=-dz/length,nz=dx/length,mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2;
  if(pavingElevationOffset(network.world,mx+nx*.03,mz+nz*.03)&&pavingElevationOffset(network.world,mx-nx*.03,mz-nz*.03))continue;
  const n=Math.ceil(length);for(let j=0;j<n;j++){const x0=p[0]+dx*j/n,z0=p[1]+dz*j/n,x1=p[0]+dx*(j+1)/n,z1=p[1]+dz*(j+1)/n,y0=network.elevationAt(x0,z0),y1=network.elevationAt(x1,z1),v=[[x0,y0,z0],[x1,y1,z1],[x1,y1-HISTORIC_PAVING_OFFSET-.04,z1],[x0,y0-HISTORIC_PAVING_OFFSET-.04,z0]];for(const k of [0,1,2,0,2,3])positions.push(...v[k]);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#b6b0a2',roughness:.98,side:THREE.DoubleSide}));mesh.name='Historic paving · sealed 16 cm stone kerbs';mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
