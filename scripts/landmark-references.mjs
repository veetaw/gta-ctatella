import proj4 from 'proj4';
import {nearest} from '../src/world-math.js';
export const CELLAR_STREETS=/\bbacco\b|san\s+zaccaria|cantina\s+arenara|rimembranza/i;
const references=[['mother-church',40.6562461,15.4052461],['san-zaccaria-east',40.6554642,15.405682],['san-zaccaria-west',40.656227,15.4048453],['cantina-arenara-east',40.6554262,15.4037837],['cantina-arenara-west',40.6554131,15.4017859],['rimembranza',40.6555151,15.4007758]];
export function installLandmarkReferences(world){world.landmarkReferences=references.map(([id,lat,lon])=>{const [X,Y]=proj4('EPSG:4326','+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs',[lon,lat]);return {id,gps:{lat,lon},x:X-world.origin.x,z:-(Y-world.origin.y)};});}
export function finalizeLandmarks(world){
 const ref=world.landmarkReferences[0],p=[ref.x,ref.z],candidates=world.buildings.filter(b=>b.classification==='church'&&/madre/i.test(b.name||''));
 const distance=b=>Math.min(...b.rings[0].slice(1).map((v,i)=>nearest(p,b.rings[0][i],v).d));const b=candidates.sort((a,b)=>distance(a)-distance(b))[0];if(!b||distance(b)>50)throw Error('Chiesa Madre DBT non trovata vicino al riferimento GPS');
 let edge=0,best=Infinity;for(let i=1;i<b.rings[0].length;i++){const a=b.rings[0][i-1],c=b.rings[0][i],length=Math.hypot(c[0]-a[0],c[1]-a[1]);if(length<5)continue;const d=nearest(p,a,c).d;if(d<best){best=d;edge=i-1;}}
 b.landmarkRole='mother-church';b.church={...b.church,variant:'mother-church',frontEdge:edge,frontFaces:p,wallHeight:9.2,ridgeRise:2.4,ridgeY:b.maxGroundY+11.6,facadeColor:'#e6d3a3',roofColor:'#aa5037',portalCount:3,upperWindows:2};b.roofY=b.maxGroundY+9.2;b.height=11.6;b.heightSource='Dedicated landmark proportions; footprint from DBT, elevations estimated';b.referenceGPS=ref.gps;
 const center=[(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2],tower=world.buildings.filter(t=>t.classification==='bell-tower').sort((a,b)=>Math.hypot((a.bounds[0]+a.bounds[2])/2-center[0],(a.bounds[1]+a.bounds[3])/2-center[1])-Math.hypot((b.bounds[0]+b.bounds[2])/2-center[0],(b.bounds[1]+b.bounds[3])/2-center[1]))[0];
 if(!tower||Math.hypot((tower.bounds[0]+tower.bounds[2])/2-center[0],(tower.bounds[1]+tower.bounds[3])/2-center[1])>45)throw Error('Campanile DBT della Chiesa Madre non trovato');
 tower.landmarkRole='mother-church-tower';tower.height=19;tower.roofY=tower.maxGroundY+23;tower.tower={shaftHeight:14,belfryHeight:4,spireHeight:4,wallColor:'#e6d3a3',parentChurchId:b.id};b.church.towerId=tower.id;
 world.heritage.motherChurch={buildingId:b.id,towerId:tower.id,reference:ref,referenceToFootprintMeters:distance(b),positionPolicy:'GPS is an approach reference on the square; surveyed church and tower footprints are preserved exactly.',proportions:'Facade and heights reconstructed from requested details; no measured facade survey supplied.'};
}
