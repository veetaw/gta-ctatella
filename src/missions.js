import {hasPlanted} from './farm-locations.js';
import {formatCP,levelFor} from './economy.js';
import {setIcon} from './ui-icons.js';
import {PROCESSION_GOAL_METERS} from './progress-record.js';
import {supabase,createProgress} from './supabase.js';

export function createMissions(onChange,user,{adult=true}={}){
 const ui=document.createElement('div');
 ui.id='missions-ui';
 ui.innerHTML=`
 <dialog class="pause-screen" id="progress-screen" aria-labelledby="pause-title">
  <header class="pause-header">
   <div><p>GTA CTATELLA <span>· IN PAUSA</span></p><h1 id="pause-title">Missioni</h1></div>
   <button class="pause-close" type="button"></button>
  </header>
  <nav class="pause-tabs" aria-label="Menu di pausa">
   <button type="button" data-panel="missions">Missioni</button>
   <button type="button" data-panel="ranking">Classifica</button>
  </nav>
  <section class="pause-missions" aria-label="Elenco missioni"><ol></ol></section>
  <section class="pause-ranking" aria-label="Classifica del paese" hidden>
   <div class="pause-account"><p class="account-status"></p><button type="button" class="logout">Esci dall’account</button></div>

   <p class="ranking-message" role="status"></p>
   <ol class="pause-scores"></ol>
  </section>
 </dialog>
 <div class="economy-hud"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M5 9a1 1 0 0 0 1-1m12 8a1 1 0 0 0 1-1"/></svg><span></span></div>`;
 document.body.append(ui);
 const $=selector=>ui.querySelector(selector),dialog=$('dialog'),closeButton=$('.pause-close');
 const wallet=$('.economy-hud span'),badge=document.querySelector('.level-badge');
 const missions=$('.pause-missions'),ranking=$('.pause-ranking'),toolbar=document.querySelector('.utility');
 const tabs=[...ui.querySelectorAll('[data-panel]')];
 const activities=[
  ['Porta la Statua',s=>[s.processionDone,`Processione · ${Math.floor(s.processionMeters)}/${PROCESSION_GOAL_METERS} m`]],
  ['Completa lu mazzuoccl',s=>[!!s.local.throws_count,'Da la nunziata a la chiazza inta r grutt']],
  ['Turniata di San Vito',s=>[s.turneiaCompleted,`Piazza San Vito`]],
  ['Abballa la Statua di San Gregorio',s=>[s.abballaCompleted,`Piazza Municipio`]],
  ...(adult?[['Difendi la Rotonda',s=>[s.raidCompleted,`${s.raidWave}/3 ondate`]]]:[]),
  ['Fa lu vuin',s=>[s.local.farm_wine?.completed,'Vigneto · Via Serrone']],
  ['Piazzale dell’eliporto',s=>[false,'Acquista veicoli e attrezzatura']],
 ['Chianta r patan',s=>[hasPlanted(s.economy.farm,'potatoes'),'Pianta r patan nel terreno']],
 ['Semmna r gruan',s=>[hasPlanted(s.economy.farm,'wheat'),'Semina il grano nel terreno']],
 ['Porta il grano al mulino',s=>[!!s.economy.farm.wheatDelivered,'Coltiva il grano e consegnalo con la Rambo']],
 ['Scuot i pruciuin',s=>[!!s.economy.farm.chicksRaised,'Va cvuerna · Porta il fariniello al pollaio']],
 ['Crisc lu puorc',s=>[s.local.farm_pigs?.completed,'Lu patanar · Compra r patan']],
 ];
 const destinations=adult?['procession','mazzuoccolo','turneia','statue','raid','wine','shop','potatoes','wheat','mill','chicks','pigs']:['procession','mazzuoccolo','turneia','statue','wine','shop','potatoes','wheat','mill','chicks','pigs'];
 let onNavigate=null;
 const missionRows=activities.map(([title],i)=>{
  const row=document.createElement('li');
  row.innerHTML='<div><strong></strong><small></small></div><span></span><button type="button" class="mission-navigate">Vai</button>';
  const button=row.querySelector('button');button.setAttribute('aria-label',`Mostra percorso · ${title}`);
  button.onclick=()=>onNavigate?.(destinations[i],title);
  row.querySelector('strong').textContent=title;
  missions.querySelector('ol').append(row);
  return row;
 });
 let activePanel='missions',refreshId=0,bannerTimer,opener;
 let onToggle=null;
 function tool(id,icon,label){
  const button=document.createElement('button');
  button.type='button';button.className='mission-tool';button.setAttribute('aria-controls',dialog.id);
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');setIcon(button,icon,label);
  button.onclick=()=>open(id,button);toolbar.append(button);return button;
 }
 const tools={missions:tool('missions','missions','Missioni'),ranking:tool('ranking','ranking','Classifica')};
 function updateTabs(){
  for(const tab of tabs)tab.setAttribute('aria-pressed',String(tab.dataset.panel===activePanel));
  for(const [id,button] of Object.entries(tools))button.setAttribute('aria-expanded',String(dialog.open&&id===activePanel));
 }
 function show(id){
  activePanel=id;missions.hidden=id!=='missions';ranking.hidden=id!=='ranking';
  $('#pause-title').textContent=id==='missions'?'Missioni':'Classifica';
  dialog.scrollTop=0;updateTabs();
  if(id==='ranking')void refresh();
 }
 function open(id,button){
  if(dialog.open)return;
  opener=button;dialog.showModal();show(id);onToggle?.(true);closeButton.focus();
 }
 function close(){if(dialog.open)dialog.close();}
 dialog.addEventListener('close',()=>{updateTabs();onToggle?.(false);if(!document.querySelector('dialog[open]'))opener?.focus();});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 setIcon(closeButton,'close','Riprendi il gioco');
 closeButton.onclick=close;
 for(const tab of tabs)tab.onclick=()=>show(tab.dataset.panel);
 function render(state){
  activities.forEach(([,read],i)=>{
   const [completed,detail]=read(state),row=missionRows[i],locked=i>0&&destinations[i]!=='shop'&&!state.processionDone;
   row.querySelector('small').textContent=detail;
   row.querySelector('span').textContent=locked?'Bloccata':completed?'✓ Completata':'Da completare';
   row.classList.toggle('completed',!!completed&&!locked);
   row.querySelector('button').disabled=locked;
  });
  wallet.textContent=state.economy.cp.toLocaleString('it-IT');
  wallet.setAttribute('aria-label',`Portafoglio · ${formatCP(state.economy.cp)}`);
  badge.querySelector('strong').textContent=state.level;badge.setAttribute('aria-label',`Livello ${state.level}`);
  $('.account-status').textContent=`${state.username} · ${state.economy.rp} RP · LV ${state.level}${state.pending?' · Sincronizzazione in attesa':''}`;
  onChange(state);
 }
 const progress=createProgress(render,{user});render(progress.state());
 async function refresh(){
  const request=++refreshId,message=$('.ranking-message'),list=$('.pause-scores');
  message.textContent='Caricamento…';list.replaceChildren();
  const result=await progress.leaderboard();
  if(request!==refreshId||!dialog.open||activePanel!=='ranking')return;
  for(const [i,row] of result.rows.entries()){
   const li=document.createElement('li');
   li.innerHTML='<span></span><strong></strong><span></span>';
   li.firstElementChild.textContent=String(i+1).padStart(2,'0');
   li.querySelector('strong').textContent=row.username;
   li.lastElementChild.textContent=`${row.rp} RP · LV ${levelFor(row.rp)}`;list.append(li);
  }
  message.textContent=result.scope==='locale'?'Classifica locale · Reputazione':result.rows.length?'Classifica globale · Reputazione':'Nessun risultato ancora.';
 }
 $('.logout').onclick=async()=>{const {error}=await supabase.auth.signOut();if(error){$('.ranking-message').textContent=error.message;return;}location.reload();};
 progress.subscribe(()=>{if(dialog.open&&activePanel==='ranking')void refresh();});
 const celebration=document.createElement('div');
 celebration.className='mission-celebration';celebration.hidden=true;
 celebration.innerHTML='<div class="mission-banner" role="status"><strong></strong><span></span></div><div class="mission-confetti" aria-hidden="true"></div>';
 document.body.append(celebration);
 const heading=celebration.querySelector('strong'),details=celebration.querySelector('span'),confetti=celebration.querySelector('.mission-confetti');
 function celebrate(title,gain){
  if(!gain)return;
  heading.textContent='Missione completata';
  details.textContent=`${title} · +${formatCP(gain.cp)} · +${gain.rp} RP`;
  celebration.hidden=false;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
   const colors=['#ffc467','#f0758a','#8de6ba','#9bc3ff'];
   const pieces=Array.from({length:24},(_,i)=>{
    const piece=document.createElement('i');
    piece.style.setProperty('--color',colors[i%colors.length]);
    piece.style.setProperty('--x',`${(i-11.5)*3.1}vw`);
    piece.style.setProperty('--delay',`${(i%6)*35}ms`);
    piece.style.setProperty('--spin',`${(i%2?1:-1)*(360+i*24)}deg`);
    return piece;
   });
   confetti.replaceChildren(...pieces);
  }
  clearTimeout(bannerTimer);
  bannerTimer=setTimeout(()=>{celebration.hidden=true;confetti.replaceChildren();},4200);
 }
 return {...progress,celebrate,get expanded(){return dialog.open;},close,set onNavigate(callback){onNavigate=callback;},set onToggle(callback){onToggle=callback;}};
}
