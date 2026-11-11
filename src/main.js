import {updateVehicleVisuals} from './vehicle-visuals.js';
import {installTeglieWorld} from './teglie-world.js';
import {makeTeglieDistrict} from './teglie-district.js';
import {makeEconomyShop} from './economy-shop.js';
import {formatCP,rewardTeglieDrag} from './economy.js';
import {makeWanted} from './wanted.js';
import {makeMunicipioCrowd} from './procession-people.js';
import {installAnimatedAvatar} from './animated-avatar.js';
import {FARM_LOCATIONS} from './farm-locations.js';
import {makeFarmMissions} from './farm-missions.js';
import {applyLocalWorldEdits} from './local-world-edits.js';
import {makeBaccanaliaSign} from './baccanalia-sign.js';
import {makeRaid,RAID_CENTER} from './raid.js';
import {makeVehicleDamage} from './vehicle-damage.js';
import {segmentSphere,traceCover} from './combat-geometry.js';
import {boardingIcon} from './action-icons.js';
import {findFootSpawn} from './foot-spawn.js';
import {processionOverlaps} from './procession-collisions.js';
import {signedInUser} from './login-gate.js';
import {makeProcessionPrologue,ESCORT_LEAD_METERS} from './procession.js';
import {roadRoute,PROCESSION_START,processionParking} from './procession-route.js';
import {cameraCollisionFraction} from './camera-clearance.js';
import {makeAbballa} from './abballa.js';
import {makeTurneia,SAN_VITO} from './turneia.js';
import {createMissions} from './missions.js';
import {makeTraffic} from './traffic.js';
import {HELIPORT,MAZZUOCCOLO_START,worldLocation,geographicLocation} from './game-locations.js';
import {puntoSpawn,buildingCollisionParts} from './punto-location.js';
import {makeMazzuoccolo} from './mazzuoccolo.js';
import {makeBombs} from './bombs.js';
import {makeHelicopter,updateHelicopter} from './helicopter.js';
import {advanceHelicopter,OFFLINE_HELICOPTER_MAX_SPEED} from './helicopter-physics.js';
import {updateProcessionMarch,updateWorldAudio,toggleEngineAudio,updateEngineAudio,silenceEngineAudio,engineAudioDiagnostics} from './engine-audio.js';
import {MOBILE,pixelRatioFor} from './device-profile.js';
import {installContextSafety} from './context-safety.js';
import {loadWorldJSON} from './world-assets.js';
import {createControls,detectTouch} from './controls.js';
import {makeVehicleEffects} from './vehicle-effects.js';
import {terrainDistanceDetail,indexNearbyDetail} from './distance-detail.js';
import {batchStaticWorld,snapSunShadow} from './static-batches.js';
import {advanceVehicle,vehicleGear,vehicleFootprint} from './vehicle-physics.js';
import {additionalUrbanBuildings} from './urban-aprons.js';
import {makeDbtDetails} from './dbt-details.js';import {createStairPlans,installDbtSteps,extraColliders,roadSurfaceFeatures} from './dbt-plan.js';
import './style.css';import {makeRoadDetails} from './road-details.js';import {makeVillageDetails} from './village-details.js';import {loadRoadMeshCache} from './road-cache.js';import {createRoadNetwork,SpatialIndex} from './road-network.js';import {makeRoads} from './roads.js';import * as THREE from 'three';import {makeTerrain,makeBuildings,makeAtmosphere} from './environment.js';import {makeCar,updateCar,makePerson,makePoliceEscort} from './actors.js';import {elevation,resolveCollision,inBuilding,nearest} from './world-math.js';import {createHUD} from './hud.js';
const $=id=>document.getElementById(id);
function setLoadProgress(percent,label){
 $('load-progress').value=percent;
 $('load-percent').textContent=percent+'%';
 const status=$('load-status');
 if(status.textContent!==label)status.textContent=label;
}
async function showLoadStep(percent,label){
 setLoadProgress(percent,label);
 await new Promise(resolve=>setTimeout(resolve,20));
}
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:!MOBILE,logarithmicDepthBuffer:true,powerPreference:MOBILE?'default':'high-performance',alpha:false,stencil:false,depth:true,preserveDrawingBuffer:false});}catch(e){$('load-status').textContent='WebGL non disponibile. Apri il gioco in un browser con accelerazione grafica.';throw e;}
renderer.userData={mobile:MOBILE};renderer.setPixelRatio(MOBILE?1:pixelRatioFor(innerWidth,innerHeight,devicePixelRatio));renderer.setSize(MOBILE?640:innerWidth,MOBILE?640:innerHeight,!MOBILE);renderer.shadowMap.enabled=!MOBILE;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;$('game').append(renderer.domElement);const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.16,4000);let w;
let animationFrame=0,startFrames=()=>{},clearInput=()=>{};const gpuNotice=document.createElement('div');gpuNotice.id='gpu-status';gpuNotice.hidden=true;gpuNotice.setAttribute('role','status');const gpuText=document.createElement('p'),retry=document.createElement('button');retry.textContent='Riprova';retry.onclick=()=>location.reload();gpuNotice.append(gpuText,retry);document.body.append(gpuNotice);const contextSafety=installContextSafety(renderer,{stop:()=>{cancelAnimationFrame(animationFrame);animationFrame=0;},clear:()=>clearInput(),resume:()=>startFrames(),show:(text,canRetry)=>{gpuText.textContent=text;retry.hidden=!canRetry;gpuNotice.hidden=false;document.documentElement.dataset.webgl='lost';},hide:()=>{gpuNotice.hidden=true;document.documentElement.dataset.webgl='ready';}});

let visualLab=null;
let traffic=null,policeEscort=null,wanted=null,teglieDistrict=null;
let impactDamageEnabled=true,trafficEnabled=true;
try{let mobileWorld=null,roadNetwork,atmosphere,terrainLOD=()=>{},baseLOD=()=>{},staticBatches;await showLoadStep(5,MOBILE?'Caricamento del quartiere…':'Lettura della mappa…');if(MOBILE){mobileWorld=await (await import('./mobile-world.js')).initMobileWorld(scene);w=mobileWorld.world;roadNetwork=mobileWorld.network;atmosphere=mobileWorld.atmosphere;staticBatches=mobileWorld.batches;}else{w=await loadWorldJSON('world-data');if(MOBILE){w.urbanAprons=await loadWorldJSON('urban-aprons');w.dbtExtras=await loadWorldJSON('dbt-extras');}else [w.urbanAprons,w.dbtExtras]=await Promise.all(['urban-aprons','dbt-extras'].map(loadWorldJSON));applyLocalWorldEdits(w);w.urbanFootprints=additionalUrbanBuildings(w.dbtExtras?.features||[]);Object.assign(w,roadSurfaceFeatures(w,w.dbtExtras?.features||[]));await showLoadStep(14,'Preparazione della rete stradale…');roadNetwork=createRoadNetwork(w);const stairPlans=createStairPlans(w.dbtExtras?.features||[],roadNetwork);installDbtSteps(roadNetwork,stairPlans);await showLoadStep(26,'Caricamento delle geometrie…');const roadCache=await loadRoadMeshCache();await showLoadStep(36,'Preparazione del terreno…');const terrain=await makeTerrain(scene,w,roadNetwork,roadCache);makeRoads(scene,roadNetwork,roadCache);makeRoadDetails(scene,roadNetwork);await showLoadStep(45,'Caricamento degli edifici…');makeBuildings(scene,w);atmosphere=makeAtmosphere(scene,renderer);makeVillageDetails(scene,w,roadNetwork,terrain.canvas);await showLoadStep(54,'Preparazione del paese…');makeDbtDetails(scene,w,roadNetwork,stairPlans);terrainLOD=terrainDistanceDetail(terrain.ground);baseLOD=indexNearbyDetail(terrain.ground.children[0],Infinity,true);staticBatches=batchStaticWorld(scene,renderer);}
 await showLoadStep(65,'Lettura della mappa di Teglie…');
 const teglie=await installTeglieWorld(scene,w,roadNetwork,showLoadStep);
 await showLoadStep(92,'Preparazione dei controlli e dei veicoli…');
 if(teglie)roadNetwork=teglie.network;
 makeBaccanaliaSign(scene,w);const cars=[makeCar(scene,'panda'),makeCar(scene,'ferrari'),makeCar(scene,'punto')];let car=cars[0];const helicopter=makeHelicopter(scene);let flying=false;const sandbox=import.meta.env.DEV,adult=sandbox||signedInUser?.user_metadata?.adult===true;const person=makePerson(scene),animateAvatar=installAnimatedAvatar(person,signedInUser?.user_metadata?.avatar),hud=createHUD(w,roadNetwork,cars,{adult}),vehicleEffects=makeVehicleEffects(scene,cars,w.terrain);let onFoot=false,view=0,speed=0,started=false,orbit=0,orbitPitch=0,mouse=null,elapsed=0,accumulator=0,camYaw=0;let vehicleLoading=false,vehicleTransfer=0;const keys=new Set();
const colliderIndex=new SpatialIndex(20);const colliders=[...w.buildings.flatMap(buildingCollisionParts),...extraColliders(w.dbtExtras?.features||[])];for(const b of colliders)colliderIndex.insert(b,b.bounds);const solidsNear=(x,z,r=5,ignoredVehicle)=>{const result=mobileWorld?mobileWorld.solidsNear(x,z,r):colliderIndex.box([x-r,z-r,x+r,z+r]);if(teglie)result.push(...teglie.solidsNear(x,z,r,!!mobileWorld));if(farm)result.push(...farm.blocks(x,z,r));if(wanted)result.push(...wanted.colliders(x,z,r));const police=policeEscort?.vehicle;if(police?.root.visible&&Math.hypot(x-police.x,z-police.z)<r+3)result.push(vehicleFootprint(police));for(const c of cars)if(c!==ignoredVehicle&&c.root.visible&&(onFoot||c!==car)){const b=vehicleFootprint(c);if(b.bounds[2]>=x-r&&b.bounds[0]<=x+r&&b.bounds[3]>=z-r&&b.bounds[1]<=z+r)result.push({...b,vehicle:c,blocksVehicleFootprint:true});}if(helicopter.root.visible&&!flying){const b=vehicleFootprint(helicopter);b.roofY=helicopter.y+3;if(b.bounds[2]>=x-r&&b.bounds[0]<=x+r&&b.bounds[3]>=z-r&&b.bounds[1]<=z+r)result.push(b);}return result;};
const candidateClear=(x,z,r,ignoredVehicle)=>!solidsNear(x,z,r,ignoredVehicle).some(b=>{if(inBuilding([x,z],b))return true;for(const ring of b.rings)for(let i=1;i<ring.length;i++)if(nearest([x,z],ring[i-1],ring[i]).d<r)return true;return false;});
const bombs=makeBombs(scene,(x,z)=>{let y=elevation(w.terrain,x,z);for(const b of solidsNear(x,z,1))if(Number.isFinite(b.roofY)&&inBuilding([x,z],b))y=Math.max(y,b.roofY);return y;});
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
const overlayOpen=()=>visualLab?.open||hud.mapExpanded||missionSystem?.expanded||shop?.open||farm?.open;
const ferrari=cars.find(c=>c.spec.id==='ferrari');
const shopCars=[cars[0],ferrari,makeCar(scene,'ape','#638e83'),makeCar(scene,'offroad','#b78d40'),makeCar(scene,'motocross','#db751f'),makeCar(scene,'armored','#505f45'),makeCar(scene,'tank','#625b3d')];
cars.push(...shopCars.slice(2));
const vehicleOwned=vehicle=>!vehicle.raceOpponent&&(!shopCars.includes(vehicle)||!!missionSystem?.state().economy.owned[vehicle.spec.id]);
function parkShopCars(){
 // Leave the pad and the eastern wall clear. All bays face the same aisle.
 for(const [i,vehicle] of shopCars.entries()){
  damageSystem?.repair(vehicle);
  const dx=-23+i*5;
  Object.assign(vehicle,{x:heliPad.x+dx,z:heliPad.z-11,yaw:0,speed:0,parked:true,steer:0,slip:0});
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
missionSystem=createMissions(state=>{ferrariUnlocked=!!state.economy.owned.ferrari;unlocked=!!state.economy.owned.helicopter;label.visible=!unlocked;},signedInUser,{adult,sandbox,teglie:!!teglie});
await missionSystem.ready;
const graceChurch=worldLocation(w.origin,{lat:40.655915,lon:15.406906});
const firstPrologue=!sandbox&&!missionSystem.state().processionDone;if(firstPrologue){const p=worldLocation(w.origin,PROCESSION_START),near=roadNetwork.closestSegment(p.x,p.z);if(near)Object.assign(initialSpawn,{x:near.q[0],z:near.q[1],y:elevation(w.terrain,...near.q),yaw:0,street:'Madonna delle Grazie · Processione'});}
const cannonButton=document.querySelector('#drop-bomb');
const cannonReload=6;
function crushTraffic(vehicle){
 const respawn=vehicle.autonomous;
 if(!vehicle.destroyed)damageSystem.damageVehicle(vehicle,110/(vehicle.spec.damageScale??1));
 vehicle.root.visible=false;
 if(respawn){
  vehicle.autonomous=true;
  if(!vehicle.teglieTraffic)vehicle.road=null;
  vehicle.spawnDelay=3;
  vehicle.wreckTime=5;
 }
 car.crushHop=.85;
}

let cannonReadyAt=0;
const terrainHeight=(x,z)=>elevation(w.terrain,x,z);
function fireVehicleWeapon(){
 if(damageSystem?.dead||wanted?.arrested||controls.isPaused()||controls.isPortrait()||vehicleLoading||overlayOpen())return;
 if(flying){
  if(!bombs.drop(helicopter)&&helicopter.altitude<4)hud.toast('Decolla prima di sganciare le bombe.');
  return;
 }
 if(!adult||onFoot||car.spec.id!=='tank'||car.destroyed||teglieDistrict?.racing||elapsed<cannonReadyAt)return;
 const source=car;
 const origin=source.root.position;
 source.body.updateWorldMatrix(true,false);
 const direction=new THREE.Vector3(0,0,1).transformDirection(source.body.matrixWorld);
 const muzzle=new THREE.Vector3(0,1.24,2.76).applyMatrix4(source.body.matrixWorld);
 const cover=(a,b)=>traceCover(a,b,(x,z,r)=>combatSolidsNear(x,z,r,[source]),terrainHeight);
 if(!bombs.launch(muzzle,direction,(a,b)=>{
  let fraction=cover(a,b).fraction;
  for(const target of teglieDistrict?.targets()??[]){
   fraction=Math.min(fraction,segmentSphere(a,b,{x:target.x,y:target.y+1,z:target.z},.55));
  }
  return fraction;
 },point=>{
  const center={...point,y:point.y+.35};
  raid.blast(center,10,source);
  for(const target of teglieDistrict?.targets()??[]){
   const distance=Math.hypot(target.x-point.x,target.y+1-point.y,target.z-point.z);
   if(target.active&&distance<10&&cover(center,{x:target.x,y:target.y+1,z:target.z}).fraction>=.995)target.hit(240*(1-distance/10));
  }
  for(const vehicle of cars){
   if(vehicle===source||vehicle.raceOpponent||!vehicle.root.visible||vehicle.destroyed)continue;
   const distance=Math.hypot(vehicle.x-point.x,vehicle.root.position.y+.6-point.y,vehicle.z-point.z);
   if(distance>=10)continue;
   const hit=cover(center,{x:vehicle.x,y:vehicle.root.position.y+.6,z:vehicle.z});
   if(hit.fraction>=.995||hit.solid?.vehicle===vehicle)damageSystem.damageVehicle(vehicle,190*(1-distance/10));
  }
 }))return;
 cannonReadyAt=elapsed+cannonReload;
 if(!raid.active&&!teglie?.contains(origin.x,origin.z))wanted?.shot();
}
function updateVehicleWeaponButton(){
 const tank=adult&&!onFoot&&!flying&&car.spec.id==='tank'&&!car.destroyed&&!damageSystem.dead;
 const remaining=tank?Math.max(0,Math.ceil(cannonReadyAt-elapsed)):0;
 cannonButton.hidden=!tank&&!flying;
 cannonButton.disabled=remaining>0;
 const label=tank?(remaining?`Cannone in ricarica · ${remaining} s`:'Spara col cannone (F)'):'Sgancia bomba';
 if(cannonButton.title!==label){
  cannonButton.title=label;
  cannonButton.setAttribute('aria-label',label);
 }
 cannonButton.dataset.reload=remaining||'';
}
function reset(){teglieDistrict?.clear();wanted?.clear();raid?.suspend();prologue?.leave();abballa?.cancel();turneia?.reset();jumpHeight=jumpVelocity=0;mazzuoccolo?.reset();vehicleTransfer++;vehicleLoading=false;document.body.classList.remove('vehicle-loading');bombs.reset();cannonReadyAt=0;view=0;flying=false;helicopter.root.visible=false;document.body.classList.remove('flying');
 const punto=cars[2];damageSystem?.repair(punto);
 Object.assign(punto,puntoHome,{speed:0,parked:true,steer:0,slip:0});updateCar(punto,w.terrain,0);
 car=punto;parkHelicopter();parkShopCars();speed=0;jumpHeight=jumpVelocity=0;spawnOnFoot();}
function spawnOnFoot(home=firstPrologue?prologue.route.at(8):initialSpawn){flying=false;document.body.classList.remove('flying');speed=jumpHeight=jumpVelocity=0;onFoot=true;person.root.visible=true;orbit=0;orbitPitch=0;const spawn=findFootSpawn(home,candidateClear,initialSpawn);Object.assign(person,{x:spawn.x,z:spawn.z,yaw:firstPrologue&&!missionSystem.state().processionDone?Math.atan2(graceChurch.x-spawn.x,graceChurch.z-spawn.z):spawn.yaw??0});const y=elevation(w.terrain,person.x,person.z);person.root.position.set(person.x,y,person.z);person.root.rotation.y=person.yaw;person.limbs.forEach(l=>l.rotation.x=0);camYaw=person.yaw;camera.position.set(person.x-Math.sin(camYaw)*4.6,y+2.2,person.z-Math.cos(camYaw)*4.6);camera.lookAt(person.x,y+1.55,person.z);}

let boardingHelicopter=false;
function selectCar(index,ground=false){const selectHeli=index===3&&!ground;if(damageSystem?.dead||prologue?.active||abballa?.blockInput||overlayOpen()||onFoot)return;if(!selectHeli&&!cars[index])return;if(!selectHeli&&cars[index]?.destroyed){hud.toast('Veicolo distrutto.');return;}if(!selectHeli&&!vehicleOwned(cars[index])){hud.toast('Acquista questo veicolo al piazzale.');return;}if(selectHeli){if(!unlocked||!helicopter.root.visible){hud.toast('Acquista l’Elicottero al piazzale.');return;}if(!boardingHelicopter){hud.toast('Avvicinati a piedi all’Elicottero per salire.');return;}car.speed=0;flying=true;helicopter.speed=helicopter.strafeSpeed=helicopter.verticalSpeed=0;document.body.classList.add('flying');hud.toast(controls.touch?'Elicottero · SU per decollare, joystick per volare':'Elicottero · Spazio per salire, WASD per volare');}else{const wasFlying=flying;flying=false;document.body.classList.remove('flying');if(wasFlying)parkHelicopter();car.speed=0;car=cars[index];car.speed=0;hud.toast(car.spec.label);}speed=0;orbit=0;orbitPitch=0;view=0;camYaw=flying?helicopter.yaw:car.yaw+(car.spec.id==='punto'&&Math.hypot(car.x-puntoHome.x,car.z-puntoHome.z)<8?Math.PI:0);const actor=flying?helicopter:car;updateCar(car,w.terrain,0);const y=flying?helicopter.y:car.root.position.y;camera.position.set(actor.x-Math.sin(camYaw)*10,y+3.5,actor.z-Math.cos(camYaw)*10);camera.lookAt(actor.x,y+1,actor.z);if(mobileWorld){const token=++vehicleTransfer;vehicleLoading=true;document.body.classList.add('vehicle-loading');mobileWorld.prepareArea(actor.x,actor.z).catch(()=>hud.toast('Caricamento incompleto: riprova a selezionare il veicolo.')).finally(()=>{if(token===vehicleTransfer){vehicleLoading=false;document.body.classList.remove('vehicle-loading');}});}}

function toggleImpactDamage(){
 impactDamageEnabled=!impactDamageEnabled;
 hud.toast(impactDamageEnabled?'Danni da impatto attivi':'Danni da impatto disattivati');
}
function toggleTraffic(){
 trafficEnabled=!trafficEnabled;
 hud.toast(trafficEnabled?'Traffico attivo':'Traffico disattivato');
}
function spawnTestFerrari(){
 if(prologue.active||vehicleLoading||flying)return;
 if(!onFoot&&car===ferrari){hud.toast('Sei già sulla Ferrari.');return;}
 const actor=onFoot?person:car,yaw=actor.yaw;
 const radius=ferrari.spec.width/2+.15,overhang=ferrari.spec.length/2-radius;
 for(const distance of onFoot?[4.6,5.4,7]:[6.5,8,10])for(const angle of [0,.35,-.35,.7,-.7]){
  const x=actor.x+Math.sin(yaw+angle)*distance,z=actor.z+Math.cos(yaw+angle)*distance;
  if(mobileWorld&&!mobileWorld.isReady(x,z))continue;
  if(![-overhang,0,overhang].every(d=>{
   const px=x+Math.sin(yaw)*d,pz=z+Math.cos(yaw)*d,t=w.terrain;
   return px>t.minX+4&&px<t.maxX-4&&pz>t.minZ+4&&pz<t.maxZ-4&&candidateClear(px,pz,radius,ferrari);
  }))continue;
  damageSystem.repair(ferrari);
  Object.assign(ferrari,{x,z,yaw,steer:0,slip:0,throttle:0,braking:false,parked:true});
  ferrari.root.visible=true;updateCar(ferrari,w.terrain,0);
  hud.toast('Ferrari pronta');return;
 }
 hud.toast('Serve spazio davanti per la Ferrari.');
}
function nextVehicle(){const available=cars.filter(c=>!c.traffic&&vehicleOwned(c)&&c.root.visible&&!c.destroyed);if(!available.length){hud.toast('Nessun veicolo disponibile.');return;}selectCar(cars.indexOf(available[(available.indexOf(car)+1)%available.length]),true);}

function toggle(){if(wanted?.arrested||damageSystem?.dead)return;if(prologue?.active){prologue.leave();return;}if(abballa?.blockInput||overlayOpen())return;if(onFoot&&mazzuoccolo?.interact())return;if(!onFoot){const vehicle=flying?helicopter:car;if(flying&&helicopter.altitude>1.2){hud.toast('Atterra prima di scendere.');return;}for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,0]){const distance=flying?4.5:3,x=vehicle.x+Math.sin(vehicle.yaw+angle)*distance,z=vehicle.z+Math.cos(vehicle.yaw+angle)*distance;if(candidateClear(x,z,.4)){controls.clear();person.x=x;person.z=z;person.yaw=vehicle.yaw;jumpHeight=jumpVelocity=0;onFoot=true;person.root.visible=true;speed=0;vehicle.speed=0;if(flying){flying=false;document.body.classList.remove('flying');}return;}}hud.toast('Spazio insufficiente per scendere: sposta il veicolo.');}else{const vehicle=[...cars.filter(c=>vehicleOwned(c)&&c.root.visible&&!c.destroyed),...(unlocked&&helicopter.root.visible?[helicopter]:[])].sort((a,b)=>Math.hypot(person.x-a.x,person.z-a.z)-Math.hypot(person.x-b.x,person.z-b.z))[0];if(!vehicle){hud.toast('Nessun veicolo disponibile.');return;}if(Math.hypot(person.x-vehicle.x,person.z-vehicle.z)<6){controls.clear();jumpHeight=jumpVelocity=0;onFoot=false;person.root.visible=false;if(vehicle===helicopter){boardingHelicopter=true;selectCar(3);boardingHelicopter=false;missionSystem.piloted();}else{if(vehicle.traffic)traffic.take(vehicle);if(vehicle.teglieTraffic)teglieDistrict?.take(vehicle);car=vehicle;}}else hud.toast('Avvicinati a un veicolo per salire.');}}

mazzuoccolo=makeMazzuoccolo(scene,{camera,canStart:()=>(sandbox||missionSystem.state().processionDone)&&!raid?.active&&!damageSystem?.dead&&!prologue?.active,network:roadNetwork,height:(x,z)=>elevation(w.terrain,x,z),solidsNear,ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),player:()=>({onFoot,x:onFoot?person.x:flying?helicopter.x:car.x,z:onFoot?person.z:flying?helicopter.z:car.z,yaw:person.yaw}),toast:hud.toast,onWin:({throws_count,best_distance_m})=>{missionSystem.celebrate('Lu Mazzuoccl',missionSystem.complete(throws_count,best_distance_m));}});
turneia=makeTurneia(scene,{canStart:()=>(sandbox||missionSystem.state().processionDone)&&!raid?.active&&!damageSystem?.dead&&!prologue?.active,origin:w.origin,buildings:w.buildings,player:()=>({onFoot,x:onFoot?person.x:car.x,z:onFoot?person.z:car.z,sprinting:Math.abs(speed)>3.4}),height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),clear:candidateClear,move:(x,z,dx,dz,r)=>resolveCollision([x,z],[dx,dz],r,solidsNear(x,z,3),w.terrain),toast:hud.toast,onWin:points=>{missionSystem.celebrate('Turniata di San Vito',missionSystem.completeTurneia(points));}});
let processionReturn=null;
abballa=makeAbballa(scene,{origin:w.origin,height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),player:()=>({onFoot,x:onFoot?person.x:car.x,z:onFoot?person.z:car.z}),canStart:()=>(sandbox||missionSystem.state().processionDone)&&!raid?.active&&!damageSystem?.dead&&!prologue?.active&&onFoot&&!vehicleLoading&&!mazzuoccolo.aiming&&!turneia.stats().active,
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
prologue=makeProcessionPrologue(scene,{network:roadNetwork,canAdvance:clearProcessionCars,height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),player:()=>({onFoot,x:onFoot?person.x:car.x,z:onFoot?person.z:car.z}),canJoin:()=>!raid?.active&&!damageSystem?.dead&&!abballa.active&&!mazzuoccolo.aiming&&!turneia.stats().active,meters:()=>missionSystem.state().processionMeters,isDone:()=>missionSystem.state().processionDone,
 onEnter(){document.body.classList.add('procession-active');controls.clear();keys.clear();onFoot=true;person.root.visible=true;speed=jumpHeight=jumpVelocity=0;},
 onExit(p){document.body.classList.remove('procession-active');let q=p;if(!candidateClear(q.x,q.z,.35)){for(let a=0;a<Math.PI*2;a+=Math.PI/4){const x=p.x+Math.cos(a)*2,z=p.z+Math.sin(a)*2;if(candidateClear(x,z,.35)){q={...p,x,z};break;}}}person.x=q.x;person.z=q.z;person.yaw=q.yaw;person.root.position.set(q.x,elevation(w.terrain,q.x,q.z),q.z);person.root.rotation.y=q.yaw;person.limbs.forEach(l=>l.rotation.x=0);controls.clear();keys.clear();},
 onMeters:distance=>{void missionSystem.addProcessionMeters(distance);},onComplete:()=>missionSystem.celebrate('Porta la Statua',{cp:1500,rp:75})});
let respawnPlan=null;
const respawnHome=()=>adult&&missionSystem.state().local.raid_checkpoint?.active?{...raid.center,yaw:Math.PI/2}:firstPrologue?prologue.route.at(8):initialSpawn;
damageSystem=makeVehicleDamage(scene,{vehicles:cars,player:combatPlayer,height:(x,z)=>elevation(w.terrain,x,z),
 lineClear:(a,b,ignored)=>traceCover(a,b,(x,z,r)=>combatSolidsNear(x,z,r,ignored),(x,z)=>elevation(w.terrain,x,z)).fraction>=.995,
 onDeath(){teglieDistrict?.clear();wanted?.clear();raid?.suspend();prologue?.leave();abballa?.cancel();turneia?.reset();mazzuoccolo?.reset();controls.clear();keys.clear();mouse=null;car.speed=0;silenceEngineAudio();missionSystem.penalty();const home=respawnHome();respawnPlan={home,loading:mobileWorld?.prepareArea(home.x,home.z).then(()=>true,()=>false)};},
 async onRespawn(){const {home,loading}=respawnPlan||{home:respawnHome()};if(mobileWorld&&!await loading)await mobileWorld.prepareArea(home.x,home.z);spawnOnFoot(home);respawnPlan=null;},
 onExplosion:(point,vehicle)=>{raid?.blast(point,8,vehicle);farm?.onExplosion(vehicle);}});
raid=makeRaid(scene,{enabled:adult,network:roadNetwork,person,height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),solidsNear:combatSolidsNear,player:combatPlayer,
 canStart:()=>(sandbox||missionSystem.state().processionDone)&&!prologue.active&&!abballa.blockInput&&!mazzuoccolo.aiming&&!turneia.stats().active&&!damageSystem.dead,
 canShoot:()=>onFoot&&!wanted?.arrested&&!prologue.active&&!abballa.blockInput&&!mazzuoccolo.aiming&&!turneia.stats().active&&!damageSystem.dead&&!vehicleLoading&&!controls.isPaused()&&!overlayOpen(),
 onShot:inRaid=>{if(!inRaid&&!teglie?.contains(person.x,person.z))wanted?.shot();},
 localTargets:()=>teglieDistrict?.targets()??[],localCombatAim:()=>!!teglieDistrict?.combatAim,
 fireHeld:()=>controls.held('fire')||keys.has('f'),onAim:yaw=>{person.yaw=yaw;person.root.rotation.y=yaw;},progress:()=>missionSystem.state().local,save:(patch,gain)=>missionSystem.saveGameProgress(patch,gain),owned:id=>!!missionSystem.state().economy.owned[id],
 onPlayerHit:amount=>damageSystem.hitPlayer(amount),onVehicleHit:(vehicle,amount,owner)=>{if(owner!=='player'||teglie?.contains(person.x,person.z)||!wanted?.hit(vehicle))damageSystem.damageVehicle(vehicle,amount);},heal:amount=>damageSystem.heal(amount),onWave:wave=>hud.toast(`Ondata ${wave}/3 respinta!`),onWin:points=>{
  wanted?.grantRaidImmunity();
  missionSystem.celebrate('Difendi la Rotonda',missionSystem.completeRaid(points));
  hud.toast('Immunità dai Carabinieri · 30 secondi');
 },toast:hud.toast});
const contextualActions=document.createElement('div');contextualActions.className='contextual-foot-actions';contextualActions.setAttribute('aria-label','Attività nelle vicinanze');document.body.append(contextualActions);for(const selector of ['.raid-start','.procession-start','.procession-join','.procession-leave','.abballa-start','.turn-start','.turn-actions','#maz-pickup']){const button=document.querySelector(selector);if(button)contextualActions.append(button);}
if(teglie){
 teglieDistrict=makeTeglieDistrict(scene,teglie,{terrain:w.terrain,player:combatPlayer,solidsNear:combatSolidsNear,damage:()=>damageSystem,actions:contextualActions,adult,toast:hud.toast,vehicles:()=>cars,clear:candidateClear,refill:raid.refill,
  complete(id,title,cp,rp){
   const gain=missionSystem.transact(economy=>{
    if(id==='teglieDrag')return rewardTeglieDrag(economy);
    if(economy.claimed[id])return false;
    economy.claimed[id]=true;economy.cp+=cp;economy.rp+=rp;
    return {cp,rp};
   });
   if(gain)missionSystem.celebrate(title,gain);
  }});
 cars.push(...teglieDistrict.vehicles);
 if(teglieDistrict.raceSpot)hud.addMapLandmark({...teglieDistrict.raceSpot,icon:'🏁',label:'Teglie · jocat lu librett'});
}

window.addEventListener('keydown',e=>{if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select'))return;const k=e.key.toLowerCase();if(overlayOpen()){if(k==='escape'){e.preventDefault();if(hud.mapExpanded)hud.closeMap();else if(shop?.open)shop.close();else if(farm?.open)farm.close();else missionSystem.close();}return;}if(!missionSystem.state().user||damageSystem.dead||wanted?.arrested||controls.isPortrait())return;if(prologue?.active&&['e','escape'].includes(k)){e.preventDefault();prologue.leave();return;}if(abballa?.blockInput){abballa.keyDown(e);return;}if(controls.isPaused())return;if(k===' '&&mazzuoccolo.aiming){e.preventDefault();if(!e.repeat)mazzuoccolo.action();return;}if(k==='escape')mazzuoccolo.reset();if(['arrowup','arrowdown','arrowleft','arrowright',' ','control'].includes(k))e.preventDefault();keys.add(k);if(!e.repeat){if(sandbox&&k==='7')spawnTestFerrari();if(sandbox&&k==='8')toggleImpactDamage();if(sandbox&&k==='9')toggleTraffic();if(k===' ')jump();if(k==='q')turneia?.call();if(k==='e'&&!farm?.interact()&&(nearbyVehicle()||!shop?.interact()))toggle();if(k==='f'){if(!onFoot)fireVehicleWeapon();else raid.queueShot();}if(k==='v')nextVehicle();if(k==='4'||k==='b')selectCar(3);if(['1','2','3'].includes(k))selectCar(Number(k)-1);if(k==='r'&&onFoot)raid.reload();if(k==='x')raid.toggleWeapon();if(k==='c')view=(view+1)%3;}started=true;});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();raid?.setMouseFire(false);mouse=null;});document.addEventListener('visibilitychange',()=>{keys.clear();accumulator=0;});
function nearbyVehicle(){return [...cars.filter(c=>vehicleOwned(c)&&c.root.visible&&!c.destroyed),...(unlocked&&helicopter.root.visible?[helicopter]:[])].some(v=>Math.hypot(person.x-v.x,person.z-v.z)<6);}
function jump(){if(damageSystem?.dead||prologue?.active||abballa?.blockInput||overlayOpen())return;if(onFoot&&!controls.isPaused()&&!vehicleLoading&&jumpHeight<=.001&&jumpVelocity<=0&&!mazzuoccolo.aiming){jumpVelocity=5.1;turneia?.jump();}}
const controls=createControls({jump,fire:()=>raid.queueShot(),cancelFire:()=>raid.cancelFire(),reload:()=>raid.reload(),bomb:fireVehicleWeapon,enter:toggle,switch:nextVehicle,camera:()=>view=(view+1)%3,reset,pause(){keys.clear();mouse=null;raid?.setMouseFire(false);accumulator=0;abballa?.pause('Ruota il telefono in orizzontale, poi riprendi la musica.');silenceEngineAudio();}});
visualLab=await (await import('./local-visual-lab.js')).installVisualLab({scene,camera,renderer,atmosphere,mobile:MOBILE,person,animateAvatar,user:signedInUser,initialVariant:signedInUser?.user_metadata?.avatar,clearInput:()=>{controls.clear();keys.clear();raid?.setMouseFire(false);mouse=null;},});
renderer.domElement.addEventListener('pointerdown',e=>{if(damageSystem.dead||wanted?.arrested||controls.isPaused()||overlayOpen()||abballa?.blockInput)return;if(e.pointerType==='mouse'&&e.button===0){raid.setMouseFire(true);raid.queueShot();}if(e.pointerType==='touch'&&e.clientX<innerWidth*.45)return;if(mouse)return;mouse={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);started=true;});renderer.domElement.addEventListener('pointermove',e=>{if(mouse&&e.pointerId===mouse.id){const dragYaw=-(e.clientX-mouse.x)*.006;orbit+=dragYaw;if(onFoot&&mazzuoccolo.aiming){person.yaw+=dragYaw;mazzuoccolo.rotate(dragYaw);}orbitPitch=THREE.MathUtils.clamp(orbitPitch+(e.clientY-mouse.y)*.004,-.3,.8);mouse.x=e.clientX;mouse.y=e.clientY;}});renderer.domElement.addEventListener('pointerup',e=>{raid.setMouseFire(false);if(mouse?.id===e.pointerId)mouse=null;});renderer.domElement.addEventListener('pointercancel',e=>{raid.setMouseFire(false);if(mouse?.id===e.pointerId)mouse=null;});renderer.domElement.addEventListener('lostpointercapture',e=>{raid.setMouseFire(false);if(mouse?.id===e.pointerId)mouse=null;});
function onOverlayToggle(open){
 if(open)silenceEngineAudio();
 raid.cancelFire();raid.setMouseFire(false);controls.clear();keys.clear();mouse=null;accumulator=0;
}
shop=makeEconomyShop({actions:contextualActions,progress:missionSystem.state,buy:missionSystem.buy,adult,toast:hud.toast,onToggle:onOverlayToggle,
 near:()=>onFoot&&!prologue.active&&!raid.active&&!damageSystem.dead&&!controls.isPaused()&&Math.hypot(person.x-heliPad.x,person.z-heliPad.z)<24});
hud.onMapToggle=onOverlayToggle;
missionSystem.onToggle=onOverlayToggle;
function guideRoute(from,target,label,show){
 let points=[];
 const margin=w.teglie&&Math.hypot(target.x-from.x,target.z-from.z)>2000?1400:200;
 try{points=roadRoute(roadNetwork,{x:from.x,z:from.z},{x:target.x,z:target.z},{margin}).points;}catch{}
 return hud.guide(points,target,label,show);
}
hud.onMapNavigate=point=>guideRoute(onFoot?person:flying?helicopter:car,point,point.label,false);
missionSystem.onNavigate=(id,label)=>{
 if(id==='teglieMilitia'||id==='teglieDrag'){
  const target=id==='teglieDrag'?teglieDistrict?.raceSpot:teglieDistrict?.battleSpot;
  if(target)guideRoute(onFoot?person:flying?helicopter:car,target,label,true);
  return;
 }
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

const homeButton=$('go-home');
homeButton.hidden=false;
homeButton.onclick=async()=>{
 homeButton.disabled=true;
 await missionSystem.syncNow();
 location.assign(location.pathname);
};
$('audio').onclick=()=>{if(!toggleEngineAudio())hud.toast('Audio non disponibile in questo browser.');};
policeEscort=makePoliceEscort(scene);
const stationLocation=worldLocation(w.origin,{lat:40.659935,lon:15.401172});
const stationRoad=roadNetwork.closestSegment(stationLocation.x,stationLocation.z);
const station=stationRoad?{x:stationRoad.q[0],z:stationRoad.q[1],yaw:Math.atan2(stationRoad.segment.b.x-stationRoad.segment.a.x,stationRoad.segment.b.z-stationRoad.segment.a.z)}:stationLocation;
if(adult)wanted=makeWanted(scene,{station,
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
traffic=makeTraffic(scene,w,roadNetwork,(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),c=>prologue.blocksTraffic(c.x,c.z),()=>cars,(x,z)=>!teglie?.contains(x,z));
const farmRambo=makeCar(scene,'rambo');
farmRambo.root.visible=false;
cars.push(...traffic.vehicles,farmRambo);
farm=makeFarmMissions(scene,{
 origin:w.origin,network:roadNetwork,height:(x,z)=>elevation(w.terrain,x,z),ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),
 player:()=>{const actor=onFoot?person:flying?helicopter:car;return {x:actor.x,z:actor.z,onFoot,vehicle:onFoot?null:actor};},
 person,rambo:farmRambo,actions:contextualActions,toast:hud.toast,celebrate:missionSystem.celebrate,onOverlay:onOverlayToggle,
 guideDelivery:(from,target,label="Porta l’uva a la grotta · Scarico")=>guideRoute(from,target,label,false),
 transact:missionSystem.transact,economy:()=>missionSystem.state().economy,progress:()=>missionSystem.state().local,save:patch=>missionSystem.saveGameProgress(patch),
 enabled:()=>(sandbox||missionSystem.state().processionDone)&&!prologue.active&&!raid.active&&!abballa.blockInput&&!turneia.stats().active&&!mazzuoccolo.aiming&&!damageSystem.dead&&!vehicleLoading&&!controls.isPaused()&&!overlayOpen(),
 park(point){
  damageSystem.repair(farmRambo);
  Object.assign(farmRambo,point,{speed:0,parked:true,steer:0,slip:0});
  updateCar(farmRambo,w.terrain,0);farmRambo.root.visible=true;
 },
});
const updateMunicipioCrowd=makeMunicipioCrowd(scene,{origin:w.origin,height:(x,z)=>elevation(w.terrain,x,z),
 ready:(x,z)=>!mobileWorld||mobileWorld.isReady(x,z),clear:candidateClear});
await showLoadStep(98,'Preparazione del punto di partenza…');
const spawnHome=firstPrologue?prologue.route.at(8):initialSpawn;if(mobileWorld)await mobileWorld.prepareArea(spawnHome.x,spawnHome.z);reset();
const clock=new THREE.Clock();const cameraTarget=new THREE.Vector3(),lookTarget=new THREE.Vector3(),focus=new THREE.Vector3(),cameraProbe=new THREE.Vector3(),probePoint=[0,0];let hudCounter=0,perfFrames=0,perfTime=0,qualityTime=0;const step=1/90,footDistances=[4.6,8,18],carDistances=[8.5,13,29],footHeights=[2.2,3.4,18],carHeights=[2.6,4.2,27],heliDistances=[15,22,35],heliHeights=[6,10,28];
const pressed=k=>keys.has(k)||controls.held(k);
function physics(dt){if(wanted?.arrested)return;if(damageSystem.dead||overlayOpen()||!missionSystem.state().user)return;if(prologue?.active){const j=controls.joystick,paused=controls.isPaused()||vehicleLoading,turn=paused?0:(j.active?-j.x:Number(pressed('a')||pressed('arrowleft'))-Number(pressed('d')||pressed('arrowright')))*2.5*dt;prologue.rotate(turn);if(controls.touch)camYaw+=turn;speed=0;return;}if(abballa?.blockInput){speed=0;return;}if(vehicleLoading||controls.isPaused()||mobileWorld&&!mobileWorld.isReady(flying?helicopter.x:onFoot?person.x:car.x,flying?helicopter.z:onFoot?person.z:car.z))return;const forward=Number(pressed('w')||pressed('arrowup'))-Number(pressed('s')||pressed('arrowdown')),steer=Number(pressed('a')||pressed('arrowleft'))-Number(pressed('d')||pressed('arrowright'));
 if(flying){const j=controls.joystick,flightForward=j.active?-j.y:forward,flightTurn=j.active?-j.x:steer;const lift=Number(pressed(' '))-Number(pressed('control'));advanceHelicopter(helicopter,{forward:flightForward,turn:flightTurn*.72,strafe:flightTurn,lift,maxSpeed:OFFLINE_HELICOPTER_MAX_SPEED},dt,(px,pz)=>elevation(w.terrain,px,pz),solidsNear,w.terrain,(px,pz)=>!mobileWorld||mobileWorld.isReady(px,pz));updateHelicopter(helicopter,dt,flightForward,flightTurn);speed=Math.hypot(helicopter.speed,helicopter.strafeSpeed);return;}
 if(onFoot){let delta,v;const j=controls.joystick;if(mazzuoccolo.aiming){const turn=(j.active?-j.x:steer)*2.5*dt;person.yaw+=turn;mazzuoccolo.rotate(turn);v=0;delta=[0,0];}else if(j.active){const magnitude=Math.min(1,Math.hypot(j.x,j.y)),heading=camYaw+orbit;const pace=pressed('shift')||j.sprinting?7.2:3.2;v=magnitude*pace;const dx=Math.sin(heading)*-j.y-Math.cos(heading)*j.x,dz=Math.cos(heading)*-j.y+Math.sin(heading)*j.x;delta=[dx*pace*dt,dz*pace*dt];if(magnitude>.08)person.yaw=Math.atan2(dx,dz);}else{person.yaw+=steer*2.5*dt;v=forward*(pressed('shift')?7.2:3.2);delta=[Math.sin(person.yaw)*v*dt,Math.cos(person.yaw)*v*dt];}
 [person.x,person.z]=resolveCollision([person.x,person.z],delta,.32,solidsNear(person.x,person.z),w.terrain);jumpVelocity-=14*dt;jumpHeight=Math.max(0,jumpHeight+jumpVelocity*dt);if(!jumpHeight)jumpVelocity=0;person.root.position.set(person.x,elevation(w.terrain,person.x,person.z)+jumpHeight,person.z);person.root.rotation.y=person.yaw;person.limbs.forEach((m,i)=>m.rotation.x=Math.abs(v)>.1?Math.sin(elapsed*9+i%2*Math.PI)*.45:0);speed=v;
 }else{if(car.destroyed||teglieDistrict?.stagingRace){car.speed=speed=0;return;}if(car.parked&&!forward){car.speed=speed=0;updateCar(car,w.terrain,dt);return;}car.parked=false;car.throttle=forward;car.braking=pressed(' ')||forward*car.speed<-.5;const before=Math.abs(car.speed),previous={x:car.x,z:car.z},result=advanceVehicle(car,{forward,steer,brake:pressed(' '),handbrake:pressed(' ')},dt,w.terrain,vehicleSolidsNear,car.spec.id==='tank'&&!teglieDistrict?.racing?crushTraffic:null);if(result.hit){car.hitAt=elapsed;if(impactDamageEnabled)damageSystem.impact(car,result.impactSpeed||0);raid.ram(car,before);}teglieDistrict?.ram?.(car,previous,Math.max(before,Math.abs(car.speed)));speed=car.speed;updateCar(car,w.terrain,dt);}}

let lastFrame=0;
function animate(frameTime=performance.now()){animationFrame=0;if(!contextSafety.canRender)return;animationFrame=requestAnimationFrame(animate);const frameInterval=1000/30;if(MOBILE&&frameTime-lastFrame<frameInterval-.5)return;lastFrame=MOBILE?frameTime-Math.max(0,(frameTime-lastFrame-frameInterval)%frameInterval):frameTime;const dt=Math.min(clock.getDelta(),.08);if(controls.isPortrait()||overlayOpen()){accumulator=0;return;}elapsed+=dt;accumulator+=dt;while(accumulator>=step){physics(step);accumulator-=step;}if(!controls.isPaused()&&!vehicleLoading&&!overlayOpen()){damageSystem.update(dt);if(!damageSystem.dead){if(!padReady&&mobileWorld.isReady(heliPad.x,heliPad.z)){
 fitHelipad();padReady=true;
 for(const c of shopCars)if(c.parked)updateCar(c,w.terrain,0);
 if(!flying&&helicopter.x===heliPad.x&&helicopter.z===heliPad.z)parkHelicopter();
}teglieDistrict?.update(dt,trafficEnabled);raid.update(dt);const pursuitActor=flying?helicopter:onFoot?person:car;if(raid.active||teglie?.contains(pursuitActor.x,pursuitActor.z))wanted?.clear();else wanted?.update(dt);abballa.update(dt);prologue.update(dt);const escort=prologue.escortPosition();
 policeEscort.update(escort&&(!mobileWorld||mobileWorld.isReady(escort.x,escort.z))?escort:null,w.terrain,dt,elapsed);}}if(prologue.active){const pose=prologue.bearerPose();Object.assign(person,{x:pose.x,z:pose.z,yaw:pose.yaw});person.root.position.set(pose.x,pose.y,pose.z);person.root.rotation.y=pose.yaw;person.limbs.forEach((l,i)=>l.rotation.x=i<2?Math.sin(elapsed*6+i*Math.PI)*.13:-.85);}if(abballa.active){const pose=abballa.model.bearerPose();Object.assign(person,{x:pose.x,z:pose.z,yaw:pose.yaw});person.root.position.set(pose.x,pose.y,pose.z);person.root.rotation.y=pose.yaw;person.limbs.forEach((l,i)=>l.rotation.x=i<2?pose.kick*.18:-.85);}if(onFoot&&raid.armed&&!prologue.active){person.limbs[2].rotation.x=-1.15;person.limbs[3].rotation.x=-.8;}const actor=flying?helicopter:onFoot?person:car;const x=actor.x,z=actor.z,y=flying?helicopter.y:onFoot?elevation(w.terrain,x,z):car.root.position.y;if(!(onFoot&&controls.touch)){const desiredYaw=actor.yaw+(!onFoot&&!flying&&car.spec.id==='punto'&&Math.hypot(x-puntoHome.x,z-puntoHome.z)<8?Math.PI:0),angle=Math.atan2(Math.sin(desiredYaw-camYaw),Math.cos(desiredYaw-camYaw));camYaw+=angle*(1-Math.exp(-dt*(onFoot?4:2.2)));}const heading=camYaw+orbit,shoulder=onFoot&&raid.armed&&(raid.active||teglieDistrict?.combatAim)&&!abballa.active;const dist=flying?heliDistances[view]:onFoot?footDistances[view]:carDistances[view],height=flying?heliHeights[view]:onFoot?footHeights[view]:carHeights[view];cameraTarget.set(x-Math.sin(heading)*dist+(shoulder?Math.cos(heading)*.95:0),y+height+(shoulder?jumpHeight*.5:orbitPitch*12),z-Math.cos(heading)*dist-(shoulder?Math.sin(heading)*.95:0));cameraTarget.y=Math.max(cameraTarget.y,elevation(w.terrain,cameraTarget.x,cameraTarget.z)+1.2);
// Push the camera in front of intervening walls rather than putting it inside houses.
focus.set(x,y+(onFoot?1.55:car.spec.id==='panda'?1.65:1.15),z);
const cameraSolids=solidsNear(x,z,Math.max(dist+3,Math.min(60,camera.position.distanceTo(focus)+2))),cameraMargin=Math.max(.28,camera.near*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*Math.hypot(1,camera.aspect))+.02;
let cameraBlocked=false;
if(!flying){const fraction=cameraCollisionFraction(focus,cameraTarget,cameraSolids,cameraMargin);if(fraction<1){cameraBlocked=true;cameraTarget.lerpVectors(focus,cameraTarget,fraction);}
 // In a narrow street, move above the car instead of pushing the lens into its cabin.
 if(!onFoot&&cameraTarget.distanceTo(focus)<3){cameraTarget.set(x-Math.sin(heading)*1.1,focus.y+4.5,z-Math.cos(heading)*1.1);const above=cameraCollisionFraction(focus,cameraTarget,cameraSolids,cameraMargin);cameraTarget.lerpVectors(focus,cameraTarget,above);}
}
if(!Number.isFinite(camera.position.lengthSq()))camera.position.copy(cameraTarget);
if(cameraBlocked&&camera.position.distanceTo(focus)>cameraTarget.distanceTo(focus)+.2)camera.position.copy(cameraTarget);else camera.position.lerp(cameraTarget,1-Math.exp(-dt*7));
// Recheck the smoothed position too: orbiting around corners can cut through a wall.
if(!flying){const fraction=cameraCollisionFraction(focus,camera.position,cameraSolids,cameraMargin);if(fraction<1)camera.position.lerpVectors(focus,camera.position,fraction);}
camera.position.y=Math.max(camera.position.y,elevation(w.terrain,camera.position.x,camera.position.z)+.5);
for(const vehicle of shopCars)if(vehicle.rider)vehicle.rider.visible=!onFoot&&!flying&&!damageSystem.dead&&vehicle===car;
if(shoulder)lookTarget.set(camera.position.x+Math.sin(heading)*40,camera.position.y-(.045+orbitPitch*.7)*40,camera.position.z+Math.cos(heading)*40);else lookTarget.set(x,focus.y,z);const shake=damageSystem.shake+(onFoot?0:Math.max(0,(Math.abs(speed)*3.6-250)/100)*.065);camera.position.x+=Math.sin(elapsed*43)*shake;camera.position.y+=Math.sin(elapsed*71)*shake*.5;camera.lookAt(lookTarget);if(abballa.active){const p=abballa.model.location,cy=elevation(w.terrain,p.x,p.z),forward=new THREE.Vector3(Math.sin(p.yaw),0,Math.cos(p.yaw)),right=new THREE.Vector3(Math.cos(p.yaw),0,-Math.sin(p.yaw));camera.position.set(p.x+forward.x*4+right.x*5.2,cy+3.1,p.z+forward.z*4+right.z*5.2);camera.lookAt(p.x,cy+1.95,p.z);const landscape=innerWidth>innerHeight;camera.setViewOffset(innerWidth,innerHeight,landscape?innerWidth*.20:0,landscape?0:innerHeight*.20,innerWidth,innerHeight);}snapSunShadow(atmosphere.light,atmosphere.sun,x,y,z);const fov=60+(MOBILE?0:18)*Math.min(1,Math.abs(speed)/(350/3.6));camera.fov=THREE.MathUtils.lerp(camera.fov,fov,1-Math.exp(-dt*3));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);atmosphere.sky?.position.copy(camera.position);teglie?.updateVisibility(x,z,(scene.fog?.far??camera.far)+120);animateAvatar(dt,prologue.active?1.05:onFoot?speed:0,jumpHeight>.03);if(!damageSystem.dead&&!controls.isPaused()&&!vehicleLoading)raid.aimFrame(camera);terrainLOD(x,z,camera);baseLOD(x,z,camera);if(!damageSystem.dead||!mobileWorld)staticBatches.userData.updateDetail(x,z,camera);updateEngineAudio(flying?helicopter:car,onFoot||damageSystem.dead||car.destroyed);updateWorldAudio(dt,{playing:!damageSystem.dead&&!wanted?.arrested&&!controls.isPaused()&&!vehicleLoading&&!abballa.blockInput,walkSpeed:onFoot&&jumpHeight<=.025?(prologue.active?1.05:Math.abs(speed)):0,onFoot});hudCounter+=dt;if(hudCounter>.08){hud.update(x,z,y,actor.yaw,speed,onFoot,hudCounter,flying?helicopter:car,unlocked?helicopter:null,ferrariUnlocked?ferrari:null,prologue.marker(),damageSystem.health);const enterButton=document.querySelector('[data-action=enter]');enterButton.hidden=damageSystem.dead||onFoot&&!nearbyVehicle();boardingIcon(enterButton,onFoot);const nearHeli=onFoot&&unlocked&&helicopter.root.visible&&Math.hypot(person.x-helicopter.x,person.z-helicopter.z)<6;enterButton.setAttribute('aria-label',nearHeli?'Sali sull’Elicottero':flying?'Scendi':onFoot?'Sali a bordo':'Scendi dal veicolo');enterButton.title=enterButton.getAttribute('aria-label');enterButton.disabled=flying&&helicopter.altitude>1.2;document.body.classList.toggle('near-helicopter',nearHeli);hudCounter=0;}if(!damageSystem.dead&&!controls.isPaused()&&!vehicleLoading&&!overlayOpen()){bombs.update(dt);updateVehicleWeaponButton();mazzuoccolo.update(dt);turneia.update(dt);farm.update(dt);shop.update();traffic.update(dt,{x,z,onFoot},trafficEnabled&&!teglieDistrict?.racing);updateMunicipioCrowd(x,z);
 const band=prologue.bandPosition();updateProcessionMarch(band?Math.hypot(x-band.x,z-band.z,flying?Math.max(0,helicopter.altitude):0):Infinity);
 }vehicleEffects.update(dt,car,camera,onFoot||flying||damageSystem.dead||car.destroyed,elapsed);updateVehicleVisuals(camera);if(visualLab?.max)visualLab.render(dt);else renderer.render(scene,camera);perfFrames++;perfTime+=dt;qualityTime+=dt;if(perfTime>=1){document.documentElement.dataset.performance=JSON.stringify({position:{x:+x.toFixed(2),z:+z.toFixed(2),...geographicLocation(w.origin,{x,z})},calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps:Math.round(perfFrames/perfTime),bombs:bombs.stats(),car:flying?'helicopter':car.spec.id,speedKmh:Math.round(Math.abs(speed)*3.6),gear:vehicleGear(car),onFoot,staticBatches:staticBatches.children.length,pixelRatio:renderer.getPixelRatio(),logDepth:renderer.capabilities.logarithmicDepthBuffer,near:camera.near,far:camera.far,streaming:mobileWorld?.stats(),mobile:MOBILE,shadows:renderer.shadowMap.enabled,textures:renderer.info.memory.textures,framebufferPixels:renderer.domElement.width*renderer.domElement.height,contextLosses:contextSafety.losses,helpOpen:controls.isPaused(),braking:car.braking,audio:engineAudioDiagnostics(),fov:camera.fov,cameraFinite:Number.isFinite(camera.position.lengthSq())&&camera.matrixWorld.elements.every(Number.isFinite)});if(qualityTime>3){const fps=perfFrames/perfTime;if(fps<(MOBILE?26:55)&&renderer.getPixelRatio()>.8)renderer.setPixelRatio(Math.max(.8,renderer.getPixelRatio()*.85));qualityTime=0;}perfFrames=0;perfTime=0;}}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(!MOBILE){renderer.setPixelRatio(Math.min(renderer.getPixelRatio(),pixelRatioFor(innerWidth,innerHeight,devicePixelRatio)));renderer.setSize(innerWidth,innerHeight);}});window.__SGM={visualLab,animateAvatar,raid,wanted,damageSystem,saveGameProgress:missionSystem.saveGameProgress,prologue,abballa,turneia,missionSystem,mazzuoccolo,bombs,helicopter,selectVehicle:selectCar,mobileRuntime:mobileWorld,roadNetwork,world:w,cars,get car(){return car;},person,scene,camera,renderer,getElevationAt:(x,z)=>elevation(w.terrain,x,z),getState:()=>({onFoot,flying,x:flying?helicopter.x:onFoot?person.x:car.x,z:flying?helicopter.z:onFoot?person.z:car.z,speed,frames:renderer.info.render.frame}),reset,toggle};clearInput=()=>{abballa?.pause();controls.clear();keys.clear();raid?.setMouseFire(false);mouse=null;accumulator=0;silenceEngineAudio();};startFrames=()=>{if(animationFrame||!contextSafety.canRender)return;clock.getDelta();accumulator=0;animate();};startFrames();if(MOBILE)document.documentElement.dataset.mobileBoot=JSON.stringify({milliseconds:Math.round(performance.now()-Number(document.body.dataset.bootStarted||0)),fullWorldRequests:performance.getEntriesByType('resource').filter(e=>/\/data\/(world-data|urban-aprons|dbt-extras|geometry)-/.test(e.name)).length,framebuffer:[renderer.domElement.width,renderer.domElement.height]});setLoadProgress(100,'Pronto');setTimeout(()=>{$('loading').style.opacity=0;$('loading').style.pointerEvents='none';},200);setTimeout(()=>$('loading').remove(),850);}catch(e){console.error(e);$('load-status').textContent=`Impossibile caricare il mondo: ${e.message}. Ricarica per riprovare.`;}
