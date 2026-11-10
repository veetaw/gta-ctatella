import {formatCP} from './economy.js';
import {actionIcon,setIcon} from './ui-icons.js';
import * as THREE from 'three';
import {worldLocation} from './game-locations.js';
import {processionRoute} from './procession-route.js';
import {resolveCollision} from './world-math.js';
import {traceCover,bodyHit} from './combat-geometry.js';
import {makeRaidModels} from './raid-models.js';
import {installActionIcons,installWeaponSelector} from './action-icons.js';
import {playGunSound,playReloadSound} from './engine-audio.js';
export const RAID_ENTRY={lat:40.656048,lon:15.396257},RAID_CENTER={lat:40.656142,lon:15.397065};
const WAVES=[{count:4,cap:4,hp:45,pace:2.5,interval:3.4,spread:.15,damage:8,speed:16},{count:7,cap:6,hp:60,pace:2.9,interval:2.8,spread:.10,damage:10,speed:20},{count:12,cap:8,hp:75,pace:3.2,interval:2.3,spread:.065,damage:12,speed:23}];
import {WEAPONS as ARMS} from './online-wire.js';
export function makeRaid(scene,{network,height,ready,solidsNear,player,canStart,canShoot,fireHeld,onAim,onShot=()=>{},networkFire,networkReload,remoteTargets=()=>[],harder=false,progress,save,onPlayerHit,onVehicleHit,onWave,onWin,toast,heal,person,owned=()=>false,enabled=true}){
 const waves=harder?WAVES.map((wave,i)=>({
  ...wave,count:wave.count+3+i,cap:wave.cap+2,hp:wave.hp+15,
  pace:wave.pace+.35,interval:wave.interval*.82,damage:wave.damage+4,
 })):WAVES;
 const center=worldLocation(network.world.origin,RAID_CENTER);
 if(!enabled){
  installActionIcons(false);
  const noop=()=>{};
  return {center,active:false,armed:false,colliders:()=>[],start:noop,suspend:noop,reload:noop,toggleWeapon:noop,holster:noop,aimFrame:noop,queueShot:noop,cancelFire:noop,update:noop,setMouseFire:noop,blast:noop,ram:noop};
 }
 const route=processionRoute(network,{start:RAID_ENTRY,end:RAID_CENTER}),models=makeRaidModels(scene),actions=installActionIcons();person.root.add(models.gun);person.weapon=models.gun;
 let equipped='hands';
 const magazines=Object.fromEntries(Object.entries(ARMS).map(([id,spec])=>[id,{clip:spec.cap,reserve:spec.reserve}]));
 let shotSequence=0;
 const actionByWeapon=new Map();
 const nextAction=()=>{const seq=++shotSequence;actionByWeapon.set(equipped,seq);return seq;};
 const spec=()=>ARMS[equipped]||ARMS.pistol;
 const ammo=()=>magazines[equipped]||magazines.pistol;
 const weapon=installWeaponSelector(value=>{
  equipped=value;reloadTime=0;models.selectGun(value);queuedShot=mouseHeld=false;lastAim=null;refreshWeapon();
 },owned);
 const canFire=()=>equipped!=='hands'&&!weapon.open&&canShoot();
 const ui=document.createElement('section');ui.id='raid-ui';ui.innerHTML='<button class="raid-start" hidden><span>Difendi la Rotonda</span></button><div class="raid-banner" hidden><span></span><small></small><button aria-label="Sospendi raid" title="Sospendi raid">×</button></div><div class="raid-crosshair" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 2v8m0 12v8M2 16h8m12 0h8"/><circle cx="16" cy="16" r="1.5"/></svg></div>';document.body.append(ui);
 const startButton=ui.querySelector('.raid-start'),banner=ui.querySelector('.raid-banner'),crosshair=ui.querySelector('.raid-crosshair');
 let phase='idle',wave=0,kills=0,points=0,spawned=0,quota=0,spawnTimer=0,breakTimer=0,time=0,reloadTime=0,shotCooldown=0,uiTimer=0,hitFlash=0,run=0,mouseHeld=false,queuedShot=false,lastAim=null;
 const enemies=Array.from({length:waves.at(-1).cap},(_,slot)=>({active:false,slot,hp:0})),bullets=Array.from({length:96},()=>({active:false})),dummy=new THREE.Object3D(),bulletMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,4),new THREE.MeshBasicMaterial({color:'#ffffff'}),96),zero=new THREE.Matrix4().makeScale(0,0,0),color=new THREE.Color();bulletMesh.name='Pool proiettili visibili · 96';bulletMesh.frustumCulled=false;bulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(bulletMesh);
 const active=()=>phase==='playing'||phase==='break';
 function clearActors(){for(const e of enemies)e.active=false;for(const b of bullets)b.active=false;mouseHeld=queuedShot=false;}
 function checkpoint(extra={},gain){const current=progress();return save({raid_points:Math.max(current.raid_points||0,points),raid_checkpoint:{active:active(),run,wave,kills,points,updatedAt:Math.max(Date.now(),(current.raid_checkpoint?.updatedAt||0)+1)},...extra},gain);}
 function beginWave(){phase='playing';quota=waves[wave].count-kills;spawned=0;spawnTimer=.6;}
 function start(){const p=player();if(active()||!canStart()||!p.onFoot||Math.hypot(p.x-center.x,p.z-center.z)>40||!ready(center.x,center.z))return;clearActors();const c=progress().raid_checkpoint;if(c?.active&&c.wave<3){wave=Math.max(0,c.wave|0);kills=Math.max(0,Math.min(waves[wave].count,c.kills|0));points=c.points||0;run=c.run||Date.now();}else{wave=0;kills=points=0;run=Date.now();}if(!networkFire)for(const [id,m] of Object.entries(magazines)){m.clip=ARMS[id].cap;m.reserve=Math.max(ARMS[id].reserve,m.reserve);}reloadTime=0;heal(100);beginWave();void checkpoint();toast(equipped!=='hands'?'Difendi la Rotonda · F per sparare, R per ricaricare.':'Difendi la Rotonda · Seleziona la pistola dal menu Armi (X).');}
 function suspend(){if(!active())return;void checkpoint();phase='idle';clearActors();banner.hidden=true;toast(networkFire?'Raid interrotto.':'Raid salvato · riprendilo alla Rotonda.');}
 function reload(){if(!canFire()||reloadTime>0||ammo().clip===spec().cap)return;if(ammo().reserve<=0){toast(networkFire?'Munizioni esaurite.':'Munizioni esaurite · rifornisciti iniziando il raid alla Rotonda.');return;}reloadTime=1.25;networkReload?.(equipped,nextAction());playReloadSound();}
 function emit(a,target,owner,damage,speed,spread=0){const b=bullets.find(b=>!b.active);if(!b)return;const dx=target.x-a.x,dy=target.y-a.y,dz=target.z-a.z,length=Math.hypot(dx,dy,dz)||1,yaw=Math.atan2(dx,dz)+(Math.random()-.5)*spread,pitch=Math.asin(dy/length)+(Math.random()-.5)*spread*.55;Object.assign(b,{active:true,x:a.x,y:a.y,z:a.z,vx:Math.sin(yaw)*Math.cos(pitch)*speed,vy:Math.sin(pitch)*speed,vz:Math.cos(yaw)*Math.cos(pitch)*speed,owner,damage,life:2.8});}
 const cameraForward=new THREE.Vector3(),projection=new THREE.Vector3(),muzzlePosition=new THREE.Vector3();
 function refreshWeapon(){
  models.gun.visible=canFire();weapon.update(equipped,canShoot());
  crosshair.hidden=!canFire();actions.update(ammo().clip,ammo().reserve,reloadTime,canFire(),spec().cap);
 }
 function muzzle(p){
  const barrel=models.gun.localToWorld(muzzlePosition.set(0,.043,spec().muzzle)),chest={x:p.x,y:p.y,z:p.z};
  return traceCover(chest,barrel,solidsNear,height).fraction>=.995?barrel.clone():chest;
 }
 function aimFrame(camera){
  if(!canFire()){queuedShot=false;lastAim=null;crosshair.hidden=true;return;}
  if(!active()&&!networkFire){
   crosshair.hidden=false;crosshair.style.left='50%';crosshair.style.top='50%';
   crosshair.classList.remove('blocked','target');
   if((queuedShot||mouseHeld||fireHeld())&&shotCooldown<=0){
    queuedShot=false;const p=player(),dir=camera.getWorldDirection(cameraForward);
    const yaw=Math.atan2(dir.x,dir.z);
    lastAim={from:muzzle(p),target:{x:p.x+Math.sin(yaw)*65,y:p.y,z:p.z+Math.cos(yaw)*65}};shoot();
   }
   return;
  }
  const p=player(),dir=camera.getWorldDirection(cameraForward),origin=camera.position,end=origin.clone().addScaledVector(dir,90);
  let fraction=traceCover(origin,end,solidsNear,height).fraction;
  for(const e of enemies)if(e.active){const t=bodyHit(origin,end,e.x,e.y,e.z);if(t<fraction)fraction=t;}
  const peers=[...remoteTargets()];
  for(const [,x,y,z] of peers){
   const t=bodyHit(origin,end,x,y,z);
   if(t<fraction)fraction=t;
  }
  const target=origin.clone().lerp(end,fraction);
  const from=networkFire?new THREE.Vector3(p.x,p.y-.08,p.z):muzzle(p);
  // A wall beside the character may obstruct the muzzle even with a clear camera view.
  const line=new THREE.Vector3().copy(target).sub(from);
  if(line.dot(dir)<=.05)target.copy(from).addScaledVector(dir,1);
  const cover=traceCover(from,target,solidsNear,height);let impact=cover.fraction,aimEnemy=false;
  for(const e of enemies)if(e.active){const t=bodyHit(from,target,e.x,e.y,e.z);if(t<=impact){impact=t;aimEnemy=true;}}
  for(const [,x,y,z] of peers){
   const t=bodyHit(from,target,x,y,z);
   if(t<=impact){impact=t;aimEnemy=true;}
  }
  const hit=projection.copy(from).lerp(target,impact).project(camera);
  crosshair.hidden=false;
  crosshair.style.left=`${50+50*THREE.MathUtils.clamp(hit.x,-.94,.94)}%`;
  crosshair.style.top=`${50-50*THREE.MathUtils.clamp(hit.y,-.9,.9)}%`;
  crosshair.classList.toggle('blocked',!aimEnemy&&cover.fraction<.985);
  crosshair.classList.toggle('target',aimEnemy);
  lastAim={from,target};
  if((queuedShot||mouseHeld||fireHeld())&&shotCooldown<=0){queuedShot=false;shoot();}
 }
 function shoot(){
  if(!canFire()||!lastAim||reloadTime>0||shotCooldown>0)return;
  if(!ammo().clip){reload();return;}
  const {from,target}=lastAim;ammo().clip--;const current=spec();shotCooldown=current.delay;
  if(networkFire){
   const direction=new THREE.Vector3().subVectors(target,from).normalize();
   networkFire(equipped,direction.toArray(),nextAction());
  }
  if(!networkFire||active())for(let i=0;i<current.pellets;i++)emit(from,target,'player',current.damage,65,current.spread);
  onAim(Math.atan2(target.x-from.x,target.z-from.z));models.fire();playGunSound(false,0,equipped);onShot(active());
 }
 function killEnemy(e,amount){if(!e.active)return;e.hp-=amount;hitFlash=.12;if(e.hp>0)return;e.active=false;kills++;points+=100+wave*25;const p=progress();void checkpoint({raid_kills:(p.raid_kills||0)+1},{cp:2500,rp:10});}
 function spawn(){const e=enemies.find(e=>!e.active);if(!e)return;const offset=(spawned%2?1:-1)*.65,p=route.at(0,offset);if(!ready(p.x,p.z))return;Object.assign(e,{active:true,hp:waves[wave].hp,maxHp:waves[wave].hp,x:p.x,y:height(p.x,p.z),z:p.z,yaw:p.yaw,path:0,offset,cooldown:2+Math.random()*1.4,moving:true});spawned++;}
 function updateEnemy(e,dt){const spec=waves[wave],p=player(),to={x:p.x,y:p.y,z:p.z},from={x:e.x,y:e.y+1.25,z:e.z},distance=Math.hypot(e.x-p.x,e.z-p.z),cover=distance<34?traceCover(from,to,solidsNear,height):null,sight=!!cover&&(cover.fraction>=.995||p.vehicle&&cover.solid?.vehicle===p.vehicle);e.yaw=Math.atan2(p.x-e.x,p.z-e.z);e.moving=false;
  if(distance>20||!sight){let target;if(e.path<route.length){e.path=Math.min(route.length,e.path+dt*spec.pace);target=route.at(e.path,e.offset);}else{const a=time*.45+e.slot*2.4;target={x:p.x+Math.sin(a)*12,z:p.z+Math.cos(a)*12};}const dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz)||1,step=Math.min(d,spec.pace*dt),next=resolveCollision([e.x,e.z],[dx/d*step,dz/d*step],.32,solidsNear(e.x,e.z,2),network.world.terrain);if(ready(...next)){e.x=next[0];e.z=next[1];e.y=height(e.x,e.z);e.moving=step>.01;}}
  if(sight){e.cooldown-=dt;if(e.cooldown<=0){emit({x:e.x+Math.sin(e.yaw)*.55,y:e.y+1.25,z:e.z+Math.cos(e.yaw)*.55},to,'enemy',spec.damage,spec.speed,spec.spread);playGunSound(true,distance);e.cooldown=spec.interval+Math.random()*.8;}}else e.cooldown=Math.max(.65,e.cooldown);
 }
 function updateBullets(dt){const p=player();for(let i=0;i<bullets.length;i++){const b=bullets[i];if(b.active){const a={x:b.x,y:b.y,z:b.z},next={x:b.x+b.vx*dt,y:b.y+b.vy*dt,z:b.z+b.vz*dt},cover=traceCover(a,next,solidsNear,height);let first=cover.fraction,target=null;
   if(b.owner==='player'){for(const e of enemies)if(e.active){const t=bodyHit(a,next,e.x,e.y,e.z);if(t<first){first=t;target=e;}}}else if(p.onFoot&&!p.dead){const t=bodyHit(a,next,p.x,p.y-1.35,p.z);if(t<first){first=t;target='player';}}
   if(target||first<1){b.active=false;if(target==='player')onPlayerHit(b.damage);else if(target)killEnemy(target,b.damage);else if(cover.solid?.vehicle)onVehicleHit(cover.solid.vehicle,b.owner==='player'?20:8,b.owner);}
   else{b.x=next.x;b.y=next.y;b.z=next.z;b.life-=dt;if(b.life<=0)b.active=false;}}
   if(b.active){dummy.position.set(b.x,b.y,b.z);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(b.vx,b.vy,b.vz).normalize());dummy.scale.set(.035,.035,b.owner==='enemy'?.42:.6);dummy.updateMatrix();bulletMesh.setMatrixAt(i,dummy.matrix);color.set(b.owner==='enemy'?'#ff7755':'#ffe58a');bulletMesh.setColorAt(i,color);}else bulletMesh.setMatrixAt(i,zero);
  }bulletMesh.visible=bullets.some(b=>b.active);bulletMesh.instanceMatrix.needsUpdate=true;if(bulletMesh.instanceColor)bulletMesh.instanceColor.needsUpdate=true;
 }
 startButton.prepend(document.createRange().createContextualFragment(actionIcon('shield')));const startLabel=startButton.querySelector('span');
 startButton.onclick=start;const suspendButton=banner.querySelector('button');setIcon(suspendButton,'pause','Sospendi raid');suspendButton.onclick=suspend;
 function update(dt){time+=dt;shotCooldown=Math.max(0,shotCooldown-dt);hitFlash=Math.max(0,hitFlash-dt);if(reloadTime>0){reloadTime=Math.max(0,reloadTime-dt);if(!reloadTime){const m=ammo(),n=Math.min(spec().cap-m.clip,m.reserve);m.clip+=n;m.reserve-=n;}}
  const p=player();if(active()&&Math.hypot(p.x-center.x,p.z-center.z)>180)suspend();
  if(phase==='playing'){const spec=waves[wave];spawnTimer-=dt;if(spawnTimer<=0&&spawned<quota&&enemies.filter(e=>e.active).length<spec.cap){spawn();spawnTimer=1.65;}for(const e of enemies)if(e.active&&ready(e.x,e.z))updateEnemy(e,dt);if(kills>=spec.count){points+=350*(wave+1);const completedWave=wave+1;onWave(completedWave);if(completedWave===3){phase='victory';clearActors();void checkpoint({raid_completed:true,raid_wave:3});onWin(points);}else{wave++;kills=0;phase='break';breakTimer=5;if(!networkFire)ammo().reserve+=equipped==='shotgun'?8:30;heal(25);void checkpoint({raid_wave:completedWave});}}}
  else if(phase==='break'){breakTimer-=dt;if(breakTimer<=0)beginWave();}
  updateBullets(dt);models.render(enemies,time);models.updateGun(dt);refreshWeapon();crosshair.classList.toggle('hit',hitFlash>0);uiTimer-=dt;if(uiTimer<=0){uiTimer=.1;startButton.hidden=active()||!canStart()||!p.onFoot||Math.hypot(p.x-center.x,p.z-center.z)>40;startLabel.textContent=harder?'Raid alla Rotonda · Difficile':progress().raid_checkpoint?.active?'Riprendi il raid':progress().raid_completed?'Rigioca il raid':'Difendi la Rotonda';banner.hidden=!active();banner.querySelector('span').textContent=`Ondata [${wave+1}/3]: Respingi gli invasori alla Rotonda`;banner.querySelector('small').textContent=phase==='break'?`Prossima ondata tra ${Math.ceil(breakTimer)}s`:`${Math.max(0,waves[wave].count-kills)} invasori · ${formatCP((waves.slice(0,wave).reduce((sum,w)=>sum+w.count,0)+kills)*2500)}`;document.body.classList.toggle('raid-active',active());}
 }
 for(let i=0;i<bullets.length;i++)bulletMesh.setMatrixAt(i,zero);weapon.update(equipped,false);actions.update(ammo().clip,ammo().reserve,reloadTime,false);crosshair.hidden=true;return {start,suspend,reload,shoot,aimFrame,syncAmmo({weapon,clip,reserve,seq}){
  if(actionByWeapon.get(weapon)!==seq||!magazines[weapon])return;
  Object.assign(magazines[weapon],{clip,reserve});
  if(weapon===equipped)reloadTime=0;
 },refill(){
  reloadTime=0;shotCooldown=0;actionByWeapon.clear();
  for(const [key,magazine] of Object.entries(magazines))Object.assign(magazine,{clip:ARMS[key].cap,reserve:ARMS[key].reserve});
 },toggleWeapon:weapon.toggle,holster(){equipped='hands';reloadTime=0;queuedShot=mouseHeld=false;lastAim=null;refreshWeapon();},queueShot(){queuedShot=canFire();},cancelFire(){queuedShot=mouseHeld=false;weapon.close();},update,center,route,get active(){return active();},setMouseFire(value){mouseHeld=value;},get armed(){return models.gun.visible;},blast(point,radius,source){for(const e of enemies)if(e.active){const d=Math.hypot(e.x-point.x,e.z-point.z);if(d<radius&&traceCover(point,{x:e.x,y:e.y+1,z:e.z},(x,z,r)=>solidsNear(x,z,r).filter(s=>s.vehicle!==source),height).fraction>=.995)killEnemy(e,130*(1-d/radius));}},ram(car,speed){if(speed<4)return;for(const e of enemies)if(e.active&&Math.hypot(e.x-car.x,e.z-car.z)<car.spec.length/2+.8)killEnemy(e,speed*5);},colliders(x,z,r){return enemies.filter(e=>e.active&&Math.hypot(e.x-x,e.z-z)<r+.5).map(e=>({id:'invader-'+e.slot,rings:[[[e.x-.3,e.z-.3],[e.x+.3,e.z-.3],[e.x+.3,e.z+.3],[e.x-.3,e.z+.3],[e.x-.3,e.z-.3]]],bounds:[e.x-.3,e.z-.3,e.x+.3,e.z+.3],roofY:e.y+1.85}));}};
}
