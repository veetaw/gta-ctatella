import {makeDbtDetails} from './dbt-details.js';
import {extraColliders} from './dbt-plan.js';
import {SpatialIndex} from './road-network.js';
import {makeVillageLamps} from './village-details.js';
import {createVillagePlan} from './village-plan.js';
import {inBuilding,nearest} from './world-math.js';

export function makeTeglieDetails(root,world,network,surveyed,insideOriginal,nightZone){
 const tiles=new Map(),occupied=new SpatialIndex(16);
 const add=(kind,item,x,z)=>{
  const key=`${Math.floor(x/220)}/${Math.floor(z/220)}`;
  if(!tiles.has(key))tiles.set(key,{lamps:[],details:[]});
  tiles.get(key)[kind].push(item);
 };
 const feature=(id,category,points,properties={})=>{
  const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
  return {id,category,points,properties,bounds:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)]};
 };
 const houses=new SpatialIndex(20);
 for(const house of world.buildings)houses.insert(house,house.bounds);
 const inHouse=(x,z)=>houses.point(x,z).some(b=>inBuilding([x,z],b));
 const boundaries=[];
 for(const f of surveyed){
  if(f.category==='lamp')continue;
  if(f.points){
   // Keep mapped walls out of junction mouths where centerlines and DBT sheets differ.
   for(let i=1;i<f.points.length;i++){
    const a=f.points[i-1],b=f.points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
    const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    for(let j=0;j<n;j++){
     const p=at(j/n),q=at((j+1)/n),m=at((j+.5)/n);
     if([p,m,q].some(v=>insideOriginal(...v)||network.pavementAt(...v)))continue;
     const piece=feature(`${f.id}/${i}/${j}`,f.category,[p,q],f.properties);
     occupied.insert(piece,piece.bounds);boundaries.push(piece);
     add('details',piece,...m);
    }
   }
  }else if(!inHouse(...f.point))add('details',f,...f.point);
 }
 const clear=([x,z])=>!insideOriginal(x,z)&&!network.pavementAt(x,z)&&!inHouse(x,z);
 for(const house of world.buildings){
  if(house.area<35)continue;
  const [l,t,r,b]=house.bounds,x=(l+r)/2,z=(t+b)/2;
  const closest=network.segmentIndex.box([x-23,z-23,x+23,z+23]).reduce((best,segment)=>{
   const n=nearest([x,z],[segment.a.x,segment.a.z],[segment.b.x,segment.b.z]);
   return !best||n.d<best.d?{...n,segment}:best;
  },null);
  if(!closest||closest.d<8||closest.d>22)continue;
  const [u,v]=closest.q,dx=(x-u)/closest.d,dz=(z-v)/closest.d,offset=closest.segment.half+2.6;
  const gx=u+dx*offset,gz=v+dz*offset,at=s=>[gx-dz*s,gz+dx*s];
  const extent=Math.min(6,Math.max(3.6,Math.hypot(r-l,b-t)*.38));
  if(occupied.box([gx-extent,gz-extent,gx+extent,gz+extent]).some(({bounds:[l,t,r,b]})=>
   l<=gx+extent&&r>=gx-extent&&t<=gz+extent&&b>=gz-extent))continue;
  const samples=Math.ceil(extent*4);
  if(Array.from({length:samples+1},(_,i)=>at((2*i/samples-1)*extent)).some(p=>!clear(p)))continue;
  if(Math.abs(network.elevationAt(...at(-extent))-network.elevationAt(...at(extent)))/extent>.48)continue;
  for(const [kind,a,b] of [['gate',-1.65,1.65],['fence',-extent,-1.65],['fence',1.65,extent]]){
   const f=feature(`${house.id}/${kind}/${a}`,kind,[at(a),at(b)]);
   occupied.insert(f,f.bounds);
   add('details',f,gx,gz);
   // Only mapped boundaries are physical obstacles. Generated entrances are scenery.
  }
 }
 const {lamps}=createVillagePlan(world,network,undefined,{lampsOnly:true});
 const nightLamps=[];
 for(const lamp of lamps){
  if(insideOriginal(lamp.x,lamp.z))continue;
  add('lamps',lamp,lamp.x,lamp.z);
  if(nightZone(lamp.x,lamp.z))nightLamps.push(lamp);
 }
 // The combined terrain bounds do not match the original DEM raster origin.
 const assets={wallGround:network.elevationAt};
 for(const {lamps,details} of tiles.values()){
  makeVillageLamps(root,lamps);
  if(details.length){
   const tile=makeDbtDetails(root,{...world,buildings:[],dbtExtras:{features:details}},network,[],assets);
   for(const mesh of tile.children)mesh.castShadow=false;
  }
 }
 return {nightLamps,colliders:extraColliders(boundaries)};
}
