import {openOnlineRoom,onlineAvailable} from './online-client.js';
import {ROOM_SIZE} from './online-wire.js';

export function installOnlineLobby(onPause,onEvent){
 const tool=document.createElement('button');
 tool.type='button';
 tool.className='lan-tool online-tool';
 tool.textContent='ONLINE';
 tool.setAttribute('aria-haspopup','dialog');
 document.querySelector('.utility').append(tool);
 const dialog=document.createElement('dialog');
 dialog.className='pause-screen lan-lobby online-lobby';
 dialog.setAttribute('aria-labelledby','online-title');
 dialog.innerHTML=`
 <header class="pause-header"><div><p>GTA CTATELLA <span>· PARTITA LIBERA</span></p><h1 id="online-title">Online</h1></div></header>
 <section class="online-options" data-online="setup" aria-labelledby="online-options-title">
  <h2 id="online-options-title">Come vuoi giocare?</h2>
  <div class="lan-actions">
   <button type="button" data-online="public">Entra in partita pubblica</button>
   <button type="button" data-online="private">Crea stanza privata</button>
  </div>
  <form>
   <label for="online-code">Hai un codice stanza?</label>
   <input id="online-code" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
   <button>Entra con codice</button>
  </form>
 </section>
 <section class="online-room" data-online="room" aria-labelledby="online-room-title" hidden>
  <h2 id="online-room-title" data-online="type"></h2>
  <p class="online-room-count" data-online="count" aria-live="polite"></p>
  <p class="online-room-code">Codice stanza <strong data-online="invite"></strong></p>
  <p>Condividi il codice con chi vuoi invitare. Puoi giocare anche da solo.</p>
  <button class="online-play" type="button" data-online="resume">GIOCA</button>
 </section>
 <p class="lan-status" role="status" hidden></p>
 <div class="lan-actions">
  <button type="button" data-online="leave" hidden>Lascia stanza</button>
  <button type="button" data-online="home">Torna alla home</button>
 </div>`;
 document.body.append(dialog);
 const get=name=>dialog.querySelector(`[data-online="${name}"]`);
 const status=dialog.querySelector('[role=status]'),form=dialog.querySelector('form'),input=form.querySelector('input');
 let room,generation=0,currentRoom=null;
 function show(){
  if(!dialog.open){dialog.showModal();onPause(true);}
 }
 function update(message='',busy=false){
  get('setup').hidden=busy||!!currentRoom||!onlineAvailable;
  get('room').hidden=!currentRoom;
  get('leave').hidden=!busy&&!currentRoom;
  get('leave').textContent=busy?'Annulla collegamento':'Lascia stanza';
  status.hidden=!message;
  status.textContent=message;
  if(currentRoom){
   const {code,count,private:privateRoom}=currentRoom;
   get('type').textContent=privateRoom?'Stanza privata':'Stanza pubblica';
   get('invite').textContent=code;
   const countText=`${count}/${ROOM_SIZE} giocatori nella stanza`;
   if(get('count').textContent!==countText)get('count').textContent=countText;
   tool.textContent=`STANZA ${count}/${ROOM_SIZE}`;
   tool.setAttribute('aria-label',`Apri la stanza online. ${countText}`);
  }else{
   tool.textContent='ONLINE';
   tool.setAttribute('aria-label','Apri il menu online');
  }
 }
 function leave(message){
  generation++;
  room?.close();room=null;currentRoom=null;
  update(message);show();
 }
 async function connect(mode,code){
  const token=++generation;
  update('Collegamento in corso…',true);
  get('leave').focus();
  try{
   const next=await openOnlineRoom({mode,code},{
    onStatus(state){
     if(token!==generation)return;
     if(state.starting){update('Avvio del server…',true);return;}
     if(state.message){leave(state.message);return;}
     const first=!currentRoom;
     currentRoom=state;
     update();
     if(first){onEvent({type:'joined'});get('resume').focus();}
    },onEvent,
   });
   if(token===generation)room=next;else next.close();
  }catch(error){if(token===generation)leave(error.message);}
 }
 tool.onclick=show;
 dialog.onclose=()=>{onPause(false);tool.focus();};
 dialog.oncancel=event=>{event.preventDefault();if(currentRoom)dialog.close();};
 get('public').onclick=()=>void connect('public');
 get('private').onclick=()=>void connect('private');
 get('resume').onclick=()=>dialog.close();
 get('leave').onclick=()=>{const joined=!!currentRoom;leave(joined?'Hai lasciato la stanza.':'');get('public').focus();};
 get('home').onclick=()=>{
  leave();
  const url=new URL(location.href);url.searchParams.delete('mode');location.assign(url);
 };
 form.onsubmit=event=>{
  event.preventDefault();
  const code=input.value.trim().toUpperCase();
  if(/^[A-HJ-NP-Z2-9]{6}$/.test(code))void connect('join',code);
  else{update('Inserisci un codice di sei caratteri.');input.focus();}
 };
 window.addEventListener('pagehide',()=>{generation++;room?.close();});
 window.addEventListener('pageshow',event=>{if(event.persisted)leave();});
 update(onlineAvailable?'':'Il server online deve essere configurato.');
 show();
 return {get room(){return currentRoom?room:null;},get open(){return dialog.open;}};
}
