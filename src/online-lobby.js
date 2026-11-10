import {openOnlineRoom,onlineAvailable} from './online-client.js';
import {ROOM_SIZE} from './online-wire.js';

export function installOnlineLobby(onPause,onEvent){
 const tool=document.createElement('button');
 tool.type='button';
 tool.className='lan-tool online-tool';
 tool.textContent='ONLINE';
 document.querySelector('.utility').append(tool);
 const dialog=document.createElement('dialog');
 dialog.className='pause-screen lan-lobby';
 dialog.setAttribute('aria-labelledby','online-title');
 dialog.innerHTML=`
 <header class="pause-header"><div><p>GTA CTATELLA <span>· PARTITA LIBERA</span></p><h1 id="online-title">Online</h1></div></header>
 <p>Gioca via Internet. Ogni stanza ospita fino a sei giocatori.</p>
 <div class="lan-actions" data-online="setup">
  <button type="button" data-online="public">Partita pubblica</button>
  <button type="button" data-online="private">Crea stanza privata</button>
  <form><label for="online-code">Codice stanza</label><input id="online-code" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" required><button>Entra con codice</button></form>
 </div>
 <p class="lan-status" role="status"></p>
 <div class="lan-actions">
  <button type="button" data-online="resume" hidden>Torna in gioco</button>
  <button type="button" data-online="leave" hidden>Lascia stanza</button>
  <button type="button" data-online="home">Torna alla home</button>
 </div>`;
 document.body.append(dialog);
 const get=name=>dialog.querySelector(`[data-online="${name}"]`);
 const status=dialog.querySelector('[role=status]'),form=dialog.querySelector('form'),input=form.querySelector('input');
 let room,generation=0,active=false;
 function show(){
  if(!dialog.open){dialog.showModal();onPause(true);}
 }
 function update(message='',busy=false){
  get('setup').hidden=busy||active||!onlineAvailable;
  get('resume').hidden=!active;
  get('leave').hidden=!busy&&!active;
  status.textContent=message;
 }
 function leave(message){
  generation++;
  room?.close();room=null;active=false;
  update(message);show();
 }
 async function connect(mode,code){
  const token=++generation;
  update('Collegamento in corso…',true);
  try{
   const next=await openOnlineRoom({mode,code},{
    onStatus(state){
     if(token!==generation)return;
     if(state.message){leave(state.message);return;}
     const first=!active;
     active=true;
     update(`Stanza ${state.private?'privata':'pubblica'} · ${state.code} · ${state.count}/${ROOM_SIZE}`);
     if(first){onEvent({type:'joined'});get('resume').focus();}
    },onEvent,
   });
   if(token===generation)room=next;else next.close();
  }catch(error){if(token===generation)leave(error.message);}
 }
 tool.onclick=show;
 dialog.onclose=()=>{onPause(false);tool.focus();};
 dialog.oncancel=event=>{event.preventDefault();if(active)dialog.close();};
 get('public').onclick=()=>void connect('public');
 get('private').onclick=()=>void connect('private');
 get('resume').onclick=()=>dialog.close();
 get('leave').onclick=()=>leave();
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
 return {get room(){return active?room:null;},get open(){return dialog.open;}};
}
