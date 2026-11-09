import {grotteTreeFilter} from './local-world-edits.js';
import {SpatialIndex} from './road-network.js';
import {elevation,inBuilding,nearest} from './world-math.js';
import {buildingSeed} from './building-plan.js';

export function createVillagePlan(world,network,isGreen=()=>false){
  const buildings=new SpatialIndex(24),occupied=new SpatialIndex(6),lamps=[],signs=[],trees=[];
  for(const b of world.buildings)buildings.insert(b,b.bounds);
  function clear(x,z,radius=.4){const t=world.terrain;if(x<t.minX+4||x>t.maxX-4||z<t.minZ+4||z>t.maxZ-4||network.pavementAt(x,z))return false;
    for(const b of buildings.box([x-radius,z-radius,x+radius,z+radius])){if(inBuilding([x,z],b))return false;for(const ring of b.rings)for(let i=1;i<ring.length;i++)if(nearest([x,z],ring[i-1],ring[i]).d<radius)return false;}
    return true;
  }
  function reserve(x,z,distance){if(occupied.box([x-distance,z-distance,x+distance,z+distance]).some(p=>Math.hypot(p.x-x,p.z-z)<distance))return false;occupied.insert({x,z},[x,z,x,z]);return true;}
  for(let ri=0;ri<network.roads.length;ri++){
    const road=network.roads[ri],step=32+(buildingSeed(road.id)%9);let next=road.length<step?road.length/2:step/2;
    for(const p of road.sections){if(p.s<next)continue;next+=step;if(road.length<12)continue;
      const preferred=(buildingSeed(road.id)+Math.floor(p.s/step))%2?1:-1;
      for(const side of [preferred,-preferred]){
        const d=road.width/2+.65,x=p.x+p.nx*d*side,z=p.z+p.nz*d*side;
        if(!clear(x,z,1.05)||!reserve(x,z,8))continue;
        lamps.push({x,z,y:elevation(world.terrain,x,z),nx:-p.nx*side,nz:-p.nz*side,height:4.1+(ri%3)*.15});break;
      }
    }
  }
  const nodes=new Map();
  for(const road of network.roads)for(const p of [road.sections[0],road.sections.at(-1)]){const key=`${Math.round(p.x/1.2)},${Math.round(p.z/1.2)}`;if(!nodes.has(key))nodes.set(key,{x:p.x,z:p.z,ends:[]});nodes.get(key).ends.push({road,p});}
  let junction=0;
  for(const node of nodes.values()){
    if(node.ends.length<2)continue;junction++;const names=[...new Set(node.ends.map(e=>e.road.name).filter(Boolean))];
    const candidates=[];for(let i=0;i<12;i++){const angle=i*Math.PI/6,radius=5.1+(i%2)*1.5;candidates.push({x:node.x+Math.sin(angle)*radius,z:node.z+Math.cos(angle)*radius,angle});}
    for(const c of candidates){if(!clear(c.x,c.z,.45)||!reserve(c.x,c.z,2))continue;
      signs.push({...c,y:elevation(world.terrain,c.x,c.z),names:names.slice(0,2),type:names.length?'direction':junction%3===0?'warning':'no-entry'});break;
    }
    let placed=0;
    for(let i=0;i<12;i++){const angle=i*Math.PI/6;for(const radius of [8.8,11])candidates.push({x:node.x+Math.sin(angle)*radius,z:node.z+Math.cos(angle)*radius,angle});}
    for(const c of candidates){const near=network.closestSegment(c.x,c.z);if(near&&near.d<near.segment.half+1.65)continue;
      if(!clear(c.x,c.z,1.7)||!reserve(c.x,c.z,3.6))continue;
      const slope=Math.abs(elevation(world.terrain,c.x+1,c.z)-elevation(world.terrain,c.x-1,c.z))+Math.abs(elevation(world.terrain,c.x,c.z+1)-elevation(world.terrain,c.x,c.z-1));if(slope>1.6)continue;
      trees.push({...c,y:elevation(world.terrain,c.x,c.z),species:junction%4,scale:.85+(junction%5)*.08,urban:true});if(++placed===2)break;
    }
  }
  // Photo-selected countryside vegetation and small open pockets between homes.
  let seed=34791;const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  for(let i=0;i<22000&&trees.length<3000;i++){
    const x=world.terrain.minX+random()*(world.terrain.maxX-world.terrain.minX),z=world.terrain.minZ+random()*(world.terrain.maxZ-world.terrain.minZ);
    if(!isGreen(x,z)||!clear(x,z,1.3))continue;const near=network.closestSegment(x,z);if(near&&near.d<near.segment.half+1.8)continue;if(!reserve(x,z,3.2))continue;
    trees.push({x,z,y:elevation(world.terrain,x,z),species:Math.floor(random()*4),scale:.8+random()*.65,urban:false});
  }
  const surveyed=new SpatialIndex(8);for(const f of world.dbtExtras?.features||[])if(f.category==='tree')surveyed.insert(f,f.bounds);const filtered=trees.filter(t=>!surveyed.box([t.x-2.5,t.z-2.5,t.x+2.5,t.z+2.5]).some(f=>Math.hypot(f.point[0]-t.x,f.point[1]-t.z)<2.5));
  const allowTree=grotteTreeFilter(world),open=p=>!(world.clearAreas||[]).some(a=>inBuilding([p.x,p.z],a));return {lamps:lamps.filter(open),signs:signs.filter(open),trees:filtered.filter(open).filter(p=>allowTree(p.x,p.z)),junctions:junction,clear};
}
