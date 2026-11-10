import {createRoadNetwork} from './road-network.js';

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const inBounds=(x,z,t)=>x>=t.minX&&x<=t.maxX&&z>=t.minZ&&z<=t.maxZ;

function sampleRaster(t,x,z){
 const u=clamp((x-t.minX)/t.cell,0,t.cols-1),v=clamp((z-t.minZ)/t.cellZ,0,t.rows-1);
 const col=Math.min(Math.floor(u),t.cols-2),row=Math.min(Math.floor(v),t.rows-2);
 const i=row*t.cols+col;
 const a=lerp(t.heights[i],t.heights[i+1],u-col);
 const b=lerp(t.heights[i+t.cols],t.heights[i+t.cols+1],u-col);
 return lerp(a,b,v-row);
}

export function createTeglieRoadNetwork(world,zone,originalNetwork){
 const original=world.terrain,t=zone.terrain;
 const inside=(x,z)=>inBounds(x,z,original);
 const groundHeight=(x,z)=>{
  const bx=clamp(x,original.minX,original.maxX),bz=clamp(z,original.minZ,original.maxZ);
  const d=Math.hypot(x-bx,z-bz),raw=sampleRaster(t,x,z);
  if(d>=75)return raw;
  return raw+(originalNetwork.elevationAt(bx,bz)-sampleRaster(t,bx,bz))*(1-d/75);
 };
 const roadTerrain={...t,heights:new Float32Array(t.cols*t.rows)};
 for(let row=0;row<t.rows;row++)for(let col=0;col<t.cols;col++){
  const x=t.minX+col*t.cell,z=t.minZ+row*t.cell;
  roadTerrain.heights[row*t.cols+col]=inside(x,z)?originalNetwork.elevationAt(x,z):groundHeight(x,z);
 }
 return createRoadNetwork({origin:world.origin,terrain:roadTerrain,roads:zone.roads,buildings:[]});
}
