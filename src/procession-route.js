import {worldLocation} from './game-locations.js';
export const PROCESSION_START={lat:40.656035,lon:15.406984},PROCESSION_END={lat:40.656123,lon:15.405181};
// Shortest path over sampled real road centre-lines, shared by desktop and mobile.
export function processionRoute(network,{start:fromGPS=PROCESSION_START,end:toGPS=PROCESSION_END}={}){
 return roadRoute(network,worldLocation(network.world.origin,fromGPS),worldLocation(network.world.origin,toGPS));
}

export function roadRoute(network,start,end){
 const nodes=[],bins=new Map(),size=3;
 const key=(x,z)=>`${Math.floor(x/size)},${Math.floor(z/size)}`;
 function node(x,z){const id=nodes.length,n={x,z,edges:new Map()};nodes.push(n);const k=key(x,z);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(id);return id;}
 function connect(a,b){if(a===b)return;const d=Math.hypot(nodes[a].x-nodes[b].x,nodes[a].z-nodes[b].z);nodes[a].edges.set(b,d);nodes[b].edges.set(a,d);}
 const within=p=>p[0]>Math.min(start.x,end.x)-200&&p[0]<Math.max(start.x,end.x)+200&&p[1]>Math.min(start.z,end.z)-200&&p[1]<Math.max(start.z,end.z)+200;
 for(const road of network.roads){let previous=null;const points=road.points||road.sections.map(p=>[p.x,p.z]);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(!within(a)&&!within(b)){previous=null;continue;}const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));for(let j=0;j<=steps;j++){if(j===0&&previous!==null)continue;const f=j/steps,id=node(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f);if(previous!==null)connect(previous,id);previous=id;}}}
 if(!nodes.length)throw Error('Percorso della processione non disponibile');
 // Connect surveyed junctions, whose centre-lines can end slightly apart.
 for(let i=0;i<nodes.length;i++){const p=nodes[i],bx=Math.floor(p.x/size),bz=Math.floor(p.z/size);for(let z=bz-1;z<=bz+1;z++)for(let x=bx-1;x<=bx+1;x++)for(const j of bins.get(`${x},${z}`)||[])if(j<i&&Math.hypot(nodes[j].x-p.x,nodes[j].z-p.z)<2)connect(i,j);}
 const nearest=p=>nodes.reduce((best,n,i)=>Math.hypot(n.x-p.x,n.z-p.z)<Math.hypot(nodes[best].x-p.x,nodes[best].z-p.z)?i:best,0),from=nearest(start),to=nearest(end),cost=new Float64Array(nodes.length).fill(Infinity),parent=new Int32Array(nodes.length).fill(-1),heap=[];
 function push(item){heap.push(item);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][1]<=item[1])break;heap[i]=heap[p];i=p;}heap[i]=item;}
 function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1][1]<heap[child][1])child++;if(heap[child][1]>=last[1])break;heap[i]=heap[child];i=child;}heap[i]=last;}return first;}
 cost[from]=0;push([from,0]);while(heap.length){const [i,d]=pop();if(d!==cost[i])continue;if(i===to)break;for(const [j,weight] of nodes[i].edges){const next=d+weight;if(next<cost[j]){cost[j]=next;parent[j]=i;push([j,next]);}}}
 if(!Number.isFinite(cost[to]))throw Error('Le strade delle due chiese non sono collegate');
 const indices=[];for(let i=to;i!==-1;i=parent[i])indices.push(i);const points=[start,...indices.reverse().map(i=>({x:nodes[i].x,z:nodes[i].z})),end].filter((p,i,a)=>!i||Math.hypot(p.x-a[i-1].x,p.z-a[i-1].z)>.01);
 let length=0;points.forEach((p,i)=>{if(i)length+=Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z);p.s=length;});
 function at(s,offset=0){s=Math.max(0,Math.min(length,s));let lo=0,hi=points.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].s<=s)lo=mid;else hi=mid;}const a=points[lo],b=points[hi],d=b.s-a.s||1,f=(s-a.s)/d,dx=(b.x-a.x)/d,dz=(b.z-a.z)/d;return {x:a.x+(b.x-a.x)*f+dz*offset,z:a.z+(b.z-a.z)*f-dx*offset,yaw:Math.atan2(dx,dz)};}
 return {start,end,points,length,at};
}

export function processionPathDistance(route,x,z,from=0,to=route.length){
 let distance=Infinity;
 for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];if(b.s<from)continue;if(a.s>to)break;const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));distance=Math.min(distance,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}
 return distance;
}
// Leave enough room for the car footprint, both varas and the two follower columns.
export function processionParking(network,route,anchor,clear){
 const candidates=[];
 for(const road of network.roads){const sections=road.sections||road.points.slice(1).map((p,i)=>{const a=road.points[i],dx=p[0]-a[0],dz=p[1]-a[1],d=Math.hypot(dx,dz)||1;return {x:p[0],z:p[1],nx:dz/d,nz:-dx/d};});for(const p of sections){const d=Math.hypot(p.x-anchor.x,p.z-anchor.z);if(d>140)continue;for(const offset of [0,5.5,-5.5,7.5,-7.5]){const x=p.x+p.nx*offset,z=p.z+p.nz*offset;if(Math.hypot(x-anchor.x,z-anchor.z)<9)continue;candidates.push({x,z,yaw:Math.atan2(p.nz,-p.nx)});}}}
 candidates.sort((a,b)=>Math.hypot(a.x-anchor.x,a.z-anchor.z)-Math.hypot(b.x-anchor.x,b.z-anchor.z));
 return candidates.find(p=>processionPathDistance(route,p.x,p.z)>=5.5&&clear(p.x,p.z,2.6))||null;
}
