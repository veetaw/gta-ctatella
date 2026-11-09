import {worldLocation} from '../src/game-locations.js';
import ClipperLib from 'clipper-lib';
import fs from 'node:fs/promises';import * as shp from 'shapefile';import sharp from 'sharp';import proj4 from 'proj4';
import {auditDBT} from './audit-dbt.mjs';import {inside,nearest} from '../src/world-math.js';
const DIR='assets/DBT_5K/DBT',TIFF='assets/images-fcbaf2ic96/469092.tif';
const clean=s=>String(s??'').replaceAll('\x00','').trim();
const inRings=(p,r)=>inside(p,r[0])&&!r.slice(1).some(r=>inside(p,r));
const area=r=>Math.abs(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);
async function table(name){const reader=await shp.openDbf(`${DIR}/${name}.dbf`,{encoding:'windows-1252'}),out=[];for(;;){const r=await reader.read();if(r.done)return out;out.push(r.value);}}
export async function enrichHeritage(world){
 const audit=await auditDBT();
 const uses=new Map();for(const row of await table('EDIFC_EDIFC_USO')){if(!uses.has(row.CLASSREF))uses.set(row.CLASSREF,[]);uses.get(row.CLASSREF).push(clean(row.EDIFC_USO));}
 const attrs=new Map((await table('EDIFC')).map(row=>[row.CLASSID,row]));
 const usageNames=new Map(audit.domains.H_EDIFC_CATEGORIA_USO.map(d=>[clean(d.CODE),clean(d.NAME)]));
 const typeNames=new Map(audit.domains.H_EDIFC_TIPOLOGIA_EDILIZIA.map(d=>[clean(d.CODE),clean(d.NAME)]));
 const ponte=world.roads.filter(r=>/ponte/i.test(r.name));
 const distanceToPonte=p=>Math.min(...ponte.flatMap(r=>r.points.slice(1).map((q,i)=>nearest(p,r.points[i],q).d)));
 for(const b of world.buildings){const attr=attrs.get(b.id)||{},codes=uses.get(b.id)||[];b.dbt={type:clean(attr.EDIFC_TY),typeLabel:typeNames.get(clean(attr.EDIFC_TY))||'',uses:codes,useLabels:codes.map(c=>usageNames.get(c)||c)};
  const name=clean(b.name),label=`${name} ${b.dbt.typeLabel} ${b.dbt.useLabels.join(' ')}`;
  b.classification=b.dbt.type==='07'?'bell-tower':/chiesa|cattedrale|culto/i.test(label)||codes.includes('05')?'church':/municipio/i.test(label)||codes.includes('0201')?'town-hall':/scuola|istruzione/i.test(label)||codes.some(c=>c.startsWith('0303'))?'school':codes.some(c=>c.startsWith('02')||c.startsWith('03'))?'public':'residential';
  b.classificationEvidence={source:'DBT EDIFC + EDIFC_USO + EDIFC_NOME',typeCode:b.dbt.type,useCodes:codes};
  if(b.classification==='church'&&b.area>25){b.height=9.2;b.roofY=b.maxGroundY+7.4;b.heightSource='church single-nave estimate (9.2 m to ridge)';b.church={wallHeight:7.4,ridgeRise:1.8,ridgeY:b.maxGroundY+9.2,frontEdge:null,hasShutters:false};}
 }
 const church=world.buildings.filter(b=>b.classification==='church'&&b.area>25).sort((a,b)=>distanceToPonte([(a.bounds[0]+a.bounds[2])/2,(a.bounds[1]+a.bounds[3])/2])-distanceToPonte([(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2]))[0];
 if(!church||distanceToPonte([(church.bounds[0]+church.bounds[2])/2,(church.bounds[1]+church.bounds[3])/2])>50)throw Error('DBT church near Via Ponte not found');
 church.landmarkRole='ponte-church';
 const target='+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs';
 const surfaces=[];
 for(const layer of ['AC_PED_AC_PED_SUP_SR','AC_VEI_AC_VEI_SUP_SR','AR_STR_AR_STR_SUP_SR']){
  const converter=proj4(await fs.readFile(`${DIR}/${layer}.prj`,'utf8'),target);const f=(await shp.read(`${DIR}/${layer}.shp`,undefined,{encoding:'windows-1252'})).features;
  for(const feature of f){const polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];for(const polygon of polygons){const rings=polygon.map(r=>r.map(p=>{const [x,y]=converter.forward(p);return [Math.round((x-world.origin.x)*1000)/1000,Math.round(-(y-world.origin.y)*1000)/1000];}));const p=rings.flat(),bounds=[Math.min(...p.map(p=>p[0])),Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[0])),Math.max(...p.map(p=>p[1]))];if(bounds[0]<world.terrain.minX||bounds[2]>world.terrain.maxX||bounds[1]<world.terrain.minZ||bounds[3]>world.terrain.maxZ)continue;
   surfaces.push({id:`${layer}/${feature.properties.SUBREGID||feature.properties.CLASSREF}/${surfaces.length}`,layer,rings,bounds,area:area(rings[0])-rings.slice(1).reduce((s,r)=>s+area(r),0),dbt:feature.properties});
  }}
 }
 console.log('Analyzing native orthophoto at 0.4 m for road/square classification…');
 const meta=await sharp(TIFF,{limitInputPixels:false}).metadata();const [gx0,gy0,gx1,gy1]=world.provenance.orthophotoBounds;
 const raw=await sharp(TIFF,{limitInputPixels:false,sequentialRead:true}).resize(Math.ceil(meta.width/2),Math.ceil(meta.height/2),{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const pixel=(x,z)=>{const X=world.origin.x+x,Y=world.origin.y-z,u=Math.max(1,Math.min(raw.info.width-2,Math.floor((X-gx0)/(gx1-gx0)*raw.info.width))),v=Math.max(1,Math.min(raw.info.height-2,Math.floor((gy1-Y)/(gy1-gy0)*raw.info.height))),i=(v*raw.info.width+u)*raw.info.channels;return [raw.data[i],raw.data[i+1],raw.data[i+2],u,v];};
 const lum=(u,v)=>{const i=(v*raw.info.width+u)*raw.info.channels;return raw.data[i]*.2126+raw.data[i+1]*.7152+raw.data[i+2]*.0722;};
 function statistics(points){let count=0,sum=0,sum2=0,contrast=0,white=0,neutral=0,r=0,g=0,b=0;for(const p of points){const [R,G,B,u,v]=pixel(...p),y=lum(u,v),saturation=Math.max(R,G,B)-Math.min(R,G,B);count++;sum+=y;sum2+=y*y;r+=R;g+=G;b+=B;contrast+=(Math.abs(y-lum(u+1,v))+Math.abs(y-lum(u,v+1)))/2;if(y>128&&saturation<36)white++;if(saturation<42)neutral++;}return {samples:count,meanRGB:count?[r/count,g/count,b/count]:[0,0,0],meanLuminance:sum/(count||1),variance:Math.max(0,sum2/(count||1)-(sum/(count||1))**2),localContrast:contrast/(count||1),whiteFraction:white/(count||1),neutralFraction:neutral/(count||1),analysisResolutionMeters:.4};}
 function polygonStatistics(s){const points=[],step=Math.max(.4,Math.sqrt(s.area/1600));for(let z=s.bounds[1]+step/2;z<s.bounds[3];z+=step)for(let x=s.bounds[0]+step/2;x<s.bounds[2];x+=step)if(inRings([x,z],s.rings))points.push([x,z]);return statistics(points);}
 for(const surface of surfaces)surface.image=polygonStatistics(surface);
 for(const road of world.roads){const samples=[];for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(length/1.5)),nx=-(b[1]-a[1])/(length||1),nz=(b[0]-a[0])/(length||1);for(let j=0;j<n;j++)for(const offset of [-1.4,0,1.4])samples.push([a[0]+(b[0]-a[0])*j/n+nx*offset,a[1]+(b[1]-a[1])*j/n+nz*offset]);}road.image=statistics(samples);const zone=surfaces.find(s=>s.layer.startsWith('AC_VEI')&&s.dbt.AC_VEI_ZON==='0105'&&road.points.some(p=>inRings(p,s.rings)));road.surface=zone&&road.image.neutralFraction>.5?'stone':'asphalt';road.surfaceEvidence=zone?'DBT vicolo + orthophoto neutral stone texture':'ordinary carriageway; conservative default';}
 const churchCenter=[(church.bounds[0]+church.bounds[2])/2,(church.bounds[1]+church.bounds[3])/2];
 const candidates=surfaces.filter(s=>s.layer.startsWith('AC_VEI')&&s.area>65&&Math.min(s.bounds[2]-s.bounds[0],s.bounds[3]-s.bounds[1])>7&&['0204','0205'].includes(s.dbt.AC_VEI_ZON));
 const primary=candidates.sort((a,b)=>Math.hypot((a.bounds[0]+a.bounds[2])/2-churchCenter[0],(a.bounds[1]+a.bounds[3])/2-churchCenter[1])-Math.hypot((b.bounds[0]+b.bounds[2])/2-churchCenter[0],(b.bounds[1]+b.bounds[3])/2-churchCenter[1]))[0];
 if(!primary)throw Error('Via Ponte square DBT polygon not found');
 const plazaCenter=[(primary.bounds[0]+primary.bounds[2])/2,(primary.bounds[1]+primary.bounds[3])/2];
 world.pavingAreas=[];await fs.mkdir('public/paving',{recursive:true});
 async function addArea(s,type,role=null){const index=world.pavingAreas.length,margin=2,bounds=[s.bounds[0]-margin,s.bounds[1]-margin,s.bounds[2]+margin,s.bounds[3]+margin];const native={left:Math.max(0,Math.floor((world.origin.x+bounds[0]-gx0)/.2)),top:Math.max(0,Math.floor((gy1-world.origin.y+bounds[1])/.2)),width:Math.ceil((bounds[2]-bounds[0])/.2),height:Math.ceil((bounds[3]-bounds[1])/.2)};const geobounds=[gx0+native.left*.2-world.origin.x,world.origin.y-(gy1-native.top*.2),gx0+(native.left+native.width)*.2-world.origin.x,world.origin.y-(gy1-(native.top+native.height)*.2)];const name=`/paving/area-${index}.jpg`;await sharp(TIFF,{limitInputPixels:false}).extract(native).normalize({lower:1,upper:99}).linear(1.08,-3).sharpen({sigma:.7,m1:.5,m2:1.5}).resize({width:Math.max(512,Math.min(2048,native.width*2))}).jpeg({quality:96,chromaSubsampling:'4:4:4'}).toFile(`public${name}`);world.pavingAreas.push({...s,id:`paving-${index}`,dbtId:s.id,surface:type,role,photo:{url:name,bounds:geobounds,nativePixels:[native.width,native.height],nativeMetersPerPixel:.2},confidence:role?'DBT junction beside named church + visually verified radial orthophoto pattern':'DBT surface zone + image statistics'});}
 // Basolato exists only inside the finite GPS road corridor. Union the DBT
 // surfaces first so adjoining polygons cannot generate duplicate road layers.
 for(const road of world.roads){road.surface='asphalt';road.surfaceEvidence='Standard residential asphalt; stone is limited by the GPS corridor mask';}
 const scale=1000,toPath=r=>r.slice(0,-1).map(p=>({X:Math.round(p[0]*scale),Y:Math.round(p[1]*scale)}));
 const offset=new ClipperLib.ClipperOffset(2,.05*scale),buffers=[];
 offset.AddPath(world.cellarDistrict.route.map(p=>({X:Math.round(p[0]*scale),Y:Math.round(p[1]*scale)})),ClipperLib.JoinType.jtRound,ClipperLib.EndType.etOpenButt);offset.Execute(buffers,2.6*scale);
 const plaza=surfaces.find(s=>s.layer.startsWith('AC_VEI')&&s.dbt.AC_VEI_ZON==='0205'&&inRings(world.cellarDistrict.plaza,s.rings));
 if(!plaza)throw Error('Surveyed cellar piazzetta not found at user GPS');
 buffers.push(...plaza.rings.map(toPath));
 world.cellarDistrict.plazaDbtId=plaza.id;
 const clipper=new ClipperLib.Clipper(),tree=new ClipperLib.PolyTree();
 clipper.AddPaths(surfaces.filter(s=>s.layer.startsWith('AC_VEI')).flatMap(s=>s.rings.map(toPath)),ClipperLib.PolyType.ptSubject,true);
 clipper.AddPaths(buffers,ClipperLib.PolyType.ptClip,true);
 clipper.Execute(ClipperLib.ClipType.ctIntersection,tree,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
 for(const piece of ClipperLib.JS.PolyTreeToExPolygons(tree)){const rings=[piece.outer,...piece.holes].map(r=>{const p=r.map(v=>[v.X/scale,v.Y/scale]);return [...p,p[0]];}),ps=rings.flat(),bounds=[Math.min(...ps.map(p=>p[0])),Math.min(...ps.map(p=>p[1])),Math.max(...ps.map(p=>p[0])),Math.max(...ps.map(p=>p[1]))];
 await addArea({id:'gps-cellar-route',rings,bounds,area:area(rings[0])-rings.slice(1).reduce((sum,r)=>sum+area(r),0)},'stone','historic-cellar-street');}
 const croce=worldLocation(world.origin,{lat:40.6586315,lon:15.4011607}),croceSurface=surfaces.filter(s=>s.layer.startsWith('AC_VEI')&&inRings([croce.x,croce.z],s.rings)).sort((a,b)=>a.area-b.area)[0];
 if(croceSurface){const c=new ClipperLib.Clipper(),tree=new ClipperLib.PolyTree();c.AddPaths(croceSurface.rings.map(toPath),ClipperLib.PolyType.ptSubject,true);c.AddPath([[croce.x-19,croce.z-17],[croce.x+19,croce.z-17],[croce.x+19,croce.z+17],[croce.x-19,croce.z+17]].map(p=>({X:Math.round(p[0]*scale),Y:Math.round(p[1]*scale)})),ClipperLib.PolyType.ptClip,true);c.Execute(ClipperLib.ClipType.ctIntersection,tree,ClipperLib.PolyFillType.pftEvenOdd,ClipperLib.PolyFillType.pftEvenOdd);for(const piece of ClipperLib.JS.PolyTreeToExPolygons(tree)){const rings=[piece.outer,...piece.holes].map(r=>{const p=r.map(v=>[v.X/scale,v.Y/scale]);return [...p,p[0]];}),ps=rings.flat(),bounds=[Math.min(...ps.map(p=>p[0])),Math.min(...ps.map(p=>p[1])),Math.max(...ps.map(p=>p[0])),Math.max(...ps.map(p=>p[1]))];await addArea({...croceSurface,rings,bounds},'dark-stone','piazza-croce');}}
 world.pavingDistricts=[];world.cellarDistrict.plazaAreaIds=world.pavingAreas.filter(a=>inRings(world.cellarDistrict.plaza,a.rings)).map(a=>{a.role='cellar-main-plaza';return a.id;});
 for(const b of world.buildings.filter(b=>b.church)){
   const ring=b.rings[0],center=[(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2];let best=-Infinity,edge=0;for(let i=1;i<ring.length;i++){const a=ring[i-1],c=ring[i],length=Math.hypot(c[0]-a[0],c[1]-a[1]);if(length<3)continue;const mid=[(a[0]+c[0])/2,(a[1]+c[1])/2];let score=-Math.min(...world.roads.flatMap(r=>r.points.slice(1).map((q,j)=>nearest(mid,r.points[j],q).d)))-length*.03;if(b===church)score=-Math.hypot(mid[0]-plazaCenter[0],mid[1]-plazaCenter[1]);if(score>best){best=score;edge=i-1;}}b.church.frontEdge=edge;b.church.frontFaces=b===church?plazaCenter:null;
 }
 
 world.heritage={viaPonteChurchId:church.id,viaPonteSquareId:null,plazaCenter,sourceAudit:{shapefiles:audit.shapes.length,dbfTables:audit.tables.length},classificationNotes:'Stone exclusively clipped to the user GPS route; ordinary asphalt throughout the rest of the village.'};
 world.surfaceCatalog=surfaces.map(s=>({id:s.id,layer:s.layer,bounds:s.bounds,area:s.area,dbt:s.dbt,image:s.image}));
 await fs.writeFile('artifacts/heritage-analysis.json',JSON.stringify({heritage:world.heritage,churches:world.buildings.filter(b=>b.classification==='church').map(b=>({id:b.id,name:b.name,dbt:b.dbt,church:b.church})),paving:world.pavingAreas.map(p=>({id:p.id,role:p.role,area:p.area,dbt:p.dbt,image:p.image,photo:p.photo})),roadSurfaces:world.roads.reduce((a,r)=>(a[r.surface]=(a[r.surface]||0)+1,a),{})},null,2));
 console.log('Heritage:',JSON.stringify({church:church.id,name:church.name,square:primary.id,pavingAreas:world.pavingAreas.length,churchCount:world.buildings.filter(b=>b.classification==='church').length}));
 return world;
}
