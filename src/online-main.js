import {updatePowertrain} from './powertrain.js';
import {createOnlineTracers} from './online-tracers.js';
import {HIDE_SAVE_RADIUS,HIDE_START_RADIUS,hideSavePoint,hideStartPoint} from './online-wire.js';
import {installTeglieWorld} from './teglie-world.js';
import {nearestDriver,showPassengers} from './online-seats.js';
import {installOnlineLobby} from './online-lobby.js';
import {playGunSound} from './engine-audio.js';
import {installLanLobby,lanMode} from './lan-lobby.js';
import {createLanWorld} from './lan-world.js';
import {processionLocation} from './procession-model.js';
import {makeEconomyShop} from './economy-shop.js';
import {formatCP} from './economy.js';
import {makeWanted} from './wanted.js';
import {makeMunicipioCrowd} from './procession-people.js';
import {installAnimatedAvatar} from './animated-avatar.js';
import {FARM_LOCATIONS} from './farm-locations.js';
import {makeFarmMissions} from './farm-missions.js';
import {applyLocalWorldEdits} from './local-world-edits.js';
import {makeBaccanaliaSign} from './baccanalia-sign.js';
import {makeRaid,RAID_CENTER} from './online-raid.js';
import {makeVehicleDamage} from './vehicle-damage.js';
import {traceCover} from './combat-geometry.js';
import {boardingIcon} from './action-icons.js';
import {findFootSpawn} from './foot-spawn.js';
import {processionOverlaps} from './procession-collisions.js';
import {signedInUser} from './login-gate.js';
import {makeProcessionPrologue,ESCORT_LEAD_METERS} from './procession.js';
import {roadRoute,PROCESSION_START,processionParking} from './procession-route.js';
import {cameraCollisionFraction} from './camera-clearance.js';
import {makeAbballa} from './abballa.js';
import {makeTurneia,SAN_VITO} from './turneia.js';
import {createMissions} from './online-missions.js';
import {makeTraffic} from './online-traffic.js';
import {HELIPORT,MAZZUOCCOLO_START,worldLocation,geographicLocation} from './game-locations.js';
import {puntoSpawn,buildingCollisionParts} from './punto-location.js';
import {makeMazzuoccolo} from './mazzuoccolo.js';
import {makeBombs} from './bombs.js';
import {makeHelicopter,updateHelicopter} from './helicopter.js';
import {advanceHelicopter} from './helicopter-physics.js';
import {updateProcessionMarch,updateWorldAudio,toggleEngineAudio,updateEngineAudio,silenceEngineAudio,engineAudioDiagnostics} from './engine-audio.js';
import {MOBILE,pixelRatioFor} from './device-profile.js';
import {installContextSafety} from './context-safety.js';
import {loadWorldJSON} from './world-assets.js';
import {createControls,detectTouch} from './controls.js';
import {makeVehicleEffects} from './vehicle-effects.js';
import {terrainDistanceDetail,indexNearbyDetail} from './distance-detail.js';
import {batchStaticWorld,snapSunShadow} from './static-batches.js';
import {advanceVehicle,vehicleGear,vehicleFootprint,VEHICLES} from './vehicle-physics.js';
import {additionalUrbanBuildings} from './urban-aprons.js';
import {makeDbtDetails} from './dbt-details.js';import {createStairPlans,installDbtSteps,extraColliders,roadSurfaceFeatures} from './dbt-plan.js';
import './style.css';import {makeRoadDetails} from './road-details.js';import {makeVillageDetails} from './village-details.js';import {loadRoadMeshCache} from './road-cache.js';import {createRoadNetwork,SpatialIndex} from './road-network.js';import {makeRoads} from './roads.js';import * as THREE from 'three';import {makeTerrain,makeBuildings,makeAtmosphere} from './environment.js';import {makeCar,updateCar,makePerson,makePoliceEscort} from './actors.js';import {elevation,resolveCollision,inBuilding,nearest} from './world-math.js';import {createHUD} from './hud.js';
const onlineMode=new URLSearchParams(location.search).get('mode')==='online';
const freeMode=lanMode||onlineMode;
const $=id=>document.getElementById(id);let renderer;try{renderer=new THREE.WebGLRenderer({antialias:!MOBILE,logarithmicDepthBuffer:true,powerPreference:MOBILE?'default':'high-performance',alpha:false,stencil:false,depth:true,preserveDrawingBuffer:false});}catch(e){$('load-status').textContent='WebGL non disponibile. Apri il gioco in un browser con accelerazione grafica.';throw e;}
renderer.userData={mobile:MOBILE};renderer.setPixelRatio(MOBILE?1:pixelRatioFor(innerWidth,innerHeight,devicePixelRatio));renderer.setSize(MOBILE?640:innerWidth,MOBILE?640:innerHeight,!MOBILE);renderer.shadowMap.enabled=!MOBILE;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;$('game').append(renderer.domElement);const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.16,4000);let w;
let animationFrame=0,startFrames=()=>{},clearInput=()=>{};const gpuNotice=document.createElement('div');gpuNotice.id='gpu-status';gpuNotice.hidden=true;gpuNotice.setAttribute('role','status');const gpuText=document.createElement('p'),retry=document.createElement('button');retry.textContent='Riprova';retry.onclick=()=>location.reload();gpuNotice.append(gpuText,retry);document.body.append(gpuNotice);const contextSafety=installContextSafety(renderer,{stop:()=>{cancelAnimationFrame(animationFrame);animationFrame=0;},clear:()=>clearInput(),resume:()=>startFrames(),show:(text,canRetry)=>{gpuText.textContent=text;retry.hidden=!canRetry;gpuNotice.hidden=false;document.documentElement.dataset.webgl='lost';},hide:()=>{gpuNotice.hidden=true;document.documentElement.dataset.webgl='ready';}});

let traffic=null,policeEscort=null,wanted=null;
try{let mobileWorld=null,roadNetwork,atmosphere,terrainLOD=()=>{},baseLOD=()=>{},staticBatches;if(MOBILE){$('load-status').textContent='Caricamento del quartiere…';mobileWorld=await (await import('./mobile-world.js')).initMobileWorld(scene);w=mobileWorld.world;roadNetwork=mobileWorld.network;atmosphere=mobileWorld.atmosphere;staticBatches=mobileWorld.batches;}else{w=await loadWorldJSON('world-data');if(MOBILE){w.urbanAprons=await loadWorldJSON('urban-aprons');w.dbtExtras=await loadWorldJSON('dbt-extras');}else [w.urbanAprons,w.dbtExtras]=await Promise.all(['urban-aprons','dbt-extras'].map(loadWorldJSON));applyLocalWorldEdits(w);w.urbanFootprints=additionalUrbanBuildings(w.dbtExtras?.features||[]);Object.assign(w,roadSurfaceFeatures(w,w.dbtExtras?.features||[]));roadNetwork=createRoadNetwork(w);const stairPlans=createStairPlans(w.dbtExtras?.features||[],roadNetwork);installDbtSteps(roadNetwork,stairPlans);const roadCache=await loadRoadMeshCache();$('load-status').textContent='Caricamento terreno…';const terrain=await makeTerrain(scene,w,roadNetwork,roadCache);makeRoads(scene,roadNetwork,roadCache);makeRoadDetails(scene,roadNetwork);$('load-status').textContent='Caricamento edifici…';await new Promise(r=>setTimeout(r,20));makeBuildings(scene,w);atmosphere=makeAtmosphere(scene,renderer);makeVillageDetails(scene,w,roadNetwork,terrain.canvas);$('load-status').textContent='Preparazione del mondo…';await new Promise(r=>setTimeout(r,20));makeDbtDetails(scene,w,roadNetwork,stairPlans);terrainLOD=terrainDistanceDetail(terrain.ground);baseLOD=indexNearbyDetail(terrain.ground.children[0],Infinity,true);staticBatches=batchStaticWorld(scene,renderer);}
const teglie=onlineMode?await installTeglieWorld(scene,w,roadNetwork,async (_progress,label)=>{
 $('load-status').textContent=label;
 await new Promise(resolve=>setTimeout(resolve,0));
}):null;
if(teglie)roadNetwork=teglie.network;
makeBaccanaliaSign(scene,w);const cars=[makeCar(scene,'panda'),makeCar(scene,'ferrari'),makeCar(scene,'punto')];let car=cars[0];const helicopter=makeHelicopter(scene);let flying=false;const adult=signedInUser?.user_metadata?.adult===true;const person=makePerson(scene),animateAvatar=installAnimatedAvatar(person,signedInUser?.user_metadata?.avatar),hud=createHUD(w,roadNetwork,cars,{adult,online:onlineMode}),vehicleEffects=makeVehicleEffects(scene,cars,w.terrain);let onFoot=false,view=0,speed=0,started=false,orbit=0,orbitPitch=0,mouse=null,elapsed=0,accumulator=0,camYaw=0;let vehicleLoading=false,vehicleTransfer=0;const keys=new Set();
const colliderIndex=new SpatialIndex(20);const colliders=[...w.buildings.flatMap(buildingCollisionParts),...extraColliders(w.dbtExtras?.features||[])];for(const b of colliders)colliderIndex.insert(b,b.bounds);const solidsNear=(x,z,r=5)=>{const result=mobileWorld?mobileWorld.solidsNear(x,z,r):colliderIndex.box([x-r,z-r,x+r,z+r]);if(teglie)result.push(...teglie.solidsNear(x,z,r,!!mobileWorld));if(farm)result.push(...farm.blocks(x,z,r));if(wanted)result.push(...wanted.colliders(x,z,r));const police=policeEscort?.vehicle;if(police?.root.visible&&Math.hypot(x-police.x,z-police.z)<r+3)result.push(vehicleFootprint(police));for(const c of cars)if(c.root.visible&&(onFoot||c!==car)){const b=vehicleFootprint(c);if(b.bounds[2]>=x-r&&b.bounds[0]<=x+r&&b.bounds[3]>=z-r&&b.bounds[1]<=z+r)result.push(b);}if(helicopter.root.visible&&!flying){const b=vehicleFootprint(helicopter);b.roofY=helicopter.y+3;if(b.bounds[2]>=x-r&&b.bounds[0]<=x+r&&b.bounds[3]>=z-r&&b.bounds[1]<=z+r)result.push(b);}return result;};
const candidateClear=(x,z,r)=>!solidsNear(x,z,r).some(b=>{if(inBuilding([x,z],b))return true;for(const ring of b.rings)for(let i=1;i<ring.length;i++)if(nearest([x,z],ring[i-1],ring[i]).d<r)return true;return false;});
const bombs=makeBombs(scene,(x,z)=>{let y=elevation(w.terrain,x,z);for(const b of solidsNear(x,z,1))if(Number.isFinite(b.roofY)&&inBuilding([x,z],b))y=Math.max(y,b.roofY);return y;});
const missionScene=freeMode?new THREE.Group():scene;
let mazzuoccolo=null,turneia=null,abballa=null,prologue=null,raid=null,damageSystem=null,farm=null,jumpHeight=0,jumpVelocity=0;
const vehicleSolidsNear=(x,z,r)=>[...solidsNear(x,z,r),...(prologue?.colliders(x,z,r)||[]),...(raid?.colliders(x,z,r)||[])];
const combatPlayer=()=>{const actor=flying?helicopter:onFoot?person:car;return {x:actor.x,z:actor.z,y:(flying?helicopter.y:elevation(w.terrain,actor.x,actor.z))+(onFoot?jumpHeight+1.35:1.05),onFoot,vehicle:onFoot?null:flying?helicopter:car,dead:damageSystem?.dead||false};};
const combatSolidsNear=(x,z,r,ignore=[])=>{const out=solidsNear(x,z,r).filter(b=>!String(b.id).startsWith('vehicle-'));for(const vehicle of cars)if(vehicle.root.visible&&!ignore.includes(vehicle)){const b=vehicleFootprint(vehicle);if(b.bounds[2]>=x-r&&b.bounds[0]<=x+r&&b.bounds[3]>=z-r&&b.bounds[1]<=z+r)out.push({...b,vehicle});}out.push(...(prologue?.colliders(x,z,r)||[]),...(wanted?.colliders(x,z,r,true).filter(body=>!ignore.includes(body.vehicle))||[]));return out;};
const puntoHome=puntoSpawn(w);const initialSpawn={...w.spawn};const spawnQuery=new URLSearchParams(location.search),requestedStreet=spawnQuery.get('via')||(!spawnQuery.has('luogo')?'ponte':null);
if(requestedStreet){const road=roadNetwork.roads.find(r=>r.name?.toLocaleLowerCase('it').includes(requestedStreet.toLocaleLowerCase('it')));if(road){const candidates=[...road.sections].sort((a,b)=>Math.abs(a.s-road.length/2)-Math.abs(b.s-road.length/2));const p=candidates.find(s=>candidateClear(s.x,s.z,2.1)&&roadNetwork.pavementAt(s.x,s.z));if(p)Object.assign(initialSpawn,{x:p.x,z:p.z,y:p.y,yaw:Math.atan2(p.nz,-p.nx),street:road.name});}}
if(!candidateClear(initialSpawn.x,initialSpawn.z,1.85)){const candidates=roadNetwork.roads.flatMap(r=>r.sections.map(s=>({...s,street:r.name}))).sort((a,b)=>Math.hypot(a.x-initialSpawn.x,a.z-initialSpawn.z)-Math.hypot(b.x-initialSpawn.x,b.z-initialSpawn.z));const p=candidates.find(p=>candidateClear(p.x,p.z,2.1));if(p)Object.assign(initialSpawn,{x:p.x,z:p.z,y:p.y,yaw:Math.atan2(p.nz,-p.nx),street:p.street});}
if(requestedStreet?.toLowerCase()==='ponte'&&w.heritage){const b=w.buildings.find(b=>b.id===w.heritage.viaPonteChurchId),p=w.heritage.plazaCenter;const candidates=roadNetwork.roads.flatMap(r=>r.sections).filter(s=>Math.hypot(s.x-p[0],s.z-p[1])<24&&candidateClear(s.x,s.z,2.1)).sort((a,b)=>Math.hypot(a.x-p[0],a.z-p[1])-Math.hypot(b.x-p[0],b.z-p[1]));const s=candidates[0];if(s)Object.assign(initialSpawn,{x:s.x,z:s.z,y:s.y,yaw:Math.atan2((b.bounds[0]+b.bounds[2])/2-s.x,(b.bounds[1]+b.bounds[3])/2-s.z)-Math.PI,street:'Piazza Santa Maria delle Grazie'});}
const requestedPlace=new URLSearchParams(location.search).get('luogo');const placeCategory={rotonda:'roundabout',scale:'stairs',ponte:'bridge',sport:'sport'}[requestedPlace];
if(placeCategory){const feature=w.dbtExtras?.features.find(f=>f.category===placeCategory);if(feature){const cx=(feature.bounds[0]+feature.bounds[2])/2,cz=(feature.bounds[1]+feature.bounds[3])/2,candidates=roadNetwork.roads.flatMap(r=>r.sections.map(s=>({...s,street:r.name}))).filter(s=>Math.hypot(s.x-cx,s.z-cz)>10&&Math.hypot(s.x-cx,s.z-cz)<60&&candidateClear(s.x,s.z,2.1)).sort((a,b)=>Math.abs(Math.hypot(a.x-cx,a.z-cz)-18)-Math.abs(Math.hypot(b.x-cx,b.z-cz)-18));if(candidates[0]){const p=candidates[0];Object.assign(initialSpawn,{x:p.x,z:p.z,y:p.y,yaw:Math.atan2(cx-p.x,cz-p.z)-Math.PI,street:p.street});}}}
// Coordinate links make a specific GIS correction directly reviewable.
if(spawnQuery.has('lat')&&spawnQuery.has('lon')){const lat=Number(spawnQuery.get('lat')),lon=Number(spawnQuery.get('lon'));if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180){const p=worldLocation(w.origin,{lat,lon});if(p.x>w.terrain.minX&&p.x<w.terrain.maxX&&p.z>w.terrain.minZ&&p.z<w.terrain.maxZ){const near=roadNetwork.closestSegment(p.x,p.z);if(near){const {a,b}=near.segment,q=near.q;if(candidateClear(...q,1.85))Object.assign(initialSpawn,{x:q[0],z:q[1],y:elevation(w.terrain,...q),yaw:Math.atan2(b.x-a.x,b.z-a.z),street:near.segment.road.name});}}}}
const heliPad=worldLocation(w.origin,HELIPORT);
let unlocked=false,ferrariUnlocked=false,missionSystem,shop;
let lanLobby,crewVehicle,passenger=null,hideActivity=null,hideDeadline=0;
const hidePanel=document.createElement('aside');
hidePanel.className='online-hide-status';hidePanel.hidden=true;
const hideStatus=document.createElement('span');
const hideStart=document.createElement('button');
hideStart.type='button';hideStart.textContent='Avvia Nascondino';hideStart.hidden=true;
hideStart.onclick=()=>{
 if(overlayOpen()||!canStartHide()||lanLobby.count<2)return;
 sendCurrentPose();
 lanLobby.room.send({type:'hide-start'});
};
const hideSave=document.createElement('button');
hideSave.type='button';hideSave.textContent='TINGOLO SALVI ME';hideSave.hidden=true;
hideSave.onclick=()=>lanLobby?.room?.send({type:'hide-save'});
hidePanel.append(hideStatus,hideStart,hideSave);
const savePoint=hideSavePoint(w);
const startPoint=hideStartPoint(w);
const deathLog=document.createElement('div');
deathLog.className='online-death-log';deathLog.hidden=true;
deathLog.setAttribute('role','log');
deathLog.setAttribute('aria-label','Eventi della stanza');
let deathLogTimer;
if(onlineMode)document.querySelector('#radar').append(deathLog);
function clearDeathLog(){
 clearTimeout(deathLogTimer);
 deathLog.replaceChildren();deathLog.hidden=true;
}
function showDeath({victim,killer}){
 const row=document.createElement('p');
 row.textContent=killer?killer+' ha accis a '+victim:victim+' è muort';
 deathLog.append(row);
 if(deathLog.childElementCount>3)deathLog.firstElementChild.remove();
 deathLog.hidden=false;
 clearTimeout(deathLogTimer);
 deathLogTimer=setTimeout(clearDeathLog,11000);
}
const tracers=onlineMode?createOnlineTracers(scene):null;
const remoteFlashes=new Map();
if(onlineMode){
 document.body.append(hidePanel);
 hud.addMapLandmark({...startPoint,icon:'🏠',label:'Nascondino · Chiesa e punto di salvezza'});
}
const seekerWaiting=()=>hideActivity?.role==='seeker'&&hideActivity.phase==='escape';
const atHidePoint=()=>onFoot&&!passenger&&!damageSystem.dead&&
 Math.hypot(person.x-savePoint.x,person.z-savePoint.z)<=HIDE_SAVE_RADIUS;
const canStartHide=()=>!hideActivity&&lanLobby?.room?.activities&&onFoot&&!passenger&&!damageSystem.dead&&
 Math.hypot(person.x-startPoint.x,person.z-startPoint.z)<=HIDE_START_RADIUS;
function updateHideStatus(){
 const canStart=canStartHide();
 hidePanel.hidden=!hideActivity&&!canStart;
 hideStart.hidden=!canStart;
 if(!hideActivity){
  hideSave.hidden=true;
  if(canStart){
   hideStart.disabled=lanLobby.count<2;
   const text=hideStart.disabled?'NASCONDINO · Servono almeno 2 giocatori':'NASCONDINO · 10 secondi per nascondersi';
   if(hideStatus.textContent!==text)hideStatus.textContent=text;
  }
  return;
 }
 const seconds=Math.max(0,Math.ceil((hideDeadline-performance.now())/1000));
 const time=seconds?(' · '+seconds+' s'):'';
 const text=hideActivity.phase==='escape'
  ? (hideActivity.role==='seeker'?'Conta con la faccia al muro':'Nasconditi, puoi usare un veicolo')
  : ({seeker:'Cerca i giocatori',hider:'Resta nascosto o torna allo spawn',saved:'Ti sei salvato!',found:'Sei stato scoperto'})[hideActivity.role]??'Manche in corso';
 const next='NASCONDINO · '+text+time+' · '+hideActivity.remaining+' da trovare';
 if(hideStatus.textContent!==next)hideStatus.textContent=next;
 hideSave.hidden=hideActivity.phase!=='search'||hideActivity.role!=='hider'||!atHidePoint();
}
function dismountPassenger(){
 if(!passenger)return;
 const [,x,,z,yaw]=passenger.pose;
 const exit=[Math.PI/2,-Math.PI/2,Math.PI,0].map(a=>({
  x:x+Math.sin(yaw+a)*3,z:z+Math.cos(yaw+a)*3,yaw,
 })).find(p=>candidateClear(p.x,p.z,.4));
 passenger=null;
 if(!damageSystem.dead)spawnOnFoot(exit??{x,z,yaw});
}
const overlayOpen=()=>lanLobby?.open||hud.mapExpanded||missionSystem?.expanded||shop?.open||farm?.open;
const ferrari=cars.find(c=>c.spec.id==='ferrari');
const shopCars=[cars[0],ferrari,makeCar(scene,'ape','#638e83'),makeCar(scene,'offroad','#b78d40'),makeCar(scene,'motocross','#db751f')];
if(freeMode)shopCars.push(makeCar(scene,'rambo'));
cars.push(...shopCars.slice(2));
const vehicleOwned=vehicle=>freeMode?(onlineMode||!vehicle.traffic):!shopCars.includes(vehicle)||!!missionSystem?.state().economy.owned[vehicle.spec.id];
function parkShopCars(){
 // The open strip north-west of the pad has room for a row and a driving aisle.
 for(const [i,vehicle] of shopCars.entries()){
  damageSystem?.repair(vehicle);
  Object.assign(vehicle,{x:heliPad.x-20+i*5.5,z:heliPad.z-9,yaw:Math.PI,speed:0,parked:true,steer:0,slip:0});
  vehicle.root.visible=true;
  updateCar(vehicle,w.terrain,0);
 }
}
const pad=new THREE.Group();pad.position.set(heliPad.x,0,heliPad.z);scene.add(pad);
const marking=new THREE.MeshBasicMaterial({color:0xf5edcf,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
const paintPad=geometry=>{
 geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,marking);pad.add(mesh);return mesh;
};
const padPaint=[paintPad(new THREE.RingGeometry(4,4.28,48,2))];
for(const [x,z,sx,sz] of [[-1,0,.31,2.8],[1,0,.31,2.8],[0,0,2,.31]]){
 const bar=paintPad(new THREE.PlaneGeometry(sx,sz,4,4));bar.position.set(x,0,z);padPaint.push(bar);
}
function fitHelipad(){
 for(const mesh of padPaint){
  const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,elevation(w.terrain,heliPad.x+mesh.position.x+p.getX(i),heliPad.z+mesh.position.z+p.getZ(i))+.085);
  p.needsUpdate=true;mesh.geometry.computeBoundingSphere();
 }
 label.position.y=elevation(w.terrain,heliPad.x,heliPad.z)+3;
}
const labelCanvas=document.createElement('canvas');labelCanvas.width=1024;labelCanvas.height=128;const labelContext=labelCanvas.getContext('2d');labelContext.fillStyle='#10232cdd';labelContext.fillRect(0,0,1024,128);labelContext.fillStyle='#fff';labelContext.font='bold 34px sans-serif';labelContext.textAlign='center';labelContext.fillText('Elicottero · 1.000.000 CP · Livello 10',512,76);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),transparent:true}));label.scale.set(12,1.5,1);pad.add(label);fitHelipad();
let padReady=!mobileWorld;
function parkHelicopter(){helicopter.x=heliPad.x;helicopter.z=heliPad.z;helicopter.y=elevation(w.terrain,heliPad.x,heliPad.z)-.055;helicopter.yaw=0;helicopter.speed=helicopter.strafeSpeed=helicopter.verticalSpeed=helicopter.altitude=0;helicopter.body.rotation.set(0,0,0);helicopter.root.visible=true;updateHelicopter(helicopter,0);}
missionSystem=createMissions(state=>{ferrariUnlocked=!!state.economy.owned.ferrari;unlocked=!!state.economy.owned.helicopter;label.visible=!unlocked;},signedInUser,{adult,lan:freeMode});
await missionSystem.ready;
const graceChurch=worldLocation(w.origin,{lat:40.655915,lon:15.406906});
const firstPrologue=!missionSystem.state().processionDone;if(firstPrologue){const p=worldLocation(w.origin,PROCESSION_START),near=roadNetwork.closestSegment(p.x,p.z);if(near)Object.assign(initialSpawn,{x:near.q[0],z:near.q[1],y:elevation(w.terrain,...near.q),yaw:0,street:'Madonna delle Grazie · Processione'});}
function dropBomb(){if(freeMode||!flying)return;if(!bombs.drop(helicopter)&&helicopter.altitude<4)hud.toast('Decolla prima di sganciare le bombe.');}
function reset(){wanted?.clear();raid?.suspend();prologue?.leave();abballa?.cancel();turneia?.reset();jumpHeight=jumpVelocity=0;mazzuoccolo?.reset();vehicleTransfer++;vehicleLoading=false;document.body.classList.remove('vehicle-loading');bombs.reset();view=0;flying=false;helicopter.root.visible=false;document.body.classList.remove('flying');
 const punto=cars[2];damageSystem?.repair(punto);if(onlineMode)damageSystem?.repair(helicopter);
 Object.assign(punto,puntoHome,{speed:0,parked:true,steer:0,slip:0});updateCar(punto,w.terrain,0);
 punto.root.visible=!onlineMode;
 car=punto;parkHelicopter();parkShopCars();speed=0;jumpHeight=jumpVelocity=0;spawnOnFoot();}
function spawnOnFoot(home=firstPrologue?prologue.route.at(8):initialSpawn){flying=false;document.body.classList.remove('flying');speed=jumpHeight=jumpVelocity=0;onFoot=true;person.root.visible=true;orbit=0;orbitPitch=0;const spawn=findFootSpawn(home,candidateClear,initialSpawn);Object.assign(person,{x:spawn.x,z:spawn.z,yaw:firstPrologue&&!missionSystem.state().processionDone?Math.atan2(graceChurch.x-spawn.x,graceChurch.z-spawn.z):spawn.yaw??0});const y=elevation(w.terrain,person.x,person.z);person.root.position.set(person.x,y,person.z);person.root.rotation.y=person.yaw;person.limbs.forEach(l=>l.rotation.x=0);camYaw=person.yaw;camera.position.set(person.x-Math.sin(camYaw)*4.6,y+2.2,person.z-Math.cos(camYaw)*4.6);camera.lookAt(person.x,y+1.55,person.z);}

let boardingHelicopter=false;
function selectCar(index,ground=false){const selectHeli=index===3&&!ground;if(damageSystem?.dead||prologue?.active||abballa?.blockInput||overlayOpen()||onFoot||onlineMode&&!boardingHelicopter)return;if(!selectHeli&&!cars[index])return;if(!selectHeli&&cars[index]?.destroyed){hud.toast('Veicolo distrutto.');return;}if(!selectHeli&&!vehicleOwned(cars[index])){hud.toast('Acquista questo veicolo al piazzale.');return;}if(selectHeli){if(!unlocked||!helicopter.root.visible){hud.toast('Acquista l’Elicottero al piazzale.');return;}if(!boardingHelicopter){hud.toast('Avvicinati a piedi all’Elicottero per salire.');return;}car.speed=0;flying=true;helicopter.speed=helicopter.strafeSpeed=helicopter.verticalSpeed=0;document.body.classList.add('flying');hud.toast(controls.touch?'Elicottero · SU per decollare, joystick per volare':'Elicottero · Spazio per salire, WASD per volare');}else{const wasFlying=flying;flying=false;document.body.classList.remove('flying');if(wasFlying)parkHelicopter();car.speed=0;car=cars[index];car.speed=0;hud.toast(car.spec.label);}speed=0;orbit=0;orbitPitch=0;view=0;camYaw=flying?helicopter.yaw:car.yaw+(car.spec.id==='punto'&&Math.hypot(car.x-puntoHome.x,car.z-puntoHome.z)<8?Math.PI:0);const actor=flying?helicopter:car;updateCar(car,w.terrain,0);const y=flying?helicopter.y:car.root.position.y;camera.position.set(actor.x-Math.sin(camYaw)*10,y+3.5,actor.z-Math.cos(camYaw)*10);camera.lookAt(actor.x,y+1,actor.z);if(mobileWorld){const token=++vehicleTransfer;vehicleLoading=true;document.body.classList.add('vehicle-loading');mobileWorld.prepareArea(actor.x,actor.z).catch(()=>hud.toast('Caricamento incompleto: riprova a selezionare il veicolo.')).finally(()=>{if(token===vehicleTransfer){vehicleLoading=false;document.body.classList.remove('vehicle-loading');}});}}

function nextVehicle(){const available=cars.filter(c=>!c.traffic&&vehicleOwned(c)&&c.root.visible&&!c.destroyed);if(!available.length){hud.toast('Nessun veicolo disponibile.');return;}selectCar(cars.indexOf(available[(available.indexOf(car)+1)%available.length]),true);}

function toggle(){
 if(seekerWaiting()||damageSystem?.dead||overlayOpen())return;
 if(passenger){lanLobby.room?.send({type:'dismount'});return;}
 const driver=onFoot?nearestDriver(lanLobby?.room,person):null;
 if(driver!==null){
  if(!lanLobby.room.activities){hud.toast('I posti passeggeri richiedono il server online aggiornato.');return;}
  sendCurrentPose();
  lanLobby.room.send({type:'board',slot:driver});return;
 }
 const nearby=onFoot?nearbySharedVehicle():null;
 if(nearby){
  sendCurrentPose();
  lanLobby.room.send({type:nearby.type,id:nearby.id});return;
 }
 if(wanted?.arrested||damageSystem?.dead)return;if(prologue?.active){prologue.leave();return;}if(abballa?.blockInput||overlayOpen())return;if(onFoot&&mazzuoccolo?.interact())return;if(!onFoot){const vehicle=flying?helicopter:car;if(flying&&helicopter.altitude>1.2){hud.toast('Atterra prima di scendere.');return;}for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,0]){const distance=flying?4.5:3,x=vehicle.x+Math.sin(vehicle.yaw+angle)*distance,z=vehicle.z+Math.cos(vehicle.yaw+angle)*distance;if(candidateClear(x,z,.4)){controls.clear();person.x=x;person.z=z;person.yaw=vehicle.yaw;person.root.position.set(x,elevation(w.terrain,x,z),z);
 jumpHeight=jumpVelocity=0;onFoot=true;person.root.visible=true;speed=0;vehicle.speed=0;
 if(lanLobby?.room?.sharedParking&&vehicle.sharedId)vehicle.root.visible=false;if(flying){flying=false;document.body.classList.remove('flying');}return;}}hud.toast('Spazio insufficiente per scendere: sposta il veicolo.');}else{
  const vehicle=localBoardingVehicle();
  if(!vehicle){hud.toast('Avvicinati a un veicolo per salire.');return;}
  controls.clear();jumpHeight=jumpVelocity=0;onFoot=false;person.root.visible=false;
  if(vehicle===helicopter){
   boardingHelicopter=true;selectCar(3);boardingHelicopter=false;missionSystem.piloted();
  }else{
   if(vehicle.traffic)traffic.take(vehicle);
   car=vehicle;
  }
 }
}

mazzuoccolo=makeMazzuoccolo(missionScene,{camera,canStart:()=>!freeMode&&missionSystem.state().processionDone&&!raid?.active&&!damageSystem?.dead&&!prologue?.active,network:roadNetwork,height:(x,z)=>elevation(w.terrain,x,z),solidsNear,ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),player:()=>({onFoot,x:onFoot?person.x:flying?helicopter.x:car.x,z:onFoot?person.z:flying?helicopter.z:car.z,yaw:person.yaw}),toast:hud.toast,onWin:({throws_count,best_distance_m})=>{missionSystem.celebrate('Lu Mazzuoccl',missionSystem.complete(throws_count,best_distance_m));}});
turneia=makeTurneia(missionScene,{canStart:()=>!freeMode&&missionSystem.state().processionDone&&!raid?.active&&!damageSystem?.dead&&!prologue?.active,origin:w.origin,buildings:w.buildings,player:()=>({onFoot,x:onFoot?person.x:car.x,z:onFoot?person.z:car.z,sprinting:Math.abs(speed)>3.4}),height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),clear:candidateClear,move:(x,z,dx,dz,r)=>resolveCollision([x,z],[dx,dz],r,solidsNear(x,z,3),w.terrain),toast:hud.toast,onWin:points=>{missionSystem.celebrate('Turniata di San Vito',missionSystem.completeTurneia(points));}});
let processionReturn=null;
abballa=makeAbballa(missionScene,{origin:w.origin,height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),player:()=>({onFoot,x:onFoot?person.x:car.x,z:onFoot?person.z:car.z}),canStart:()=>!freeMode&&missionSystem.state().processionDone&&!raid?.active&&!damageSystem?.dead&&!prologue?.active&&onFoot&&!vehicleLoading&&!mazzuoccolo.aiming&&!turneia.stats().active,
 onEnter(){processionReturn={x:person.x,z:person.z,yaw:person.yaw,orbit,orbitPitch,view,camYaw};controls.clear();keys.clear();speed=0;jumpHeight=jumpVelocity=0;mouse=null;},
 onExit(){if(processionReturn){Object.assign(person,{x:processionReturn.x,z:processionReturn.z,yaw:processionReturn.yaw});({orbit,orbitPitch,view,camYaw}=processionReturn);person.root.position.set(person.x,elevation(w.terrain,person.x,person.z),person.z);person.root.rotation.y=person.yaw;person.limbs.forEach(l=>l.rotation.x=0);processionReturn=null;}camera.clearViewOffset();controls.clear();keys.clear();},
 onComplete:async record=>{
  const gain=await missionSystem.completeAbballa(record);
  missionSystem.celebrate('Abballa la Statua',gain);return gain;
 }});
function clearProcessionCars(shapes,route,distance){
 const police=policeEscort?.vehicle,escortDistance=distance+ESCORT_LEAD_METERS;
 const obstacles=police&&escortDistance<route.length?
  [...shapes,vehicleFootprint({...police,...route.at(escortDistance)})]:shapes;
 for(const vehicle of cars){
  if(!vehicle.root.visible||vehicle.autonomous)continue;
  const footprint=vehicleFootprint(vehicle);
  if(!obstacles.some(shape=>processionOverlaps(shape,footprint)))continue;
  const parking=processionParking(roadNetwork,route,vehicle,(x,z,r)=>
   (!mobileWorld||mobileWorld.isReady(x,z))&&candidateClear(x,z,r)&&(onFoot?Math.hypot(person.x-x,person.z-z)>r:true));
  if(!parking)continue;
  Object.assign(vehicle,parking,{speed:0,steer:0,slip:0,parked:true});
  updateCar(vehicle,w.terrain,0);
  if(!onFoot&&!flying&&vehicle===car){speed=0;hud.toast('Fai passare la processione.');}
 }
 if(!flying&&helicopter.root.visible&&shapes.some(shape=>processionOverlaps(shape,vehicleFootprint(helicopter))))parkHelicopter();
 return true;
}
prologue=makeProcessionPrologue(missionScene,{network:roadNetwork,canAdvance:clearProcessionCars,height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),player:()=>({onFoot,x:onFoot?person.x:car.x,z:onFoot?person.z:car.z}),canJoin:()=>!freeMode&&!raid?.active&&!damageSystem?.dead&&!abballa.active&&!mazzuoccolo.aiming&&!turneia.stats().active,meters:()=>missionSystem.state().processionMeters,isDone:()=>missionSystem.state().processionDone,
 onEnter(){document.body.classList.add('procession-active');controls.clear();keys.clear();onFoot=true;person.root.visible=true;speed=jumpHeight=jumpVelocity=0;},
 onExit(p){document.body.classList.remove('procession-active');let q=p;if(!candidateClear(q.x,q.z,.35)){for(let a=0;a<Math.PI*2;a+=Math.PI/4){const x=p.x+Math.cos(a)*2,z=p.z+Math.sin(a)*2;if(candidateClear(x,z,.35)){q={...p,x,z};break;}}}person.x=q.x;person.z=q.z;person.yaw=q.yaw;person.root.position.set(q.x,elevation(w.terrain,q.x,q.z),q.z);person.root.rotation.y=q.yaw;person.limbs.forEach(l=>l.rotation.x=0);controls.clear();keys.clear();},
 onMeters:distance=>{void missionSystem.addProcessionMeters(distance);},onComplete:()=>missionSystem.celebrate('Porta la Statua',{cp:1500,rp:75})});
let respawnPlan=null;
const respawnHome=()=>adult&&missionSystem.state().local.raid_checkpoint?.active?{...raid.center,yaw:Math.PI/2}:firstPrologue?prologue.route.at(8):initialSpawn;
damageSystem=makeVehicleDamage(scene,{vehicles:freeMode?cars.slice():cars,networkHealth:onlineMode,deathMessage:freeMode?'Ritorno in paese…':undefined,player:combatPlayer,height:(x,z)=>elevation(w.terrain,x,z),
 lineClear:(a,b,ignored)=>traceCover(a,b,(x,z,r)=>combatSolidsNear(x,z,r,ignored),(x,z)=>elevation(w.terrain,x,z)).fraction>=.995,
 onDeath(){if(onlineMode)lanLobby?.room?.send({type:'local-death'});wanted?.clear();raid?.suspend();prologue?.leave();abballa?.cancel();turneia?.reset();mazzuoccolo?.reset();controls.clear();keys.clear();mouse=null;car.speed=0;silenceEngineAudio();missionSystem.penalty();const home=respawnHome();respawnPlan={home,loading:mobileWorld?.prepareArea(home.x,home.z).then(()=>true,()=>false)};},
 async onRespawn(){const {home,loading}=respawnPlan||{home:respawnHome()};if(mobileWorld&&!await loading)await mobileWorld.prepareArea(home.x,home.z);if(onlineMode&&(flying||!helicopter.sharedId)){helicopter.sharedId=null;damageSystem.repair(helicopter);parkHelicopter();}spawnOnFoot(home);respawnPlan=null;if(onlineMode)lanLobby.room?.send({type:'respawn'});},
 onExplosion:(point,vehicle)=>{raid?.blast(point,8,vehicle);farm?.onExplosion(vehicle);}});
function sendCurrentPose(){
 if(!lanLobby?.room?.online||!onFoot||passenger)return;
 lanLobby.room.sendGameData({player:['foot',person.x,person.root.position.y,person.z,
  Math.atan2(Math.sin(person.yaw),Math.cos(person.yaw)),speed,raid.equipped]},true);
}
raid=makeRaid(scene,{enabled:adult&&!lanMode,network:roadNetwork,person,height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),solidsNear:combatSolidsNear,player:combatPlayer,
 canStart:()=>((onlineMode&&!!lanLobby?.room&&!hideActivity)||(!freeMode&&missionSystem.state().processionDone))&&!prologue.active&&!abballa.blockInput&&!mazzuoccolo.aiming&&!turneia.stats().active&&!damageSystem.dead,
 canShoot:()=>!lanMode&&!passenger&&!hideActivity&&(!onlineMode||!!lanLobby?.room)&&onFoot&&!wanted?.arrested&&!prologue.active&&!abballa.blockInput&&!mazzuoccolo.aiming&&!turneia.stats().active&&!damageSystem.dead&&!vehicleLoading&&!controls.isPaused()&&!overlayOpen(),
 harder:onlineMode,
 remoteTargets:()=>lanLobby?.room?.poses?.values()??[],
 networkFire:onlineMode?(weapon,direction,seq)=>{
  sendCurrentPose();
  lanLobby.room?.send({type:'fire',weapon,direction,seq});
 }:undefined,
 networkReload:onlineMode?(weapon,seq)=>lanLobby.room?.send({type:'reload',weapon,seq}):undefined,
 onShot:inRaid=>{if(!inRaid)wanted?.shot();},
 fireHeld:()=>controls.held('fire')||keys.has('f'),onAim:yaw=>{person.yaw=yaw;person.root.rotation.y=yaw;},progress:()=>missionSystem.state().local,save:(patch,gain)=>missionSystem.saveGameProgress(patch,gain),owned:id=>!!missionSystem.state().economy.owned[id],
 onPlayerHit:amount=>damageSystem.hitPlayer(amount),onVehicleHit:(vehicle,amount,owner)=>{if(owner!=='player'||!wanted?.hit(vehicle))damageSystem.damageVehicle(vehicle,amount);},heal:amount=>damageSystem.heal(amount),onWave:wave=>hud.toast(`Ondata ${wave}/3 respinta!`),onWin:points=>{
  if(onlineMode){hud.toast('Raid alla Rotonda completato!');return;}
  wanted?.grantRaidImmunity();
  missionSystem.celebrate('Difendi la Rotonda',missionSystem.completeRaid(points));
  hud.toast('Immunità dai Carabinieri · 30 secondi');
 },toast:hud.toast});
const contextualActions=document.createElement('div');contextualActions.className='contextual-foot-actions';contextualActions.setAttribute('aria-label','Attività nelle vicinanze');document.body.append(contextualActions);for(const selector of ['.raid-start','.procession-start','.procession-join','.procession-leave','.abballa-start','.turn-start','.turn-actions','#maz-pickup']){const button=document.querySelector(selector);if(button)contextualActions.append(button);}
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select'))return;const k=e.key.toLowerCase();if(lanLobby?.open)return;if(overlayOpen()){if(k==='escape'){e.preventDefault();if(hud.mapExpanded)hud.closeMap();else if(shop?.open)shop.close();else if(farm?.open)farm.close();else missionSystem.close();}return;}if(!missionSystem.state().user||damageSystem.dead||wanted?.arrested||controls.isPortrait())return;if(prologue?.active&&['e','escape'].includes(k)){e.preventDefault();prologue.leave();return;}if(abballa?.blockInput){abballa.keyDown(e);return;}if(controls.isPaused()||seekerWaiting())return;if(k===' '&&mazzuoccolo.aiming){e.preventDefault();if(!e.repeat)mazzuoccolo.action();return;}if(k==='escape')mazzuoccolo.reset();if(['arrowup','arrowdown','arrowleft','arrowright',' ','control'].includes(k))e.preventDefault();keys.add(k);if(!e.repeat){if(k===' ')jump();if(!freeMode&&k==='q')turneia?.call();if(k==='e'&&!farm?.interact()&&(nearbyVehicle()||!shop?.interact()))toggle();if(k==='f'){if(flying)dropBomb();else raid.queueShot();}if(k==='v')nextVehicle();if(k==='4'||k==='b')selectCar(3);if(['1','2','3'].includes(k))selectCar(Number(k)-1);if(k==='r'&&onFoot)raid.reload();if(k==='x')raid.toggleWeapon();if(k==='c')view=(view+1)%3;}started=true;});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();raid?.setMouseFire(false);mouse=null;});document.addEventListener('visibilitychange',()=>{keys.clear();accumulator=0;});
function localBoardingVehicle(){
 const available=unlocked?[...cars,helicopter]:cars;
 let nearest=6,vehicle=null;
 for(const candidate of available){
  if(!candidate.root.visible||candidate.destroyed||!vehicleOwned(candidate)||candidate.traffic&&lanLobby?.room?.sharedTraffic)continue;
  const distance=Math.hypot(person.x-candidate.x,person.z-candidate.z);
  if(distance<nearest){nearest=distance;vehicle=candidate;}
 }
 return vehicle;
}
function nearbySharedVehicle(){
 let nearest=6,vehicle=null;
 const room=lanLobby?.room;
 for(const [type,vehicles] of [['drive-parked',room?.parked],['drive-traffic',room?.traffic]]){
  for(const [id,[,x,y,z]] of vehicles??[]){
   const distance=Math.hypot(person.x-x,person.root.position.y-y,person.z-z);
   if(distance<nearest){nearest=distance;vehicle={type,id};}
  }
 }
 return vehicle;
}
function nearbyVehicle(){
 return !!passenger||nearestDriver(lanLobby?.room,person)!==null||!!nearbySharedVehicle()||!!localBoardingVehicle();
}
function jump(){if(passenger||seekerWaiting()||damageSystem?.dead||prologue?.active||abballa?.blockInput||overlayOpen())return;if(onFoot&&!controls.isPaused()&&!vehicleLoading&&jumpHeight<=.001&&jumpVelocity<=0&&!mazzuoccolo.aiming){jumpVelocity=5.1;turneia?.jump();}}
const controls=createControls({jump,fire:()=>raid.queueShot(),cancelFire:()=>raid.cancelFire(),reload:()=>raid.reload(),bomb:dropBomb,enter:toggle,switch:nextVehicle,camera:()=>{if(!seekerWaiting())view=(view+1)%3;},reset:()=>{if(!onlineMode)reset();},pause(){keys.clear();mouse=null;raid?.setMouseFire(false);accumulator=0;abballa?.pause('Ruota il telefono in orizzontale, poi riprendi la musica.');silenceEngineAudio();}});
renderer.domElement.addEventListener('pointerdown',e=>{if(seekerWaiting()||damageSystem.dead||wanted?.arrested||controls.isPaused()||overlayOpen()||abballa?.blockInput)return;if(e.pointerType==='mouse'&&e.button===0){raid.setMouseFire(true);raid.queueShot();}if(e.pointerType==='touch'&&e.clientX<innerWidth*.45)return;if(mouse)return;mouse={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);started=true;});renderer.domElement.addEventListener('pointermove',e=>{if(mouse&&e.pointerId===mouse.id){const dragYaw=-(e.clientX-mouse.x)*.006;orbit+=dragYaw;if(onFoot&&mazzuoccolo.aiming){person.yaw+=dragYaw;mazzuoccolo.rotate(dragYaw);}orbitPitch=THREE.MathUtils.clamp(orbitPitch+(e.clientY-mouse.y)*.004,-.3,.8);mouse.x=e.clientX;mouse.y=e.clientY;}});renderer.domElement.addEventListener('pointerup',e=>{raid.setMouseFire(false);if(mouse?.id===e.pointerId)mouse=null;});renderer.domElement.addEventListener('pointercancel',e=>{raid.setMouseFire(false);if(mouse?.id===e.pointerId)mouse=null;});renderer.domElement.addEventListener('lostpointercapture',e=>{raid.setMouseFire(false);if(mouse?.id===e.pointerId)mouse=null;});
function onOverlayToggle(open){
 if(open)silenceEngineAudio();
 raid.cancelFire();raid.setMouseFire(false);controls.clear();keys.clear();mouse=null;accumulator=0;
}
if(!freeMode)shop=makeEconomyShop({actions:contextualActions,progress:missionSystem.state,buy:missionSystem.buy,adult,toast:hud.toast,onToggle:onOverlayToggle,
 near:()=>onFoot&&!prologue.active&&!raid.active&&!damageSystem.dead&&!controls.isPaused()&&Math.hypot(person.x-heliPad.x,person.z-heliPad.z)<24});
hud.onMapToggle=onOverlayToggle;
missionSystem.onToggle=onOverlayToggle;
function guideRoute(from,target,label,show){
 let points=[];
 try{points=roadRoute(roadNetwork,{x:from.x,z:from.z},{x:target.x,z:target.z}).points;}catch{}
 return hud.guide(points,target,label,show);
}
hud.onMapNavigate=point=>guideRoute(onFoot?person:flying?helicopter:car,point,point.label,false);
missionSystem.onNavigate=(id,label)=>{
 const local=missionSystem.state().local;
 const farmPoint=i=>{const [,,lat,lon]=FARM_LOCATIONS[i];return {lat,lon};};
 const destinations={procession:PROCESSION_START,mazzuoccolo:MAZZUOCCOLO_START,turneia:SAN_VITO,
  statue:{lat:40.656598,lon:15.403656},raid:RAID_CENTER,
  wine:farmPoint(local.farm_wine?.stage==='haul'&&(local.farm_wine.loaded||local.farm_wine.carrying==='cellar')?1:0),
  pigs:farmPoint(local.farm_pigs?.stage==='carry'?3:2),mill:farmPoint(4),chicks:farmPoint(5),potatoes:farmPoint(6),wheat:farmPoint(7),shop:HELIPORT};
 const target=id==='mill'&&farm?farm.wheatTarget():worldLocation(w.origin,destinations[id]),actor=onFoot?person:flying?helicopter:car;
 missionSystem.close();
 guideRoute(actor,target,label,true);
};

$('audio').onclick=()=>{if(!toggleEngineAudio())hud.toast('Audio non disponibile in questo browser.');};
policeEscort=makePoliceEscort(scene);
const stationLocation=worldLocation(w.origin,{lat:40.659935,lon:15.401172});
const stationRoad=roadNetwork.closestSegment(stationLocation.x,stationLocation.z);
const station=stationRoad?{x:stationRoad.q[0],z:stationRoad.q[1],yaw:Math.atan2(stationRoad.segment.b.x-stationRoad.segment.a.x,stationRoad.segment.b.z-stationRoad.segment.a.z)}:stationLocation;
if(adult&&!freeMode)wanted=makeWanted(scene,{station,
 network:roadNetwork,terrain:w.terrain,player:combatPlayer,clear:candidateClear,solidsNear,
 ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),height:(x,z)=>elevation(w.terrain,x,z),
 blocked:(x,z)=>prologue.blocksTraffic(x,z),toast:hud.toast,
 lineClear:(from,target,vehicle)=>{
  const hit=traceCover({x:from.x,y:from.y+1.25,z:from.z},target,(x,z,r)=>combatSolidsNear(x,z,r,[vehicle]),(x,z)=>elevation(w.terrain,x,z));
  return hit.fraction>=.995||!!target.vehicle&&hit.solid?.vehicle===target.vehicle;
 },
 onArrest(){
  controls.clear();keys.clear();mouse=null;raid.holster();car.speed=0;
  missionSystem.penalty();spawnOnFoot(station);
 },
 onRelease(){hud.toast('Rilasciato · −20% dal borsellino');},
});
traffic=makeTraffic(scene,w,roadNetwork,(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),c=>prologue.blocksTraffic(c.x,c.z),freeMode?2:6);
cars.push(...traffic.vehicles);
if(!freeMode){
 const farmRambo=makeCar(scene,'rambo');
 farmRambo.root.visible=false;
 cars.push(farmRambo);
 farm=makeFarmMissions(scene,{
  origin:w.origin,network:roadNetwork,height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),
  player:()=>{const actor=onFoot?person:flying?helicopter:car;return {x:actor.x,z:actor.z,onFoot,vehicle:onFoot?null:actor};},
  person,rambo:farmRambo,actions:contextualActions,toast:hud.toast,celebrate:missionSystem.celebrate,onOverlay:onOverlayToggle,
  guideDelivery:(from,target,label="Porta l’uva a la grotta · Scarico")=>guideRoute(from,target,label,false),
  transact:missionSystem.transact,economy:()=>missionSystem.state().economy,progress:()=>missionSystem.state().local,save:patch=>missionSystem.saveGameProgress(patch),
  enabled:()=>missionSystem.state().processionDone&&!prologue.active&&!raid.active&&!abballa.blockInput&&!turneia.stats().active&&!mazzuoccolo.aiming&&!damageSystem.dead&&!vehicleLoading&&!controls.isPaused()&&!overlayOpen(),
  park(point){
   damageSystem.repair(farmRambo);
   Object.assign(farmRambo,point,{speed:0,parked:true,steer:0,slip:0});
   updateCar(farmRambo,w.terrain,0);farmRambo.root.visible=true;
  },
 });
}
const updateMunicipioCrowd=!freeMode&&makeMunicipioCrowd(scene,{origin:w.origin,height:(x,z)=>elevation(w.terrain,x,z),
 ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),clear:candidateClear});
const spawnHome=firstPrologue?prologue.route.at(8):initialSpawn;if(mobileWorld)await mobileWorld.prepareArea(spawnHome.x,spawnHome.z);reset();
document.body.classList.toggle('lan-mode',freeMode);
lanLobby=onlineMode?installOnlineLobby(onOverlayToggle,event=>{
 if(event.type==='joined'){
  traffic.reset();reset();damageSystem.setNetworkHealth(100);raid.refill?.();
 }else if(event.type==='left'){
  clearDeathLog();
  if(crewVehicle){showPassengers(crewVehicle.root,crewVehicle.spec.id,0);crewVehicle=null;}
  remoteFlashes.clear();tracers?.clear();
  for(const vehicle of [...cars,helicopter])if(vehicle.sharedId){
   vehicle.sharedId=null;
   if(!shopCars.includes(vehicle)&&vehicle!==helicopter)vehicle.root.visible=false;
  }
  dismountPassenger();hideActivity=null;hidePanel.hidden=true;raid.suspend();
 }else if(event.type==='hide'){
  hideActivity=event.phase==='idle'?null:event;
  hideDeadline=performance.now()+event.seconds*1000;
  updateHideStatus();
  if(hideActivity)raid.suspend();
  if(seekerWaiting()){
   controls.clear();keys.clear();mouse=null;
   if(event.counting){
    const {x,y,z,yaw}=event.counting;
    Object.assign(person,{x,z,yaw});person.root.position.set(x,y,z);
    person.root.rotation.y=yaw;
    camYaw=yaw;orbit=orbitPitch=jumpHeight=jumpVelocity=speed=0;view=0;
    camera.position.set(x-Math.sin(yaw)*4.6,y+2.2,z-Math.cos(yaw)*4.6);
   }
  }
  if(event.result)hud.toast(event.result);
 }else if(event.type==='vehicle'){
  const vehicle=event.kind==='helicopter'?helicopter:car;
  vehicle.sharedId=event.id;
  if(onFoot)vehicle.root.visible=false;
 }else if(event.type==='drive-parked'){
  const [kind,x,y,z,yaw]=event.pose;
  const vehicle=kind==='helicopter'?helicopter:cars.find(candidate=>candidate.sharedId===event.id)??makeCar(scene,kind);
  if(vehicle!==helicopter&&!cars.includes(vehicle))cars.push(vehicle);
  damageSystem.repair(vehicle);
  Object.assign(vehicle,{sharedId:event.id,x,y,z,yaw,speed:0,steer:0,slip:0,parked:true});
  vehicle.root.visible=true;
  onFoot=false;person.root.visible=false;controls.clear();keys.clear();
  if(vehicle===helicopter){
   boardingHelicopter=true;selectCar(3);boardingHelicopter=false;
   updateHelicopter(helicopter,0);
  }else{
   car=vehicle;updateCar(car,w.terrain,0);
   speed=0;camYaw=yaw;orbit=orbitPitch=0;view=0;
  }
 }else if(event.type==='seat'){
  if(event.driver===null){dismountPassenger();return;}
  if(passenger?.slot===event.driver)return;
  const spec=VEHICLES[event.pose[0]];
  passenger={slot:event.driver,pose:event.pose,audio:spec?{spec,speed:0}:null};
  const [,x,y,z,yaw]=event.pose;
  Object.assign(person,{x,z,yaw});
  person.root.position.set(x,y,z);
  camYaw=yaw;orbit=orbitPitch=0;view=0;
  controls.clear();keys.clear();raid.holster();person.root.visible=false;
  hud.toast('Sei a bordo come passeggero.');
 }else if(event.type==='notice')hud.toast(event.message);
 else if(event.type==='death-log')showDeath(event);
 else if(event.type==='ammo')raid.syncAmmo?.(event);
 else if(event.type==='health')damageSystem.setNetworkHealth(event.value);
 else if(event.type==='hit')hud.toast(event.down?'Giocatore a terra':'Colpito');
 else if(event.type==='shot'){
  const local=flying?helicopter:onFoot?person:car;
  if(!event.self){
   playGunSound(true,Math.hypot(local.x-event.x,local.z-event.z),event.weapon);
   if(Number.isInteger(event.slot))remoteFlashes.set(event.slot.toString(16).padStart(24,'0'),{weapon:event.weapon,until:performance.now()+140});
  }
  if(!event.self||!raid.active)tracers?.shot(event);
 }
}):installLanLobby(onOverlayToggle);
const updateLanWorld=freeMode&&createLanWorld(scene,{terrain:w.terrain,traffic,ambient:!onlineMode,plaza:processionLocation(w.origin),
 height:(x,z)=>elevation(w.terrain,x,z),clear:candidateClear,ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z)});
const clock=new THREE.Clock();const cameraTarget=new THREE.Vector3(),lookTarget=new THREE.Vector3(),focus=new THREE.Vector3(),cameraProbe=new THREE.Vector3(),probePoint=[0,0];let hudCounter=0,perfFrames=0,perfTime=0,qualityTime=0;const step=1/90,footDistances=[4.6,8,18],carDistances=[8.5,13,29],footHeights=[2.2,3.4,18],carHeights=[2.6,4.2,27],heliDistances=[15,22,35],heliHeights=[6,10,28];
const pressed=k=>keys.has(k)||controls.held(k);
function physics(dt){if(wanted?.arrested)return;if(damageSystem.dead||overlayOpen()||!missionSystem.state().user||seekerWaiting())return;
 if(passenger)return;
 if(prologue?.active){const j=controls.joystick,paused=controls.isPaused()||vehicleLoading,turn=paused?0:(j.active?-j.x:Number(pressed('a')||pressed('arrowleft'))-Number(pressed('d')||pressed('arrowright')))*2.5*dt;prologue.rotate(turn);if(controls.touch)camYaw+=turn;speed=0;return;}if(abballa?.blockInput){speed=0;return;}if(vehicleLoading||controls.isPaused()||mobileWorld&&!mobileWorld.isReady(flying?helicopter.x:onFoot?person.x:car.x,flying?helicopter.z:onFoot?person.z:car.z))return;const forward=Number(pressed('w')||pressed('arrowup'))-Number(pressed('s')||pressed('arrowdown')),steer=Number(pressed('a')||pressed('arrowleft'))-Number(pressed('d')||pressed('arrowright'));
 if(flying){const j=controls.joystick,flightForward=j.active?-j.y:forward,flightTurn=j.active?-j.x:steer;const lift=Number(pressed(' '))-Number(pressed('control'));const impact=advanceHelicopter(helicopter,{forward:flightForward,turn:flightTurn*.72,strafe:flightTurn,lift},dt,(px,pz)=>elevation(w.terrain,px,pz),solidsNear,w.terrain,(px,pz)=>!mobileWorld||mobileWorld.isReady(px,pz));if(onlineMode&&impact)damageSystem.impact(helicopter,impact);updateHelicopter(helicopter,dt,flightForward,flightTurn);speed=Math.hypot(helicopter.speed,helicopter.strafeSpeed);return;}
 if(onFoot){let delta,v;const j=controls.joystick;if(mazzuoccolo.aiming){const turn=(j.active?-j.x:steer)*2.5*dt;person.yaw+=turn;mazzuoccolo.rotate(turn);v=0;delta=[0,0];}else if(j.active){const magnitude=Math.min(1,Math.hypot(j.x,j.y)),heading=camYaw+orbit;const pace=pressed('shift')||j.sprinting?7.2:3.2;v=magnitude*pace;const dx=Math.sin(heading)*-j.y-Math.cos(heading)*j.x,dz=Math.cos(heading)*-j.y+Math.sin(heading)*j.x;delta=[dx*pace*dt,dz*pace*dt];if(magnitude>.08)person.yaw=Math.atan2(dx,dz);}else{person.yaw+=steer*2.5*dt;v=forward*(pressed('shift')?7.2:3.2);delta=[Math.sin(person.yaw)*v*dt,Math.cos(person.yaw)*v*dt];}
 [person.x,person.z]=resolveCollision([person.x,person.z],delta,.32,solidsNear(person.x,person.z),w.terrain);jumpVelocity-=14*dt;jumpHeight=Math.max(0,jumpHeight+jumpVelocity*dt);if(!jumpHeight)jumpVelocity=0;person.root.position.set(person.x,elevation(w.terrain,person.x,person.z)+jumpHeight,person.z);person.root.rotation.y=person.yaw;person.limbs.forEach((m,i)=>m.rotation.x=Math.abs(v)>.1?Math.sin(elapsed*9+i%2*Math.PI)*.45:0);speed=v;
 }else{if(car.destroyed){car.speed=speed=0;return;}if(car.parked&&!forward){car.speed=speed=0;updateCar(car,w.terrain,dt);return;}car.parked=false;car.throttle=forward;car.braking=pressed(' ')||forward*car.speed<-.5;const before=Math.abs(car.speed),result=advanceVehicle(car,{forward,steer,brake:pressed(' '),handbrake:pressed(' ')},dt,w.terrain,vehicleSolidsNear);if(result.hit)car.hitAt=elapsed;if(result.hit){damageSystem.impact(car,result.impactSpeed||0);raid.ram(car,before);}speed=car.speed;updateCar(car,w.terrain,dt);}}

function syncLanWorld(dt,now,simulating){
 const actor=flying?helicopter:onFoot?person:car;
 const vehicleKind=onlineMode&&car.traffic
  ? (car.wheels===car.variants[1].wheels?'rambo':'punto')
  : car.spec.id;
 const kind=flying?'helicopter':onFoot?'foot':vehicleKind;
 updateLanWorld(lanLobby.room,dt,now,{actor,kind,speed,weapon:raid.equipped,flashes:remoteFlashes,passenger:!!passenger},simulating);
}
let lastFrame=0;
function animate(frameTime=performance.now()){animationFrame=0;if(!contextSafety.canRender)return;animationFrame=requestAnimationFrame(animate);const frameInterval=1000/30;if(MOBILE&&frameTime-lastFrame<frameInterval-.5)return;lastFrame=MOBILE?frameTime-Math.max(0,(frameTime-lastFrame-frameInterval)%frameInterval):frameTime;const dt=Math.min(clock.getDelta(),.08);const paused=controls.isPortrait()||overlayOpen();
 if(freeMode&&paused)syncLanWorld(dt,frameTime,false);
 if(paused){accumulator=0;return;}
 if(passenger){
  passenger.pose=lanLobby.room?.vehicleAt?.(passenger.slot,frameTime)??lanLobby.room?.poses?.get(passenger.slot)??passenger.pose;
  const [,x,y,z,yaw,velocity]=passenger.pose;
  Object.assign(person,{x,z,yaw});
  person.root.position.set(x,y,z);
  speed=velocity;
 }
 elapsed+=dt;accumulator+=dt;while(accumulator>=step){physics(step);accumulator-=step;}if(!controls.isPaused()&&!vehicleLoading&&!overlayOpen()){damageSystem.update(dt);if(!damageSystem.dead){if(!padReady&&mobileWorld.isReady(heliPad.x,heliPad.z)){
 fitHelipad();padReady=true;
 for(const c of shopCars)if(c.parked)updateCar(c,w.terrain,0);
 if(!flying&&helicopter.x===heliPad.x&&helicopter.z===heliPad.z)parkHelicopter();
}if(onlineMode){
  raid.update(dt);updateHideStatus();tracers.update(dt);
  const nextCrewVehicle=onFoot?null:flying?helicopter:car;
  if(crewVehicle&&crewVehicle!==nextCrewVehicle)showPassengers(crewVehicle.root,crewVehicle.spec.id,0);
  crewVehicle=nextCrewVehicle;
  if(crewVehicle){
   const kind=crewVehicle.traffic?(crewVehicle.wheels===crewVehicle.variants[1].wheels?'rambo':'punto'):crewVehicle.spec.id;
   showPassengers(crewVehicle.root,kind,lanLobby.room?.crews?.get(lanLobby.room.id)??0);
  }
 }if(!freeMode){raid.update(dt);if(raid.active)wanted?.clear();else wanted?.update(dt);abballa.update(dt);prologue.update(dt);const escort=prologue.escortPosition();
 policeEscort.update(escort&&(!mobileWorld||mobileWorld.isReady(escort.x,escort.z))?escort:null,w.terrain,dt,elapsed);}}}if(prologue.active){const pose=prologue.bearerPose();Object.assign(person,{x:pose.x,z:pose.z,yaw:pose.yaw});person.root.position.set(pose.x,pose.y,pose.z);person.root.rotation.y=pose.yaw;person.limbs.forEach((l,i)=>l.rotation.x=i<2?Math.sin(elapsed*6+i*Math.PI)*.13:-.85);}if(abballa.active){const pose=abballa.model.bearerPose();Object.assign(person,{x:pose.x,z:pose.z,yaw:pose.yaw});person.root.position.set(pose.x,pose.y,pose.z);person.root.rotation.y=pose.yaw;person.limbs.forEach((l,i)=>l.rotation.x=i<2?pose.kick*.18:-.85);}if(onFoot&&raid.armed&&!prologue.active){person.limbs[2].rotation.x=-1.15;person.limbs[3].rotation.x=-.8;}const cameraOnFoot=onFoot&&!passenger,cameraFlying=flying||passenger?.pose[0]==='helicopter';const actor=flying?helicopter:onFoot?person:car;const x=actor.x,z=actor.z,y=passenger?person.root.position.y:flying?helicopter.y:onFoot?elevation(w.terrain,x,z):car.root.position.y;if(!(cameraOnFoot&&controls.touch)){const desiredYaw=actor.yaw+(!onFoot&&!flying&&car.spec.id==='punto'&&Math.hypot(x-puntoHome.x,z-puntoHome.z)<8?Math.PI:0),angle=Math.atan2(Math.sin(desiredYaw-camYaw),Math.cos(desiredYaw-camYaw));camYaw+=angle*(1-Math.exp(-dt*(cameraOnFoot?4:2.2)));}const heading=camYaw+orbit,shoulder=cameraOnFoot&&raid.armed&&(raid.active||onlineMode)&&!abballa.active;const dist=cameraFlying?heliDistances[view]:cameraOnFoot?footDistances[view]:carDistances[view],height=cameraFlying?heliHeights[view]:cameraOnFoot?footHeights[view]:carHeights[view];cameraTarget.set(x-Math.sin(heading)*dist+(shoulder?Math.cos(heading)*.95:0),y+height+(shoulder?jumpHeight*.5:orbitPitch*12),z-Math.cos(heading)*dist-(shoulder?Math.sin(heading)*.95:0));cameraTarget.y=Math.max(cameraTarget.y,elevation(w.terrain,cameraTarget.x,cameraTarget.z)+1.2);
// Push the camera in front of intervening walls rather than putting it inside houses.
focus.set(x,y+(cameraOnFoot?1.55:car.spec.id==='panda'?1.65:1.15),z);
const cameraSolids=solidsNear(x,z,Math.max(dist+3,Math.min(60,camera.position.distanceTo(focus)+2))).filter(solid=>!passenger||!solid.vehicle||!inBuilding([x,z],solid)),cameraMargin=Math.max(.28,camera.near*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*Math.hypot(1,camera.aspect))+.02;
let cameraBlocked=false;
if(!cameraFlying){const fraction=cameraCollisionFraction(focus,cameraTarget,cameraSolids,cameraMargin);if(fraction<1){cameraBlocked=true;cameraTarget.lerpVectors(focus,cameraTarget,fraction);}
 // In a narrow street, move above the car instead of pushing the lens into its cabin.
 if(!cameraOnFoot&&cameraTarget.distanceTo(focus)<3){cameraTarget.set(x-Math.sin(heading)*1.1,focus.y+4.5,z-Math.cos(heading)*1.1);const above=cameraCollisionFraction(focus,cameraTarget,cameraSolids,cameraMargin);cameraTarget.lerpVectors(focus,cameraTarget,above);}
}
if(!Number.isFinite(camera.position.lengthSq()))camera.position.copy(cameraTarget);
if(cameraBlocked&&camera.position.distanceTo(focus)>cameraTarget.distanceTo(focus)+.2)camera.position.copy(cameraTarget);else camera.position.lerp(cameraTarget,1-Math.exp(-dt*(passenger?12:7)));
// Recheck the smoothed position too: orbiting around corners can cut through a wall.
if(!cameraFlying){const fraction=cameraCollisionFraction(focus,camera.position,cameraSolids,cameraMargin);if(fraction<1)camera.position.lerpVectors(focus,camera.position,fraction);}
camera.position.y=Math.max(camera.position.y,elevation(w.terrain,camera.position.x,camera.position.z)+.5);
for(const vehicle of shopCars)if(vehicle.rider)vehicle.rider.visible=!onFoot&&!flying&&!damageSystem.dead&&vehicle===car;
if(shoulder)lookTarget.set(camera.position.x+Math.sin(heading)*40,camera.position.y-(.045+orbitPitch*.7)*40,camera.position.z+Math.cos(heading)*40);else lookTarget.set(x,focus.y,z);const shake=damageSystem.shake+(onFoot?0:Math.max(0,(Math.abs(speed)*3.6-250)/100)*.065);camera.position.x+=Math.sin(elapsed*43)*shake;camera.position.y+=Math.sin(elapsed*71)*shake*.5;camera.lookAt(lookTarget);if(abballa.active){const p=abballa.model.location,cy=elevation(w.terrain,p.x,p.z),forward=new THREE.Vector3(Math.sin(p.yaw),0,Math.cos(p.yaw)),right=new THREE.Vector3(Math.cos(p.yaw),0,-Math.sin(p.yaw));camera.position.set(p.x+forward.x*4+right.x*5.2,cy+3.1,p.z+forward.z*4+right.z*5.2);camera.lookAt(p.x,cy+1.95,p.z);const landscape=innerWidth>innerHeight;camera.setViewOffset(innerWidth,innerHeight,landscape?innerWidth*.20:0,landscape?0:innerHeight*.20,innerWidth,innerHeight);}snapSunShadow(atmosphere.light,atmosphere.sun,x,y,z);const fov=60+(MOBILE?0:18)*Math.min(1,Math.abs(speed)/(350/3.6));camera.fov=THREE.MathUtils.lerp(camera.fov,fov,1-Math.exp(-dt*3));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);teglie?.updateVisibility(x,z,(scene.fog?.far??camera.far)+120);animateAvatar(dt,prologue.active?1.05:cameraOnFoot?speed:0,jumpHeight>.03);if(!lanMode&&!damageSystem.dead&&!controls.isPaused()&&!vehicleLoading)raid.aimFrame(camera);terrainLOD(x,z,camera);baseLOD(x,z,camera);if(!damageSystem.dead||!mobileWorld)staticBatches.userData.updateDetail(x,z,camera);if(passenger?.audio){
 passenger.audio.speed=speed;
 updatePowertrain(passenger.audio,dt,0);
 updateEngineAudio(passenger.audio,damageSystem.dead);
}else updateEngineAudio(flying?helicopter:car,onFoot||damageSystem.dead||car.destroyed);updateWorldAudio(dt,{playing:!damageSystem.dead&&!wanted?.arrested&&!controls.isPaused()&&!vehicleLoading&&!abballa.blockInput,walkSpeed:cameraOnFoot&&jumpHeight<=.025?(prologue.active?1.05:Math.abs(speed)):0,onFoot:cameraOnFoot});hudCounter+=dt;if(hudCounter>.08){hud.update(x,z,y,actor.yaw,speed,onFoot,hudCounter,flying?helicopter:car,unlocked?helicopter:null,ferrariUnlocked?ferrari:null,onlineMode?null:prologue.marker(),damageSystem.health);const enterButton=document.querySelector('[data-action=enter]');enterButton.hidden=damageSystem.dead||onFoot&&!nearbyVehicle();boardingIcon(enterButton,onFoot&&!passenger);const nearHeli=onFoot&&!passenger&&unlocked&&helicopter.root.visible&&Math.hypot(person.x-helicopter.x,person.z-helicopter.z)<6;enterButton.setAttribute('aria-label',nearHeli?'Sali sull’Elicottero':flying?'Scendi':onFoot&&!passenger?'Sali a bordo':'Scendi dal veicolo');enterButton.title=enterButton.getAttribute('aria-label');enterButton.disabled=flying&&helicopter.altitude>1.2;document.body.classList.toggle('near-helicopter',nearHeli);hudCounter=0;}if(!freeMode&&!damageSystem.dead&&!controls.isPaused()&&!vehicleLoading&&!overlayOpen()){bombs.update(dt);mazzuoccolo.update(dt);turneia.update(dt);farm.update(dt);shop.update();traffic.update(dt,{x,z});updateMunicipioCrowd(x,z);
 const band=prologue.bandPosition();updateProcessionMarch(band?Math.hypot(x-band.x,z-band.z,flying?Math.max(0,helicopter.altitude):0):Infinity);
 }
 if(onlineMode&&!lanLobby.room?.sharedTraffic&&!damageSystem.dead&&!controls.isPaused()&&!vehicleLoading)traffic.update(dt,{x,z});
 if(freeMode)syncLanWorld(dt,frameTime,!damageSystem.dead&&!controls.isPaused()&&!vehicleLoading);vehicleEffects.update(dt,car,camera,onFoot||flying||damageSystem.dead||car.destroyed,elapsed);renderer.render(scene,camera);perfFrames++;perfTime+=dt;qualityTime+=dt;if(perfTime>=1){document.documentElement.dataset.performance=JSON.stringify({position:{x:+x.toFixed(2),z:+z.toFixed(2),...geographicLocation(w.origin,{x,z})},calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps:Math.round(perfFrames/perfTime),bombs:bombs.stats(),car:flying?'helicopter':car.spec.id,speedKmh:Math.round(Math.abs(speed)*3.6),gear:vehicleGear(car),onFoot,staticBatches:staticBatches.children.length,pixelRatio:renderer.getPixelRatio(),logDepth:renderer.capabilities.logarithmicDepthBuffer,near:camera.near,far:camera.far,streaming:mobileWorld?.stats(),mobile:MOBILE,shadows:renderer.shadowMap.enabled,textures:renderer.info.memory.textures,framebufferPixels:renderer.domElement.width*renderer.domElement.height,contextLosses:contextSafety.losses,helpOpen:controls.isPaused(),braking:car.braking,audio:engineAudioDiagnostics(),fov:camera.fov,cameraFinite:Number.isFinite(camera.position.lengthSq())&&camera.matrixWorld.elements.every(Number.isFinite)});if(qualityTime>3){const fps=perfFrames/perfTime;if(fps<(MOBILE?26:55)&&renderer.getPixelRatio()>.8)renderer.setPixelRatio(Math.max(.8,renderer.getPixelRatio()*.85));qualityTime=0;}perfFrames=0;perfTime=0;}}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(!MOBILE){renderer.setPixelRatio(Math.min(renderer.getPixelRatio(),pixelRatioFor(innerWidth,innerHeight,devicePixelRatio)));renderer.setSize(innerWidth,innerHeight);}});window.__SGM={raid,wanted,damageSystem,saveGameProgress:missionSystem.saveGameProgress,prologue,abballa,turneia,missionSystem,mazzuoccolo,bombs,helicopter,selectVehicle:selectCar,mobileRuntime:mobileWorld,roadNetwork,world:w,cars,get car(){return car;},person,scene,camera,renderer,getElevationAt:(x,z)=>elevation(w.terrain,x,z),getState:()=>({onFoot,flying,passenger:!!passenger,x:flying?helicopter.x:onFoot?person.x:car.x,z:flying?helicopter.z:onFoot?person.z:car.z,speed,frames:renderer.info.render.frame}),reset,toggle};clearInput=()=>{abballa?.pause();controls.clear();keys.clear();raid?.setMouseFire(false);mouse=null;accumulator=0;silenceEngineAudio();};startFrames=()=>{if(animationFrame||!contextSafety.canRender)return;clock.getDelta();accumulator=0;animate();};startFrames();if(MOBILE)document.documentElement.dataset.mobileBoot=JSON.stringify({milliseconds:Math.round(performance.now()-Number(document.body.dataset.bootStarted||0)),fullWorldRequests:performance.getEntriesByType('resource').filter(e=>/\/data\/(world-data|urban-aprons|dbt-extras|geometry)-/.test(e.name)).length,framebuffer:[renderer.domElement.width,renderer.domElement.height]});$('loading').style.opacity=0;setTimeout(()=>$('loading').remove(),1100);}catch(e){console.error(e);$('load-status').textContent=`Impossibile caricare il mondo: ${e.message}. Ricarica per riprovare.`;}
