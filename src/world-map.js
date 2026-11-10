import {setIcon} from './ui-icons.js';

export function createWorldMap(world,landmarks,onToggle,onNavigate,onClearGuidance){
 const dialog=document.createElement('dialog');dialog.className='world-map';dialog.setAttribute('aria-labelledby','world-map-title');
 dialog.innerHTML='<canvas aria-label="Mappa stradale di San Gregorio Magno" tabindex="0"></canvas><header><strong id="world-map-title">San Gregorio Magno</strong><small>Trascina per muoverti · pizzica per zoomare</small></header><nav aria-label="Comandi mappa"></nav><div class="world-map-legend"></div><div class="world-map-place" hidden><span role="status"></span><button type="button" hidden>Attiva navigatore</button><button type="button" data-clear-guide hidden>Annulla percorso</button></div>';
 if(world.teglie){
  const credits=document.createElement('div');
  credits.className='world-map-credits';
  credits.textContent='Regione Campania · DBT e DTM 2020';
  dialog.append(credits);
 }
 document.body.append(dialog);
 const canvas=dialog.querySelector('canvas'),g=canvas.getContext('2d'),nav=dialog.querySelector('nav'),legend=dialog.querySelector('.world-map-legend');
 const place=dialog.querySelector('.world-map-place'),placeLabel=place.querySelector('span'),navigate=place.querySelector('button'),clear=place.querySelector('[data-clear-guide]');
 let selected=null,tap=null;
 const markerRadius=10;
 navigate.onclick=()=>{if(selected)onNavigate(selected);};
 clear.onclick=()=>{onClearGuidance();closeButton.focus();};
 function showPlace(label,point=null){selected=point;placeLabel.textContent=label;place.hidden=false;navigate.hidden=!point;}
 const t=world.terrain, roads=world.roads.map(r=>({...r,bounds:r.points.reduce(([l,u,h,b],[x,z])=>[Math.min(l,x),Math.min(u,z),Math.max(h,x),Math.max(b,z)],[Infinity,Infinity,-Infinity,-Infinity])}));
 let guidance=null,state,scale=1,fit=1,cx=0,cz=0,width=0,height=0,frame=0;const pointers=new Map();
 const inView=(b,l,u,r,d)=>b[0]<=r&&b[2]>=l&&b[1]<=d&&b[3]>=u;
 const center=()=>{cx=state?.x??(t.minX+t.maxX)/2;cz=state?.z??(t.minZ+t.maxZ)/2;scale=Math.min(2,Math.max(fit*2.6,1.15));if(guidance)showGuidance();else hidePlace();invalidate();};
 function button(icon,label,click){const b=document.createElement('button');b.type='button';setIcon(b,icon,label);b.onclick=click;nav.append(b);return b;}
 const closeButton=button('close','Chiudi mappa',close);
 button('plus','Ingrandisci',()=>zoom(1.5));button('minus','Riduci',()=>zoom(1/1.5));button('center','Centra sul giocatore',center);
 function addLegendMarker(p){const b=document.createElement('button');b.type='button';b.textContent=p.icon;b.title=p.label;b.setAttribute('aria-label',p.label);b.onclick=()=>{cx=p.x;cz=p.z;scale=Math.max(scale,1.6);showPlace(p.label,p);invalidate();};legend.append(b);}
 for(const p of landmarks)addLegendMarker(p);
 function resize(){
  if(!dialog.open)return;const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5);
  width=rect.width;height=rect.height;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  fit=Math.min(width/(t.maxX-t.minX),height/(t.maxZ-t.minZ));scale=Math.max(scale,fit*.8);invalidate();
 }
 function invalidate(){if(dialog.open&&!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
 function zoom(factor,x=width/2,y=height/2){
  const next=Math.max(fit*.8,Math.min(8,scale*factor)),delta=1/scale-1/next;
  cx+=(x-width/2)*delta;cz+=(y-height/2)*delta;scale=next;invalidate();
 }
 function close(){if(!dialog.open)return;pointers.clear();tap=null;dialog.close();onToggle(false);}
 function open(){if(dialog.open)return;dialog.showModal();resize();center();if(guidance)fitGuidance();onToggle(true);closeButton.focus();}
 function hidePlace(){selected=null;place.hidden=true;}
 function showGuidance(){
  const {points,label}=guidance;
  showPlace(points.length>1?`Navigatore · ${label}`:`${label} · Percorso stradale non disponibile`);
 }
 function fitGuidance(){
  const {points,target}=guidance,bounds=[target.x,target.z,target.x,target.z];
  for(const p of points){bounds[0]=Math.min(bounds[0],p.x);bounds[1]=Math.min(bounds[1],p.z);bounds[2]=Math.max(bounds[2],p.x);bounds[3]=Math.max(bounds[3],p.z);}
  cx=(bounds[0]+bounds[2])/2;cz=(bounds[1]+bounds[3])/2;
  scale=Math.min(2,Math.max(fit*.8,Math.min(width/(bounds[2]-bounds[0]+110),height/(bounds[3]-bounds[1]+110))));
  showGuidance();invalidate();
 }
 function guide(next,show){
  guidance=next;clear.hidden=!next;
  if(dialog.open){if(guidance)fitGuidance();else{if(!selected)hidePlace();invalidate();}}
  else if(show&&guidance)open();
 }

 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 window.addEventListener('resize',resize);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.002),e.clientX,e.clientY);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(pointers.size>=2||e.button!==0)return;canvas.setPointerCapture(e.pointerId);tap=pointers.size?null:{id:e.pointerId,x:e.clientX,y:e.clientY};pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});});
 canvas.addEventListener('pointermove',e=>{
  const old=pointers.get(e.pointerId);if(!old)return;const next={x:e.clientX,y:e.clientY};
  const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)?.[1];
  if(tap&&Math.hypot(next.x-tap.x,next.y-tap.y)>8)tap=null;
  const dx=next.x-old.x,dy=next.y-old.y;cx-=dx/(scale*(other?2:1));cz-=dy/(scale*(other?2:1));
  if(other){const before=Math.hypot(old.x-other.x,old.y-other.y);if(before>5)zoom(Math.hypot(next.x-other.x,next.y-other.y)/before,(next.x+other.x)/2,(next.y+other.y)/2);}
  pointers.set(e.pointerId,next);invalidate();
 });
 canvas.addEventListener('pointerup',e=>{
  if(tap?.id===e.pointerId&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=8){
   const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left-width/2,y=e.clientY-rect.top-height/2;
   let point=null,distance=markerRadius+8;
   for(const p of landmarks){
    const d=Math.hypot((p.x-cx)*scale-x,(p.z-cz)*scale-y);
    if(d<distance){distance=d;point=p;}
   }
   if(point)showPlace(point.label,point);
  }
  tap=null;pointers.delete(e.pointerId);
 });
 for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{
  if(tap?.id===e.pointerId)tap=null;
  pointers.delete(e.pointerId);
 });
 canvas.addEventListener('dblclick',e=>zoom(1.65,e.clientX,e.clientY));
 dialog.addEventListener('keydown',e=>{
  if(e.key==='+'||e.key==='=')zoom(1.5);else if(e.key==='-')zoom(1/1.5);
  else if(e.key.startsWith('Arrow')){cx+=(Number(e.key==='ArrowRight')-Number(e.key==='ArrowLeft'))*55/scale;cz+=(Number(e.key==='ArrowDown')-Number(e.key==='ArrowUp'))*55/scale;invalidate();}
  else return;e.preventDefault();
 });
 function draw(){
  if(!dialog.open||!width||!height)return;
  g.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);g.fillStyle='#17211f';g.fillRect(0,0,width,height);
  const l=cx-width/2/scale,u=cz-height/2/scale,r=l+width/scale,d=u+height/scale;
  const sx=x=>(x-l)*scale,sy=z=>(z-u)*scale,visible=roads.filter(road=>inView(road.bounds,l,u,r,d));
  if(scale>=.42){g.fillStyle='#42504b';for(const b of world.buildings){if(!inView(b.bounds,l,u,r,d))continue;g.beginPath();for(const ring of b.rings){ring.forEach(([x,z],i)=>i?g.lineTo(sx(x),sy(z)):g.moveTo(sx(x),sy(z)));g.closePath();}g.fill('evenodd');}}
  g.lineCap='round';g.lineJoin='round';
  for(const [color,extra] of [['#121918',2.6],['#b4bcb1',0]]){g.strokeStyle=color;for(const road of visible){g.lineWidth=Math.max(1,Math.min(10,scale*(road.width||3)*.48))+extra;g.beginPath();road.points.forEach(([x,z],i)=>i?g.lineTo(sx(x),sy(z)):g.moveTo(sx(x),sy(z)));g.stroke();}}
  if(guidance?.points.length>1){
   g.beginPath();guidance.points.forEach(({x,z},i)=>i?g.lineTo(sx(x),sy(z)):g.moveTo(sx(x),sy(z)));
   g.strokeStyle='#20170d';g.lineWidth=8;g.stroke();g.strokeStyle='#ffcc68';g.lineWidth=4;g.stroke();
  }
  if(scale>=.95){
   const boxes=[],names=new Set(),centerX=width/2,centerY=height/2;
   g.font='600 12px system-ui';g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.strokeStyle='#17211f';g.fillStyle='#fff5d9';
   for(const road of visible){const name=road.name?.trim();if(!name||names.has(name))continue;const tw=g.measureText(name).width, candidates=[];
    for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],s=dx*dx+dz*dz;
     const f=s?Math.max(0,Math.min(1,((cx-a[0])*dx+(cz-a[1])*dz)/s)):.5,x=sx(a[0]+dx*f),y=sy(a[1]+dz*f)-9;
     if(x-tw/2<12||x+tw/2>width-58||y<58||y>height-58)continue;candidates.push({x,y,priority:Math.hypot(x-centerX,y-centerY)});
    }
    for(const {x,y} of candidates.sort((a,b)=>a.priority-b.priority)){const b=[x-tw/2-4,y-9,x+tw/2+4,y+9];if(boxes.some(a=>inView(a,...b)))continue;boxes.push(b);names.add(name);g.strokeText(name,x,y);g.fillText(name,x,y);break;}
   }
  }
  function marker(p,label,color){if(!p)return;const x=sx(p.x),y=sy(p.z);g.beginPath();g.arc(x,y,markerRadius,0,Math.PI*2);g.fillStyle='#14241e';g.fill();g.fillStyle=color;g.font='700 11px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(label,x,y);}
  for(const p of landmarks)marker(p,p.icon,'#ffe19b');
  for(const v of state?.vehicles||[])if(v.root.visible)marker(v,'•','#a3d5e3');
  marker(state?.heli,'H','#ffe19b');marker(state?.procession,'P','#b3e5bf');
  if(guidance)marker(guidance.target,'◆','#ffcc68');
  if(state){g.save();g.translate(sx(state.x),sy(state.z));g.rotate(Math.PI-state.yaw);g.fillStyle='#fff';g.strokeStyle='#15211f';g.lineWidth=2;g.beginPath();g.moveTo(0,-11);g.lineTo(-6,7);g.lineTo(0,4);g.lineTo(6,7);g.closePath();g.stroke();g.fill();g.restore();}
 }
 return {open,close,guide,addLandmark(point){landmarks.push(point);addLegendMarker(point);invalidate();},get opened(){return dialog.open;},update(next){state=next;}};
}
