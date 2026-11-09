import {createWorldMap} from './world-map.js';
import {setIcon} from './ui-icons.js';
import {FARM_LOCATIONS} from './farm-locations.js';
import {HELIPORT,worldLocation} from './game-locations.js';
import {MOBILE} from './device-profile.js';
import {vehicleGear} from './vehicle-physics.js';
export function vehicleRPM(car){const gear=Number(vehicleGear(car));if(!gear)return .13;const v=Math.abs(car.speed),lo=car.spec.gears[gear-1],hi=car.spec.gears[gear]??car.spec.maxSpeed;return Math.min(1,.24+.76*(v-lo)/Math.max(1,hi-lo));}
export function createHUD(w,network,vehicles=[],{adult=true}={}){
 const c=document.querySelector('#map'),g=c.getContext('2d'),$=id=>document.getElementById(id),t=w.terrain,base=document.createElement('canvas');base.width=MOBILE?512:2048;base.height=Math.round(base.width*(t.maxZ-t.minZ)/(t.maxX-t.minX));
 const bg=base.getContext('2d'),bx=base.width/(t.maxX-t.minX),bz=base.height/(t.maxZ-t.minZ),bp=q=>[(q[0]-t.minX)*bx,(q[1]-t.minZ)*bz];bg.fillStyle='#252b30';bg.fillRect(0,0,base.width,base.height);bg.fillStyle='#667079';
 for(const b of w.buildings){bg.beginPath();for(const ring of b.rings){ring.forEach((v,i)=>i?bg.lineTo(...bp(v)):bg.moveTo(...bp(v)));bg.closePath();}bg.fill('evenodd');}
 bg.strokeStyle='#d3d8da';bg.lineWidth=2.6;bg.lineCap='round';for(const r of w.roads){bg.beginPath();r.points.forEach((v,i)=>i?bg.lineTo(...bp(v)):bg.moveTo(...bp(v)));bg.stroke();}
 const gas=document.querySelector('.gas'),brake=document.querySelector('.brake'),drift=document.querySelector('.drift');let wasFlying=null;
 let roadTimer=0,lastRoad='',lastVehicle='',wasFoot=null,labelTimer,toastTimer,stamina=100;
 if(MOBILE)$('location').setAttribute('aria-hidden','true');
 c.width=c.height=MOBILE?96:160;
 const showNames=()=>{if(MOBILE)return;$('location').classList.add('visible');clearTimeout(labelTimer);labelTimer=setTimeout(()=>$('location').classList.remove('visible'),4000);};
 const mapButton=document.createElement('button');mapButton.className='map-toggle';mapButton.type='button';mapButton.setAttribute('aria-label','Apri mappa');mapButton.setAttribute('aria-haspopup','dialog');mapButton.setAttribute('aria-expanded','false');c.replaceWith(mapButton);mapButton.append(c);
 const landmarks=[['R','Rotonda · Raid degli invasori',40.656142,15.397065],['G','Madonna delle Grazie · Processione',40.656035,15.406984],['M','Chiesa Madre · Arrivo',40.656123,15.405181],['Z','Lu Mazzuoccl · Partenza',40.6575901,15.4012597],['H','Eliporto · Piazzale veicoli',HELIPORT.lat,HELIPORT.lon],['V','San Vito · Turniata di San Vito',40.661428,15.405119],['S','Municipio · Abballa la Statua',40.656598,15.403656],...FARM_LOCATIONS].filter(([icon])=>adult||icon!=='R').map(([icon,label,lat,lon])=>({icon,label,...worldLocation(w.origin,{lat,lon})}));
 let guidance=null;
 const fullMap=createWorldMap(w,landmarks,value=>{document.body.classList.toggle('map-expanded',value);mapButton.setAttribute('aria-expanded',String(value));api.onMapToggle?.();if(!value)mapButton.focus();},point=>api.onMapNavigate?.(point),clearGuidance);
 function clearGuidance(){
  if(!guidance)return;
  guidance=null;fullMap.guide(null,false);
 }
 mapButton.onclick=()=>fullMap.open();
 function map(x,z,yaw,onFoot,heli,ferrari,procession){
  if(guidance&&Math.hypot(x-guidance.target.x,z-guidance.target.z)<=12)clearGuidance();
  fullMap.update({x,z,yaw,heli,procession,vehicles});if(fullMap.opened)return;
  g.fillStyle='#202a2d';g.fillRect(0,0,c.width,c.height);
  const scale=c.width/(onFoot?240:400);
  g.save();g.translate(c.width/2,c.height*.55);if(!onFoot)g.rotate(yaw+Math.PI);
  g.drawImage(base,(t.minX-x)*scale,(t.minZ-z)*scale,(t.maxX-t.minX)*scale,(t.maxZ-t.minZ)*scale);
  if(guidance?.points.length>1){
   g.beginPath();guidance.points.forEach((p,i)=>i?g.lineTo((p.x-x)*scale,(p.z-z)*scale):g.moveTo((p.x-x)*scale,(p.z-z)*scale));
   g.lineCap='round';g.lineJoin='round';g.strokeStyle='#241b12';g.lineWidth=5;g.stroke();
   g.strokeStyle='#ffcc68';g.lineWidth=2.5;g.stroke();
  }
  for(const [p,color] of [[heli,'#f4d47b'],[ferrari,'#ff7b70'],[procession,'#9ee4ca']])if(p){g.fillStyle=color;g.beginPath();g.arc((p.x-x)*scale,(p.z-z)*scale,3,0,Math.PI*2);g.fill();}
  if(guidance){
   const {x:gx,z:gz}=guidance.target;g.fillStyle='#ffcc68';g.beginPath();g.arc((gx-x)*scale,(gz-z)*scale,4,0,Math.PI*2);g.fill();
  }
  g.rotate(onFoot?Math.PI-yaw:-yaw-Math.PI);g.fillStyle='#fff';g.strokeStyle='#11171d';g.lineWidth=1.5;g.beginPath();g.moveTo(0,-7);g.lineTo(-4,5);g.lineTo(0,3);g.lineTo(4,5);g.closePath();g.stroke();g.fill();g.restore();
 }
 const api={get mapExpanded(){return fullMap.opened;},closeMap(){fullMap.close();},guide(points,target,label,show=true){
  const route={points,target,label};guidance=route;fullMap.guide(route,show);
  return ()=>{if(guidance===route)clearGuidance();};
 },onMapToggle:null,onMapNavigate:null,update(x,z,y,yaw,speed,onFoot,dt,car,heli,ferrari,procession,playerHealth=100){
  const flying=car.spec.id==='helicopter';if(flying!==wasFlying){setIcon(gas,flying?'forward':'accelerate',flying?'Vola avanti':'Accelera');setIcon(brake,flying?'reverse':'brake',flying?'Vola indietro':'Frena o retromarcia');setIcon(drift,flying?'rise':'handbrake',flying?'Sali con l’elicottero':'Freno a mano');wasFlying=flying;}document.body.classList.toggle('on-foot',onFoot);$('speed').textContent=String(Math.round(Math.abs(speed)*3.6));$('gear').textContent=car.spec.id==='helicopter'?'H':vehicleGear(car);const rpm=vehicleRPM(car);$('rpm-arc').style.strokeDasharray=`${rpm*100} 100`;$('speed-panel').classList.toggle('limiter',rpm>.94&&Math.abs(speed)>3);
  const vehicle=onFoot?'':car.spec.id==='helicopter'?'Elicottero':car.spec.id==='ferrari'?'Grotti / Ferrari F8':car.spec.label;if(vehicle!==lastVehicle||wasFoot!==onFoot){$('vehicle-label').textContent=vehicle;lastVehicle=vehicle;wasFoot=onFoot;showNames();}
  roadTimer-=dt;if(!MOBILE&&roadTimer<=0){roadTimer=.45;const n=network.closestSegment(x,z),road=n&&n.d<28?(n.segment.road.name||'San Gregorio Magno'):lastRoad||'San Gregorio Magno';if(road!==lastRoad){lastRoad=road;$('street').textContent=road;showNames();}}
  stamina=Math.max(0,Math.min(100,stamina+(onFoot&&Math.abs(speed)>3?-14:18)*dt));const energy=onFoot?stamina:100*rpm,integrity=onFoot?playerHealth:car.integrity??100;$('health-fill').parentElement.setAttribute('aria-label',onFoot?'Vita del giocatore':'Integrità del veicolo');$('health-fill').style.width=integrity+'%';$('health-fill').parentElement.setAttribute('aria-valuenow',Math.round(integrity));$('energy-fill').style.width=energy+'%';$('energy-fill').parentElement.setAttribute('aria-valuenow',Math.round(energy));
  map(x,z,yaw,onFoot,heli,ferrari,procession);
 },toast(message){$('toast').textContent=message;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,2200);}};return api;
}
