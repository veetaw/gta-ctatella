import fs from 'node:fs/promises';import sharp from 'sharp';import * as shp from 'shapefile';
const w=JSON.parse(await fs.readFile('public/world-data.json'));const center=[1150,350],size=[530,550],bounds=[center[0]-size[0]/2,center[1]-size[1]/2,center[0]+size[0]/2,center[1]+size[1]/2];
const left=Math.round((w.origin.x+bounds[0]-531520)/.2),top=Math.round((4502750-(w.origin.y-bounds[1]))/.2);const width=Math.round(size[0]/.2),height=Math.round(size[1]/.2);
await sharp('assets/images-fcbaf2ic96/469092.tif',{limitInputPixels:false}).extract({left,top,width,height}).resize({width:1400}).jpeg({quality:94}).toFile('artifacts/ponte-overview.jpg');
const names=new Map();for(const n of ['EDIFC_EDIFC_NOME','EDIFC_EDIFC_USO']){const r=await shp.openDbf(`assets/DBT_5K/DBT/${n}.dbf`,{encoding:'windows-1252'});for(;;){const d=await r.read();if(d.done)break;names.set(d.value.CLASSREF,{...names.get(d.value.CLASSREF),...d.value});}}
console.log(w.buildings.filter(b=>{const p=[(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2];return p[0]>bounds[0]&&p[0]<bounds[2]&&p[1]>bounds[1]&&p[1]<bounds[3];}).map(b=>({id:b.id,area:b.area,bounds:b.bounds,...names.get(b.id)})));
