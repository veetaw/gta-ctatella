// Distances behind the head of the procession and lateral offsets in metres.
export const BAND_SLOTS=Array.from({length:6},(_,i)=>[14+Math.floor(i/2)*1.6,(i%2-.5)*1.16]);
export function processionCollisionShapes(route,distance,height){
 const shapes=[];
 function add(id,s,offset,halfWidth,halfLength,roof){if(s<0||s>=route.length)return;const p=route.at(s,offset),c=Math.cos(p.yaw),k=Math.sin(p.yaw),local=halfLength?[[-halfWidth,-halfLength],[halfWidth,-halfLength],[halfWidth,halfLength],[-halfWidth,halfLength]]:Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4)*halfWidth,Math.sin(i*Math.PI/4)*halfWidth]),ring=local.map(([u,v])=>[p.x+c*u+k*v,p.z-k*u+c*v]);ring.push(ring[0]);shapes.push({id:'procession-'+id,blocksVehicleFootprint:true,x:p.x,z:p.z,rings:[ring],bounds:[Math.min(...ring.map(v=>v[0])),Math.min(...ring.map(v=>v[1])),Math.max(...ring.map(v=>v[0])),Math.max(...ring.map(v=>v[1]))],roofY:height(p.x,p.z)+roof});}
 add('cenda',distance,0,.42,0,3.6);
 for(const [id,lag]of [['peter',4],['mary',10]])add(id,distance-lag,0,1.25,2.4,4.5);
 BAND_SLOTS.forEach(([lag,offset],i)=>add('musician-'+i,distance-lag,offset,.40,0,1.85));
 for(let i=0;i<16;i++)add('follower-'+i,distance-21-Math.floor(i/2)*1.5,(i%2-.5)*.9,.37,0,1.85);
 return shapes;
}
export function processionOverlaps(a,b){
 if(a.bounds[0]>b.bounds[2]||a.bounds[2]<b.bounds[0]||a.bounds[1]>b.bounds[3]||a.bounds[3]<b.bounds[1])return false;
 const rings=[a.rings[0],b.rings[0]];
 for(const ring of rings)for(let i=1;i<ring.length;i++){const nx=ring[i][1]-ring[i-1][1],nz=ring[i-1][0]-ring[i][0],ranges=rings.map(r=>r.map(p=>p[0]*nx+p[1]*nz));if(Math.max(...ranges[0])<Math.min(...ranges[1])||Math.max(...ranges[1])<Math.min(...ranges[0]))return false;}
 return true;
}
