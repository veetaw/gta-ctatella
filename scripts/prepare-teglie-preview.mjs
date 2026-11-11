import {readFile,writeFile} from 'node:fs/promises';
import {fromFile} from 'geotiff';
import {openShp} from 'shapefile';

const directory='tmp/teglie-corridor';
const {origin,terrain:currentTerrain}=JSON.parse(await readFile('public/world-data.json','utf8'));
const raster=await (await fromFile(`${directory}/terrain.tif`)).getImage();
const [west,south,east,north]=raster.getBoundingBox();
const cols=raster.getWidth(),rows=raster.getHeight(),cell=(east-west)/cols;
const heights=Array.from(await raster.readRasters({samples:[0],interleave:true}));
if(heights.some(y=>!Number.isFinite(y)||y<1||y>1500))throw Error('Quote mancanti o fuori intervallo');
const terrain={cols,rows,cell,minX:west+cell/2-origin.x,maxX:east-cell/2-origin.x,
 minZ:origin.y-north+cell/2,maxZ:origin.y-south-cell/2,heights};

function local([x,y]){return [x-origin.x,origin.y-y];}
function contains([x,z]){return x>=terrain.minX&&x<=terrain.maxX&&z>=terrain.minZ&&z<=terrain.maxZ;}
async function geometries(layer){
 const reader=await openShp(`assets/DBT_5K/DBT/${layer}.shp`),result=[];
 for(let row=await reader.read();!row.done;row=await reader.read())if(row.value)result.push(row.value);
 return result;
}

const roads=[];
for(const geometry of await geometries('EL_STR')){
 const lines=geometry.type==='MultiLineString'?geometry.coordinates:[geometry.coordinates];
 for(const line of lines){
  let points=[];
  for(let i=1;i<line.length;i++){
   const a=local(line[i-1]),b=local(line[i]);
   const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4));
   for(let j=i===1?0:1;j<=steps;j++){
    const f=j/steps,point=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
    if(contains(point))points.push(point);
    else{if(points.length>1)roads.push(points);points=[];}
   }
  }
  if(points.length>1)roads.push(points);
 }
}

const buildings=[];
let borderBuildings=0;
for(const geometry of await geometries('EDIFC_CR_EDF_ME')){
 const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];
 for(const polygon of polygons){
  const rings=polygon.map(ring=>ring.map(local));
  if(rings[0].length<4)continue;
  if(rings.every(ring=>ring.every(contains)))buildings.push(rings);
  else if(rings.some(ring=>ring.some(contains)))borderBuildings++;
 }
}

await writeFile(`${directory}/zone.json`,JSON.stringify({origin,terrain,roads,buildings,currentWest:currentTerrain.minX,borderBuildings}));
const [lowest,highest]=heights.reduce(([low,high],height)=>[Math.min(low,height),Math.max(high,height)],[Infinity,-Infinity]);
console.log(`Corridoio di Teglie: ${roads.length} tratti stradali, ${buildings.length} sagome, quote ${lowest.toFixed(1)}–${highest.toFixed(1)} m.`);
