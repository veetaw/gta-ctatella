import * as THREE from 'three';
import {inBuilding,nearest} from './world-math.js';
import {makeMazzuoccoloModel} from './mazzuoccolo-model.js';
import {launchMazzuoccolo,advanceMazzuoccolo,mazzuoccoloWallContact,MAZZUOCCOLO_RADIUS as radius} from './mazzuoccolo-physics.js';
import {traceCover} from './combat-geometry.js';
import {worldLocation,MAZZUOCCOLO_START,MAZZUOCCOLO_FINISH} from './game-locations.js';

export function makeMazzuoccolo(scene,{network,height,solidsNear,ready,player,camera,toast,onWin=()=>{},canStart=()=>true}){
 const home=worldLocation(network.world.origin,MAZZUOCCOLO_START),goal=worldLocation(network.world.origin,MAZZUOCCOLO_FINISH),reach=2.5;
 let mode='idle',phase=0,power=.5,angle=0,baseYaw=0,body=null,throws=0,uiTime=0,won=false,bestDistance=0,unseen=0,visibilityTimer=0;
 const panel=document.createElement('section');panel.id='mazzuoccolo';panel.hidden=true;panel.setAttribute('aria-label','Lu Mazzuoccl');
 panel.innerHTML='<strong>LU MAZZUOCCL</strong><span class="maz-score"></span><p class="maz-message" role="status" aria-live="polite"></p><div class="maz-meter" hidden><i></i></div><div class="maz-actions"><button type="button" class="maz-play">Blocca potenza</button><button type="button" class="maz-cancel">Esci</button></div>';
 const pickup=document.createElement('button');pickup.id='maz-pickup';pickup.type='button';pickup.textContent='Raccogli mazzuoccolo';pickup.hidden=true;document.body.append(panel,pickup);
 const scoreLabel=panel.querySelector('.maz-score'),message=panel.querySelector('.maz-message'),meter=panel.querySelector('.maz-meter'),fill=meter.firstElementChild,play=panel.querySelector('.maz-play'),cancel=panel.querySelector('.maz-cancel');
 const root=new THREE.Group();root.add(makeMazzuoccoloModel());scene.add(root);
 const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(),2.6,0xf1d18a,.55,.35);scene.add(arrow);arrow.visible=false;
 function groundMarker(color){const mesh=new THREE.Mesh(new THREE.RingGeometry(.8,1.05,24),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));mesh.rotation.x=-Math.PI/2;scene.add(mesh);return mesh;}
 const marker=groundMarker('#e6cc89'),finishMarker=groundMarker('#9bd5a4');finishMarker.visible=false;
 const direction=new THREE.Vector3(),projection=new THREE.Vector3(),point=[0,0];
 function inView(){
  if(!camera||body.distance<3.5)return true;
  const target={x:body.x,y:body.y+.18,z:body.z};
  if(camera.position.distanceToSquared(target)>58**2)return false;
  projection.copy(target).project(camera);
  if(Math.abs(projection.x)>1.05||Math.abs(projection.y)>1.05||Math.abs(projection.z)>1)return false;
  return traceCover(camera.position,target,solidsNear,height).fraction>.98;
 }
 const near=(p,q)=>p.onFoot&&Math.hypot(p.x-q.x,p.z-q.z)<=reach;
 const remaining=()=>Math.max(0,Math.hypot((body||home).x-goal.x,(body||home).z-goal.z)-reach);
 function onRoad(x,z){const p=network.pavementAt(x,z);if(!p||p.triangle?.island)return false;if(p.triangle?.apron){const n=network.closestSegment(x,z);return !!n&&n.d<=n.segment.road.width/2;}return true;}
 function blocked(x,z){point[0]=x;point[1]=z;for(const b of solidsNear(x,z,radius+.4)){if(inBuilding(point,b))return true;for(const ring of b.rings)for(let i=1;i<ring.length;i++)if(nearest(point,ring[i-1],ring[i]).d<radius)return true;}return false;}
 const surface={height,ready,contact:(body,x,z)=>mazzuoccoloWallContact(body,x,z,solidsNear(x,z,1.4))};
 function scores(){scoreLabel.textContent=`Traguardo: ${won?'0.0':remaining().toFixed(1)} m · Lanci ${throws}`;}
 function visual(){if(!body)return;root.position.set(body.x,body.y??height(body.x,body.z)+radius+.035,body.z);root.quaternion.copy(body.orientation);if(mode==='power'||mode==='angle')root.rotation.set(0,baseYaw+angle,.16);}
 function start(){
  if(!canStart())return;
  const p=player(),position=body||home;if(!near(p,position)||won)return;
  if(!ready(position.x,position.z)||blocked(position.x,position.z)){toast('Raggiungi il mazzuoccolo in un punto libero.');return;}
  const n=network.closestSegment(position.x,position.z);baseYaw=Math.atan2(goal.x-position.x,goal.z-position.z);
  if(n){const a=n.segment.a,b=n.segment.b,yaw=Math.atan2(b.x-a.x,b.z-a.z);baseYaw=Math.cos(yaw-baseYaw)>=0?yaw:yaw+Math.PI;}
  body=launchMazzuoccolo(position.x,position.z,baseYaw,0);body.status='aiming';mode='power';phase=0;power=.5;angle=0;
  panel.hidden=false;pickup.hidden=true;arrow.visible=true;meter.hidden=false;play.hidden=false;play.disabled=false;play.textContent='Blocca potenza';message.textContent='Tocca per bloccare la potenza';scores();visual();
 }
 function action(){
  if(!player().onFoot)return;
  if(mode==='power'){mode='angle';phase=0;message.textContent='Scegli la direzione e lancia';play.textContent='Lancia';return;}
  if(mode==='angle'){body=launchMazzuoccolo(body.x,body.z,baseYaw+angle,power);mode='rolling';throws++;unseen=visibilityTimer=0;arrow.visible=false;meter.hidden=true;play.disabled=true;message.textContent='Lancio in corso…';return;}
  if(mode==='idle'||mode==='result')start();
 }
 function stop(){mode='idle';body=null;throws=0;won=false;bestDistance=0;arrow.visible=finishMarker.visible=false;panel.hidden=true;pickup.hidden=true;meter.hidden=true;play.disabled=false;root.quaternion.identity();}
 function finish(){
  const lost=!won&&(body.status==='lost'||!inView());
  if(lost){
   body=launchMazzuoccolo(body.startX,body.startZ,baseYaw,0);body.status='stopped';
   visual();toast('Mazzuoccl fuori vista · Riparti dall’ultimo tiro.');
  }else bestDistance=Math.max(bestDistance,body.distance||0);
  if(won)onWin({throws_count:throws,best_distance_m:bestDistance});
  mode='result';play.disabled=false;play.textContent='Raccogli e rilancia';
  message.textContent=won?'Traguardo raggiunto!':lost?'Riprova dal punto dell’ultimo tiro':'Raggiungi il mazzuoccolo per il prossimo lancio';
  scores();
 }

 play.onclick=action;pickup.onclick=action;cancel.onclick=stop;
 return {action,reset:stop,get aiming(){return mode==='power'||mode==='angle';},rotate(delta){if(mode==='power'||mode==='angle')baseYaw+=delta;},interact(){if(!canStart())return false;if((mode==='idle'||mode==='result')&&near(player(),body||home)){action();return true;}return false;},update(dt){
  const p=player();if(!p.onFoot&&mode!=='idle')stop();panel.hidden=mode==='idle';panel.classList.toggle('maz-active',mode!=='idle');pickup.hidden=!canStart()||mode!=='idle'||!near(p,home)||!ready(home.x,home.z);
  const homeReady=ready(home.x,home.z);marker.visible=homeReady&&Math.hypot(p.x-home.x,p.z-home.z)<120;root.visible=mode!=='idle'||marker.visible;
  if(homeReady){marker.position.set(home.x,height(home.x,home.z)+.025,home.z);if(mode==='idle')root.position.set(home.x,height(home.x,home.z)+radius+.035,home.z);}
  finishMarker.visible=mode!=='idle'&&ready(goal.x,goal.z);if(finishMarker.visible)finishMarker.position.set(goal.x,height(goal.x,goal.z)+.025,goal.z);
  if(mode==='result')play.hidden=won||!near(p,body);
  if(mode==='power'||mode==='angle'){phase+=dt;const wave=.5+.5*Math.sin(phase*(mode==='power'?3.5:2.3));if(mode==='power')power=.1+.9*wave;else angle=(wave-.5)*.8;fill.style.width=`${wave*100}%`;visual();arrow.position.set(body.x,height(body.x,body.z)+.6,body.z);direction.set(Math.sin(baseYaw+angle),0,Math.cos(baseYaw+angle));arrow.setDirection(direction);arrow.setLength(1.5+power*2,.5,.3);}
  if(mode==='rolling'){let time=dt;while(time>0&&body.status==='rolling'){const h=Math.min(time,1/90),before=[body.x,body.z];advanceMazzuoccolo(body,h,surface);time-=h;
   if(ready(goal.x,goal.z)&&nearest([goal.x,goal.z],before,[body.x,body.z]).d<=reach&&onRoad(body.x,body.z)){won=true;body.status='stopped';body.vx=body.vz=body.vy=0;}}
   visibilityTimer+=dt;
   if(visibilityTimer>=.14){
    unseen=inView()?0:unseen+visibilityTimer;visibilityTimer=0;
    if(unseen>.55&&!won)body.status='lost';
   }
   visual();uiTime+=dt;if(uiTime>.12){scores();uiTime=0;}if(body.status!=='rolling')finish();}
 },stats:()=>({mode,throws,won,home,goal,remaining:mode==='idle'?null:remaining(),distance:body?.distance??0,bounces:body?.bounces??0})};
}
