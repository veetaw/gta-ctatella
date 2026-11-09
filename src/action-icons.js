import {actionIcon,setIcon as icon} from './ui-icons.js';
export function installActionIcons(combat=true){
 icon(document.querySelector('[data-hold="shift"]'),'sprint','Sprint');icon(document.querySelector('[data-action="jump"]'),'jump','Salta');
 const group=document.querySelector('.foot-actions'),placeholder=group.querySelector('button[disabled]');placeholder?.remove();
 if(!combat){document.body.classList.add('combat-unavailable');return;}
 const fire=document.createElement('button');fire.dataset.hold='fire';fire.className='combat-fire';icon(fire,'fire','Spara (F / mouse)');
 const reload=document.createElement('button');reload.dataset.action='reload';reload.className='combat-reload';icon(reload,'reload','Ricarica (R)');group.append(fire,reload);
 const ammo=document.createElement('output');ammo.className='combat-ammo';ammo.setAttribute('aria-label','Munizioni');group.append(ammo);
 return {fire,reload,ammo,update(clip,reserve,reloading,available,capacity=12){fire.disabled=!available||reloading>0;reload.disabled=!available||reloading>0||clip>=capacity||reserve<=0;ammo.textContent=reloading>0?`↻ ${reloading.toFixed(1)}s · ${clip} / ${reserve}`:`${clip} / ${reserve}`;document.body.classList.toggle('combat-unavailable',!available);}};
}
export function boardingIcon(button,onFoot){const name=onFoot?'board':'exit';if(button.dataset.icon!==name){button.innerHTML=actionIcon(name);button.dataset.icon=name;}}

export function installWeaponSelector(choose,owned){
 const trigger=document.createElement('button'),panel=document.createElement('div'),wheel=document.createElement('div');
 const hub=document.createElement('div'),caption=document.createElement('strong');
 trigger.type='button';trigger.className='weapon-trigger';panel.id='weapon-options';panel.hidden=true;
 trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','false');
 wheel.className='weapon-wheel';wheel.setAttribute('role','group');wheel.setAttribute('aria-label','Armi');
 hub.className='weapon-hub';hub.innerHTML='<span>ARMI</span>';hub.append(caption);
 const options=[['hands','hand','Mani vuote'],['pistol','pistol','Pistola'],['shotgun','pistol','Doppietta'],['smg','pistol','Mitra']];
 const choices=options.map(([id,name,label])=>{
  const button=document.createElement('button');button.type='button';button.className='weapon-sector';
  button.innerHTML=actionIcon(name)+'<span>'+label+'</span>';
  button.onfocus=button.onpointerenter=()=>{caption.textContent=label;};
  button.onclick=()=>{close(true);choose(id);};
  wheel.append(button);return button;
 });
 wheel.append(hub);panel.append(wheel);
 function close(focus=false){
  if(panel.hidden)return;
  panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();
 }
 function toggle(){
  if(trigger.hidden)return;
  if(!panel.hidden){close(true);return;}
  panel.hidden=false;trigger.setAttribute('aria-expanded','true');
  choices.find(button=>button.getAttribute('aria-pressed')==='true')?.focus();
 }
 trigger.onclick=toggle;
 panel.onclick=event=>{if(event.target===panel)close(true);};
 panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
   event.preventDefault();event.stopPropagation();
   const visible=choices.filter(button=>!button.disabled),index=visible.indexOf(document.activeElement);
   visible[(index+visible.length+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1))%visible.length]?.focus();
  }
 });
 document.querySelector('.foot-actions').insertBefore(trigger,document.querySelector('.combat-fire'));
 document.body.append(panel);
 return {toggle,close,get open(){return !panel.hidden;},update(equipped,available){
  trigger.hidden=!available;if(!available)close();
  choices.forEach((button,i)=>{button.disabled=i>1&&!owned(options[i][0]);});
  if(trigger.dataset.equipped!==String(equipped)){
   trigger.dataset.equipped=String(equipped);icon(trigger,'weapons','Armi (X) · '+options.find(([id])=>id===equipped)?.[2]);
   choices.forEach((button,i)=>button.setAttribute('aria-pressed',String(options[i][0]===equipped)));
  }
 }};
}
