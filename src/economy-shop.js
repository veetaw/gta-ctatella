import {SHOP,formatCP} from './economy.js';

export function makeEconomyShop({actions,progress,buy,near,adult,onToggle,toast}){
 const button=document.createElement('button'),dialog=document.createElement('dialog');
 button.type='button';button.textContent='Piazzale · Veicoli e acquisti';button.hidden=true;
 dialog.className='pause-screen economy-shop';
 dialog.innerHTML='<header class="pause-header"><h1>Piazzale dell’eliporto</h1><button type="button" class="pause-close" aria-label="Chiudi">×</button></header><p></p><ol class="pause-scores"></ol>';
 document.body.append(dialog);actions.append(button);
 const rows=Object.entries(SHOP).filter(([id])=>adult||!['shotgun','smg'].includes(id)).map(([id,item])=>{
  const row=document.createElement('li'),name=document.createElement('strong'),purchase=document.createElement('button');
  name.textContent=item.name;purchase.type='button';row.append(name,purchase);dialog.querySelector('ol').append(row);
  purchase.onclick=()=>{if(buy(id)){toast(`${item.name} acquistato`);render();}};
  return {id,item,purchase};
 });
 function render(){
  const {economy,level}=progress();
  dialog.querySelector('p').textContent=`${formatCP(economy.cp)} · LV ${level}`;
  for(const {id,item,purchase} of rows){
   const owned=economy.owned[id];
   purchase.textContent=owned?'Acquistato':`${formatCP(item.price)} · LV ${item.level}`;
   purchase.disabled=owned||economy.cp<item.price||level<item.level;
  }
 }
 function interact(){if(!near()||dialog.open)return false;render();dialog.showModal();onToggle(true);return true;}
 button.onclick=interact;dialog.querySelector('.pause-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>onToggle(false));
 return {interact,update(){button.hidden=!near();},close(){dialog.close();},get open(){return dialog.open;}};
}
