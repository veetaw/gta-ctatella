import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fromFile} from 'geotiff';
import {open,openShp} from 'shapefile';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {createTeglieRoadNetwork,nearOriginalEdge} from '../src/teglie-world.js';
import {createRoadNetwork} from '../src/road-network.js';
import {bankBatches} from '../src/road-banks.js';
import {packTeglieBanks} from './pack-teglie-banks.mjs';
import {roadRoute} from '../src/procession-route.js';
import {regionalTerrain} from './teglie-dtm.mjs';
import {worldLocation} from '../src/game-locations.js';

const inputs='tmp/teglie-world',output='public/teglie';
const base=JSON.parse(await readFile('public/world-data.json','utf8'));
const {origin}=base;
const raster=await (await fromFile(inputs+'/terrain.tif')).getImage();
const [west,south,east,north]=raster.getBoundingBox();
// The old raster supplies the orthophoto footprint only. All heights come from the regional sheets.
const photoBounds={minX:west-origin.x,maxX:east-origin.x,minZ:origin.y-north,maxZ:origin.y-south};
const {terrain,covered:measured,sheets,gapAt}=regionalTerrain(origin,photoBounds);
const bounds=base.terrain;
const original=([x,z])=>x>=bounds.minX&&x<=bounds.maxX&&z>=bounds.minZ&&z<=bounds.maxZ;
const covered=([x,z])=>x>=terrain.minX&&x<=terrain.maxX&&z>=terrain.minZ&&z<=terrain.maxZ;
const local=([x,y])=>[Math.round((x-origin.x)*100)/100,Math.round((origin.y-y)*100)/100];
async function* features(layer){
 const reader=await openShp(`assets/DBT_5K/DBT/${layer}.shp`);
 for(let row=await reader.read();!row.done;row=await reader.read())if(row.value)yield row.value;
}

const center=worldLocation(origin,{lat:40.6743718,lon:15.348612});
const roads=[];
const baseIds=new Set(base.roads.map(road=>String(road.id)));
const streetNames=new Map(base.roads.map(road=>[String(road.id),road.name]));
async function appendRoads(reader,target,municipality){
 for(let row=await reader.read();!row.done;row=await reader.read()){
  const {geometry,properties}=row.value;
  if(!geometry)continue;
  const id=String(properties.CLASSID),inBase=baseIds.has(id);
  if(municipality==='Buccino'&&inBase)continue;
  for(const line of geometry.type==='MultiLineString'?geometry.coordinates:[geometry.coordinates]){
   const points=line.map(([x,y])=>[Math.round((x-origin.x)*1000)/1000,Math.round((origin.y-y)*1000)/1000]);
   let run=[];
   function flush(){
    if(run.length>1)target.push({id:`${municipality}-${target.length}`,sourceId:id,points:run,width:id==='01000089945'?9.2:inBase?5.2:4.8,name:streetNames.get(id)||'Strada locale',source:'DBT_5K',municipality});
    run=[];
   }
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(!covered(a)||!covered(b)||inBase&&original(a)&&original(b)){flush();continue;}
    if(!run.length)run.push(a);
    run.push(b);
   }
   flush();
  }
 }
}
await appendRoads(await open('assets/DBT_5K/DBT/EL_STR.shp'),roads,'San Gregorio Magno');

const archive='assets/DBT_5K_BUCCINO.zip';
const fromArchive=extension=>execFileSync('unzip',['-p',archive,`DBT/EL_STR.${extension}`],{maxBuffer:20e6});
const dbtProjection=await readFile('assets/DBT_5K/DBT/EL_STR.prj');
if(!dbtProjection.equals(fromArchive('prj')))throw Error('I DBT usano sistemi di riferimento diversi');
const candidates=[];
await appendRoads(await open(fromArchive('shp'),fromArchive('dbf')),candidates,'Buccino');

const buildings=[];
const originalBuildings=new Set(base.buildings.map(b=>b.rings[0].map(p=>p.map(v=>Math.round(v)).join(',')).sort().join(';')));
for await(const geometry of features('EDIFC_CR_EDF_ME')){
 for(const polygon of geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates]){
  const rings=polygon.map(ring=>ring.map(local)),points=rings.flat();
  if(rings[0].length<4||!points.every(covered)||points.every(original))continue;
  if(originalBuildings.has(rings[0].map(p=>p.map(v=>Math.round(v)).join(',')).sort().join(';')))continue;
  const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
  buildings.push({id:`teglie-building-${buildings.length}`,rings,bounds:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)]});
 }
}

const details=[];
for(const [layer,category] of [['EL_DIV','fence'],['MU_DIV_MU_DIV_SUP_L','wall'],['MU_SOS_MSOS_SUP_L','retaining-wall'],['MN_ARR','lamp'],['ALBERO','tree']]){
 const reader=await open(`assets/DBT_5K/DBT/${layer}.shp`);
 for(let row=await reader.read();!row.done;row=await reader.read()){
  const {geometry,properties}=row.value;
  if(!geometry||category==='lamp'&&properties.MN_ARR_TY!=='0202')continue;
  const {type,coordinates}=geometry;
  const point=type.includes('Point');
  const parts=type==='Point'?[[coordinates]]:type==='MultiPoint'?coordinates.map(p=>[p]):type==='LineString'?[coordinates]:type==='MultiLineString'?coordinates:[];
  for(const part of parts){
   const points=part.map(local);
   if(!points.every(covered)||points.every(original))continue;
   const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
   details.push({id:`teglie-dbt-${details.length}`,category,properties,
    bounds:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)],
    ...(point?{point:points[0]}:{points})});
  }
 }
}

const candidateRoute=roadRoute({roads:[...base.roads,...roads,...candidates]},base.spawn,center,{margin:1400});
const connectors=candidates.filter(road=>candidateRoute.roadIds.has(road.id));
if(!connectors.length)throw Error('Nessun raccordo di Buccino selezionato');
roads.push(...connectors);
const link=roadRoute({roads:[...base.roads,...roads]},base.spawn,center,{margin:1400});
const arrival=link.points.at(-2);
const worstGap=Math.max(...link.points.filter(p=>covered([p.x,p.z])).map(p=>gapAt(p.x,p.z)));
if(worstGap>15)throw Error(`Copertura DTM insufficiente lungo il raccordo: ${worstGap} m`);
const gate=link.points.find(p=>Math.hypot(p.x-center.x,p.z-center.z)<510);
if(!gate)throw Error('Ingresso di Teglie non trovato');
if(Math.hypot(arrival.x-center.x,arrival.z-center.z)>100||link.length>9000)throw Error('Percorso per Teglie non plausibile');
console.log('Raccordo Buccino:',connectors.map(r=>[r.sourceId,r.points.length]), 'distanza dal centro:',Math.round(Math.hypot(arrival.x-center.x,arrival.z-center.z)));
await mkdir(output,{recursive:true});
const bankNetwork=createTeglieRoadNetwork(base,{terrain,roads},createRoadNetwork(base));
function* bankVertices(){
 for(const {positions,seals} of bankBatches(bankNetwork,(a,b)=>!nearOriginalEdge(base.terrain,a,b))){
  yield positions;yield seals;
 }
}
await writeFile(output+'/banks-v1.pack',packTeglieBanks(bankVertices()));
await writeFile(output+'/world.pack',gzipSync(JSON.stringify({terrain,photoBounds,roads,buildings,details,provenance:{roads:'DBT_5K/EL_STR',buccinoConnectorIds:connectors.map(r=>r.sourceId),terrain:sheets,measured},bakedBanks:true,center,arrival:{x:arrival.x,z:arrival.z},gate:{x:gate.x,z:gate.z}}),{level:9}));
await sharp(inputs+'/ortofoto.jpg').webp({quality:82}).toFile(output+'/ortofoto.webp');
console.log(`Teglie e corridoio: ${roads.length} tratti, ${buildings.length} edifici, ${details.length} elementi DBT, ${terrain.cols} × ${terrain.rows} quote; collegamento ${Math.round(link.length)} m.`);
