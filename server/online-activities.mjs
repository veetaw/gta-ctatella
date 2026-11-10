import {HIDE_SAVE_RADIUS} from '../src/online-wire.js';
import {randomInt} from 'node:crypto';

export function createActivities({send, height, canSee, spawn, viewDistance}){
 const position=player=>player.driver?.pose??player.pose;
 const distance=(a,b)=>Math.hypot(a[1]-b[1],a[2]-b[2],a[3]-b[3]);
 function visible(seeker,target){
  const dx=target[1]-seeker[1],dz=target[3]-seeker[3];
  const facing=dx*Math.sin(seeker[4])+dz*Math.cos(seeker[4]);
  return (Math.hypot(dx,dz)<1.5||facing>=Math.hypot(dx,dz)*.37)&&canSee(seeker,target);
 }
 const publish=room=>{
  const game=room.hide;
  for(const player of room.players.values())send(player,{
   type:'hide',phase:game.phase,remaining:game.hiders.size,
   role:player===game.seeker?'seeker':game.hiders.has(player)?'hider':game.saved.has(player)?'saved':game.found.has(player)?'found':'spectator',
   seconds:Math.max(0,Math.ceil((game.until-performance.now())/1000)),
  });
 };
 function finish(room,result){
  const game=room.hide;
  room.hide=null;
  for(const player of room.players.values()){
   const message=game.saved.has(player)?'Ti sei salvato!':game.found.has(player)?'Sei stato scoperto.':'';
   send(player,{type:'hide',phase:'idle',result:[message,result].filter(Boolean).join(' ')});
  }
 }
 function start(room,requester,now){
  if(room.hide)return;
  const players=[...room.players.values()].filter(p=>p.pose&&!p.deadAt);
  if(players.length<2){send(requester,{type:'notice',message:'Servono almeno due giocatori già in partita.'});return;}
  const seekers=players.filter(p=>!p.driver&&p.pose[0]==='foot');
  if(!seekers.length){send(requester,{type:'notice',message:'Per iniziare, almeno un giocatore deve essere a piedi.'});return;}
  const seeker=seekers[randomInt(seekers.length)];
  room.hide={seeker,hiders:new Set(players.filter(p=>p!==seeker)),saved:new Set(),found:new Set(),phase:'escape',until:now+10000};
  publish(room);
 }
 function update(room,now){
  const game=room.hide;
  if(!game)return;
  if(game.phase==='escape'){
   if(now<game.until)return;
   game.phase='search';game.until=0;publish(room);
  }
  const seeker=position(game.seeker);
  if(!seeker)return;
  for(const hider of game.hiders){
   const pose=position(hider);
   if(!pose||distance(seeker,pose)>5||!visible(seeker,pose))continue;
   resolve(room,hider,game.found);
   if(!room.hide)return;
  }
 }
 function resolve(room,player,outcome){
  room.hide.hiders.delete(player);
  outcome.add(player);
  if(!room.hide.hiders.size)finish(room,'Nascondino finito.');
  else publish(room);
 }
 function save(room,player){
  const game=room.hide, pose=position(player), seeker=game&&position(game.seeker);
  if(game?.phase!=='search'||!game.hiders.has(player)||!pose||!spawn)return;
  if(player.driver||pose[0]!=='foot'||Math.hypot(pose[1]-spawn.x,pose[3]-spawn.z)>HIDE_SAVE_RADIUS||
     Math.abs(pose[2]-height(pose[1],pose[3]))>3){
   send(player,{type:'notice',message:'Torna a piedi al punto di salvezza.'});return;
  }
  if(seeker&&distance(pose,seeker)<viewDistance&&visible(seeker,pose)){
   send(player,{type:'notice',message:'Il cercatore ti vede!'});return;
  }
  resolve(room,player,game.saved);
 }
 function leave(room,player){
  const game=room.hide;
  if(!game)return;
  if(game.seeker===player){finish(room,'Il cercatore ha lasciato la stanza.');return;}
  if(!game.hiders.delete(player))return;
  if(!game.hiders.size)finish(room,'Nascondino finito.');
  else publish(room);
 }
 function crews(room){
  const vehicles=[...room.players.values()].filter(p=>p.passengers.size).map(p=>[p.slot,p.passengers.size]);
  for(const player of room.players.values())send(player,{type:'crews',vehicles});
 }
 function release(player){
  if(player.driver){
   const driver=player.driver;
   driver.passengers.delete(player);
   player.driver=null;
   if(driver.pose)player.pose=['foot',driver.pose[1],height(driver.pose[1],driver.pose[3]),driver.pose[3],driver.pose[4],0];
   send(player,{type:'seat',driver:null});
   crews(driver.room);
  }
  for(const passenger of [...player.passengers])release(passenger);
 }
 function board(player,slot){
  const driver=player.room.players.get(slot);
  const pose=driver?.pose;
  if(!pose||driver===player||driver.driver||player.driver||player.deadAt||player.pose?.[0]!=='foot'||
     pose[0]==='foot'||Math.abs(pose[5])>3||distance(player.pose,pose)>6||
     (pose[0]==='helicopter'&&pose[2]-height(pose[1],pose[3])>2)||
     (player.room.hide?.phase==='escape'&&player.room.hide.seeker===player))return;
  const capacity=pose[0]==='rambo'?6:pose[0]==='helicopter'||pose[0]==='motocross'?2:4;
  if(driver.passengers.size>=capacity-1){send(player,{type:'notice',message:'Tutti i posti sono occupati.'});return;}
  player.driver=driver;
  driver.passengers.add(player);
  send(player,{type:'seat',driver:driver.slot,pose});
  crews(driver.room);
 }
 return {start,update,leave,board,release,publish,crews,save};
}
