import * as THREE from 'three';
// Revolved silhouette: bulb, shoulder, long cylindrical grip, rounded end.
// The shallow notches are part of the actual mesh, not floating decoration.
export function makeMazzuoccoloModel(){
 const profile=[
  [0,-.49],[.13,-.47],[.24,-.39],[.30,-.28],[.33,-.16],
  [.332,-.12],[.310,-.105],[.333,-.085],[.334,-.045],
  [.312,-.025],[.333,-.005],[.322,.055],[.297,.12],
  [.270,.17],[.246,.20],[.225,.23],[.185,.27],[.135,.31],
  [.112,.35],[.110,.60],[.103,.70],[.118,.73],[.11,.77],[.065,.80],[0,.82]
 ].map(([r,x])=>new THREE.Vector2(r,x));
 const geometry=new THREE.LatheGeometry(profile,20);geometry.rotateZ(-Math.PI/2);
 // Subtle mineral variation without texture allocation on a phone.
 const p=geometry.getAttribute('position'),colors=[];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),tone=.86+.08*Math.sin(x*51+y*31+z*43);colors.push(.61*tone,.57*tone,.49*tone);}geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:.02});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='Mazzuoccolo · corpo bulboso scanalato e manico';return mesh;
}
