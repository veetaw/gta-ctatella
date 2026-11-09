import {fromFile} from 'geotiff';
import earcut,{flatten} from 'earcut';
import {inBuilding} from '../src/world-math.js';
import {SpatialIndex} from '../src/road-network.js';
export function robustColor(samples,fallback='#c6b79e'){
 const clean=samples.filter(([r,g,b])=>r+g+b>45&&!(g>r*1.16&&g>b*1.12));
 if(!clean.length)return fallback;
 const sorted=clean.map(c=>({c,l:c[0]*.2126+c[1]*.7152+c[2]*.0722})).sort((a,b)=>a.l-b.l),lo=Math.floor(sorted.length*.18),hi=Math.max(lo+1,Math.ceil(sorted.length*.88)),kept=sorted.slice(lo,hi);
 return '#'+[0,1,2].map(k=>Math.round(kept.reduce((s,p)=>s+p.c[k],0)/kept.length).toString(16).padStart(2,'0')).join('');
}
export async function sampleBuildingColors(world,minorBuildings=[]){
 const file='assets/images-fcbaf2ic96/469092.tif',tif=await fromFile(file);
 try{
 const image=await tif.getImage(),bbox=image.getBoundingBox(),width=image.getWidth(),height=image.getHeight(),pixelX=(bbox[2]-bbox[0])/width,pixelY=(bbox[3]-bbox[1])/height,groups=new Map(),index=new SpatialIndex(20),plans=[];let requested=0;
 const buildings=[...world.buildings,...minorBuildings];for(const b of buildings)index.insert(b,b.bounds);
 function request(point,target){const x=Math.floor((world.origin.x+point[0]-bbox[0])/pixelX),y=Math.floor((bbox[3]-(world.origin.y-point[1]))/pixelY);if(x<0||y<0||x>=width||y>=height)return;const key=`${Math.floor(x/512)},${Math.floor(y/512)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({x,y,target});requested++;}
 for(const b of buildings){
  let center=[(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2];
  if(!inBuilding(center,b)){const f=flatten(b.rings),ids=earcut(f.vertices,f.holes,2);let largest=-1;for(let i=0;i<ids.length;i+=3){const p=ids.slice(i,i+3).map(k=>[f.vertices[k*2],f.vertices[k*2+1]]),area=Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]));if(area>largest){largest=area;center=[(p[0][0]+p[1][0]+p[2][0])/3,(p[0][1]+p[1][1]+p[2][1])/3];}}}
  const plan={building:b,center,roof:[],centerPixel:[],edges:[]};request(center,plan.centerPixel);
  for(const dx of [-.3,0,.3])for(const dz of [-.3,0,.3]){const p=[center[0]+dx,center[1]+dz];if(inBuilding(p,b))request(p,plan.roof);}
  for(let ri=0;ri<b.rings.length;ri++)for(let i=1;i<b.rings[ri].length;i++){
   const a=b.rings[ri][i-1],c=b.rings[ri][i],length=Math.hypot(c[0]-a[0],c[1]-a[1]);if(length<.08)continue;let nx=(c[1]-a[1])/length,nz=-(c[0]-a[0])/length;const mid=[(a[0]+c[0])/2,(a[1]+c[1])/2];if(inBuilding([mid[0]+nx*.1,mid[1]+nz*.1],b)){nx=-nx;nz=-nz;}
   const edge={ring:ri,edge:i-1,samples:[]},count=Math.min(128,Math.max(2,Math.ceil(length/1.25)));
   for(let j=0;j<count;j++)for(const offset of [.35,.8,1.35]){const f=(j+.5)/count,p=[a[0]+(c[0]-a[0])*f+nx*offset,a[1]+(c[1]-a[1])*f+nz*offset];if(index.point(...p).some(other=>inBuilding(p,other)))continue;request(p,edge.samples);}
   plan.edges.push(edge);
  }
  plans.push(plan);
 }
 // Read native 20 cm pixels in small windows; never allocate the 1 GB raster.
 for(const [key,points]of groups){const [tx,ty]=key.split(',').map(Number),x=tx*512,y=ty*512,w=Math.min(512,width-x),h=Math.min(512,height-y),rgb=await image.readRasters({window:[x,y,x+w,y+h],samples:[0,1,2],interleave:true});for(const p of points){const i=((p.y-y)*w+p.x-x)*3;p.target.push([rgb[i],rgb[i+1],rgb[i+2]]);}}
 let perimeterSamples=0,roofSamples=0;for(const p of plans){const b=p.building,all=p.edges.flatMap(e=>e.samples);b.roofColor=robustColor(p.roof,'#a46b4d');b.wallColor=robustColor(all);b.facadeColors=p.edges.map(e=>({ring:e.ring,edge:e.edge,color:robustColor(e.samples,b.wallColor),samples:e.samples.length}));b.colorSampling={roofPoint:p.center.map(v=>Math.round(v*1000)/1000),roofPixel:robustColor(p.centerPixel,b.roofColor),roofSamples:p.roof.length,perimeterSamples:all.length};if(world.historicCellars?.minorRecords[b.id])Object.assign(world.historicCellars.minorRecords[b.id],{roofColor:b.roofColor,wallColor:b.wallColor,facadeColors:b.facadeColors,colorSampling:b.colorSampling});perimeterSamples+=all.length;roofSamples+=p.roof.length;}
 world.provenance.buildingColors={source:file,pixelSizeMeters:[pixelX,pixelY],exteriorOffsetsMeters:[.35,.8,1.35],buildings:plans.length,roofSamples,perimeterSamples,nativeWindows:groups.size,method:'Native RGB pixels, trimmed mean; shadows/vegetation suppressed, neighbours excluded. Exterior orthophoto pixels are a wall/surrounding-pavement colour proxy, not a surveyed facade photograph.'};
 console.log('Building colours:',JSON.stringify({buildings:plans.length,roofSamples,perimeterSamples,nativeWindows:groups.size,requested}));
 }finally{await tif.close();}
}
