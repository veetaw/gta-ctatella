import proj4 from 'proj4';
import {elevation,nearest} from '../src/world-math.js';
export function buildCellarDistrict(world){
 const local=(lat,lon)=>{const q=proj4('EPSG:4326','+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs',[lon,lat]);return [q[0]-world.origin.x,-(q[1]-world.origin.y)];};
 const start=local(40.6557267,15.4063),end=local(40.6555196,15.400788),plaza=local(40.655552,15.401863),nodes=[];
 const node=p=>{let i=nodes.findIndex(n=>Math.hypot(n.p[0]-p[0],n.p[1]-p[1])<1.5);if(i<0){i=nodes.length;nodes.push({p,edges:[]});}return i;};
 for(const road of world.roads)for(let i=1;i<road.points.length;i++){const a=node(road.points[i-1]),b=node(road.points[i]),cost=Math.hypot(nodes[a].p[0]-nodes[b].p[0],nodes[a].p[1]-nodes[b].p[1]);nodes[a].edges.push({to:b,cost});nodes[b].edges.push({to:a,cost});}
 const closest=p=>nodes.reduce((a,n,i)=>Math.hypot(n.p[0]-p[0],n.p[1]-p[1])<Math.hypot(nodes[a].p[0]-p[0],nodes[a].p[1]-p[1])?i:a,0),source=closest(start),target=closest(end),dist=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),done=new Set();dist[source]=0;
 while(done.size<nodes.length){let u=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(u<0||dist[i]<dist[u]))u=i;if(u<0||!Number.isFinite(dist[u]))break;if(u===target)break;done.add(u);for(const e of nodes[u].edges)if(dist[u]+e.cost<dist[e.to]){dist[e.to]=dist[u]+e.cost;prev[e.to]=u;}}
 if(!Number.isFinite(dist[target]))throw Error('Historic cellar axis is disconnected in DBT road graph');
 const route=[];for(let i=target;i>=0;i=prev[i]){route.unshift(nodes[i].p);if(i===source)break;}
 if(elevation(world.terrain,...route[0])>elevation(world.terrain,...route.at(-1)))route.reverse();
 const segments=[];
 for(let i=1;i<route.length;i++)segments.push({a:route[i-1],b:route[i],source:'gps-route'});
 world.cellarDistrict={start,end,plaza,route,segments,leftReach:12,maxHeight:3.5,pavingOffset:0,uphillDirection:'Via San Zaccaria → Viale della Rimembranza; world-space left normal (dz, -dx)'};
 return world.cellarDistrict;
}
export function leftCellarEvidence(b,district){
 if(!district||b.church||!['residential','historic-cellar'].includes(b.classification||'residential'))return null;
 const ring=b.rings[0],center=[(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2];
 const projection=p=>{let best=null;for(const s of district.segments){const n=nearest(p,s.a,s.b);if(!best||n.d<best.distance){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],len=Math.hypot(dx,dz)||1;best={distance:n.d,side:((p[0]-n.q[0])*dz-(p[1]-n.q[1])*dx)/len,source:s.source,roadPoint:n.q,dx:dx/len,dz:dz/len};}}return best;};
 const best=projection(center);if(!best||best.side<=0)return null;
 // Each vertex and edge midpoint uses its OWN nearest route tangent. A DBT
 // footprint may describe a whole curved row rather than a single house.
 const samples=ring.slice(1).flatMap((p,i)=>[p,[(p[0]+ring[i][0])/2,(p[1]+ring[i][1])/2]]).map(projection);
 const signed=samples.map(p=>p.side),distance=Math.min(...samples.map(p=>p.distance));
 const first=district.route[0],last=district.route.at(-1),head=district.segments[0],tail=district.segments.at(-1);
 if((center[0]-first[0])*(head.b[0]-head.a[0])+(center[1]-first[1])*(head.b[1]-head.a[1])<0||(center[0]-last[0])*(tail.b[0]-tail.a[0])+(center[1]-last[1])*(tail.b[1]-tail.a[1])>0)return null;
 return Math.min(...signed)>.3&&distance<=district.leftReach?{kind:'user-defined-left-uphill-cellar-district',...best,distance}:null;
}
