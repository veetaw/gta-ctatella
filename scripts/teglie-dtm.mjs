import {execFileSync} from 'node:child_process';

export function regionalTerrain(origin, extent) {
 const archive='assets/DTM_5k_2.zip';
 const entries=execFileSync('unzip',['-Z1',archive],{encoding:'utf8'}).trim().split(/\r?\n/);
 const cell=5;
 const minX=Math.ceil(extent.minX/cell)*cell,maxX=Math.floor(extent.maxX/cell)*cell;
 const minZ=Math.ceil(extent.minZ/cell)*cell,maxZ=Math.floor(extent.maxZ/cell)*cell;
 const cols=(maxX-minX)/cell+1,rows=(maxZ-minZ)/cell+1;
 const sheets=[];
 for(const entry of entries.filter(name=>name.endsWith('.asc'))){
  const lines=execFileSync('unzip',['-p',archive,entry],{encoding:'utf8',maxBuffer:12e6}).trim().split(/\r?\n/);
  const header=Object.fromEntries(lines.slice(0,6).map(line=>line.trim().toLowerCase().split(/\s+/)));
  const {ncols,nrows,cellsize,xllcenter,yllcenter}=header;
  const width=+ncols,depth=+nrows,step=+cellsize;
  const left=+xllcenter-origin.x,top=origin.y-(+yllcenter+(depth-1)*step);
  if(left>maxX+cell||left+(width-1)*step<minX-cell||top>maxZ+cell||top+(depth-1)*step<minZ-cell)continue;
  const heights=Float32Array.from(lines.slice(6).join(' ').trim().split(/\s+/),Number);
  if(heights.length!==width*depth||step!==cell)throw Error('Foglio DTM non valido: '+entry);
  sheets.push({entry,left,top,width,depth,heights});
 }
 const heights=new Float32Array(cols*rows),gap=new Uint16Array(heights.length);
 const queue=new Int32Array(heights.length);
 let tail=0;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const x=minX+col*cell,z=minZ+row*cell,i=row*cols+col;
  let bestWeight=0;
  for(const sheet of sheets){
   const u=(x-sheet.left)/cell,v=(z-sheet.top)/cell,a=Math.floor(u),b=Math.floor(v);
   let weight=0,height=0;
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const sx=a+dx,sy=b+dy;
    if(sx<0||sy<0||sx>=sheet.width||sy>=sheet.depth)continue;
    const h=sheet.heights[sy*sheet.width+sx];
    if(!(h>0))continue;
    const w=(1-Math.abs(sx-u))*(1-Math.abs(sy-v));
    weight+=w;height+=h*w;
   }
   if(weight>bestWeight+1e-7){heights[i]=height/weight;bestWeight=weight;}
  }
  if(bestWeight>0)queue[tail++]=i;
 }
 if(!tail)throw Error('Nessuna copertura DTM nella zona richiesta');
 const covered=tail;
 for(let head=0;head<tail;head++){
  const i=queue[head],col=i%cols;
  for(const j of [col?i-1:-1,col<cols-1?i+1:-1,i-cols,i+cols]){
   if(j<0||j>=heights.length||heights[j]>0)continue;
   heights[j]=heights[i];gap[j]=gap[i]+1;queue[tail++]=j;
  }
 }
 const terrain={cols,rows,cell,cellZ:cell,minX,maxX,minZ,maxZ,heights:Array.from(heights,h=>Math.round(h*100)/100)};
 return {terrain,covered,sheets:sheets.map(s=>s.entry),
  gapAt:(x,z)=>gap[Math.round((z-minZ)/cell)*cols+Math.round((x-minX)/cell)]*cell};
}
