import {pavingElevationOffset} from './historic-paving.js';
import {drawingCanvas,TEXTURE_ANISOTROPY} from './device-profile.js';
import * as THREE from 'three';
export function makeUrbanAprons(scene,network){
 const group=new THREE.Group();group.name='Urban aprons · walls sealed 40 cm inside';scene.add(group);const c=drawingCanvas(512);const ctx=c.getContext('2d');ctx.fillStyle='#a9a497';ctx.fillRect(0,0,512,512);for(let y=0;y<512;y+=128)for(let x=-128;x<512;x+=128){const px=x+(y/128%2)*64;ctx.fillStyle=`hsl(42 9% ${62+((x*13+y*7)%19)/8}%)`;ctx.fillRect(px+2,y+2,124,124);ctx.strokeStyle='#79796e';ctx.lineWidth=2;ctx.strokeRect(px+2,y+2,124,124);}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=TEXTURE_ANISOTROPY;const material=new THREE.MeshStandardMaterial({map:texture,roughness:.97,side:THREE.DoubleSide});
 const positions=[],uv=[];for(const raw of network.urbanAprons.triangles){let p=[[raw[0],raw[1],raw[2]],[raw[3],raw[4],raw[5]],[raw[6],raw[7],raw[8]]];if((p[1][0]-p[0][0])*(p[2][2]-p[0][2])-(p[1][2]-p[0][2])*(p[2][0]-p[0][0])>0)[p[1],p[2]]=[p[2],p[1]];for(const q of p){positions.push(q[0],q[1]+pavingElevationOffset(network.world,q[0],q[2]),q[2]);uv.push(q[0]/2,q[2]/2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;group.add(mesh);
 // Junctions already have exact clipped road triangles. The old flat discs
 // duplicated those faces at the same elevation and caused depth flicker.
 return group;
}
