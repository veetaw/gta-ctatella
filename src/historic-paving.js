import {inside,nearest} from './world-math.js';
export const HISTORIC_PAVING_OFFSET=0;
const caches=new WeakMap();
export function pavingElevationOffset(world,x,z){
 let cache=caches.get(world);if(!cache){cache=new Map();for(const a of world.pavingAreas||[]){if(!['stone','decorated-square'].includes(a.surface))continue;for(let iz=Math.floor((a.bounds[1]-.001)/20);iz<=Math.floor((a.bounds[3]+.001)/20);iz++)for(let ix=Math.floor((a.bounds[0]-.001)/20);ix<=Math.floor((a.bounds[2]+.001)/20);ix++){const key=`${ix},${iz}`;if(!cache.has(key))cache.set(key,[]);cache.get(key).push(a);}}caches.set(world,cache);}
 const p=[x,z];for(const a of cache.get(`${Math.floor(x/20)},${Math.floor(z/20)}`)||[]){if(inside(p,a.rings[0])&&!a.rings.slice(1).some(r=>inside(p,r)))return HISTORIC_PAVING_OFFSET;for(const ring of a.rings)for(let i=1;i<ring.length;i++)if(nearest(p,ring[i-1],ring[i]).d<1e-5)return HISTORIC_PAVING_OFFSET;}return 0;
}
export function installHistoricPaving(network){
 const raw=network.elevationAt,paved=network.pavementAt;
 network.pavementAt=(x,z)=>{const p=paved(x,z);return p?{...p,y:p.y+pavingElevationOffset(network.world,x,z)}:null;};
 network.elevationAt=(x,z)=>raw(x,z)+pavingElevationOffset(network.world,x,z);
}
