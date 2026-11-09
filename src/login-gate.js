import {addHomeScreenHint} from './app-mode.js';
import {supabase} from './supabase.js';
export let signedInUser=null;
const profileFields=`<label>Personaggio<select name="avatar" required>
 <option value="">Scegli…</option><option value="male">Iucc</option><option value="female">Vtella</option>
 </select></label>
 <fieldset class="age-choice"><legend>Hai almeno 18 anni?</legend>
 <label><input type="radio" name="adult" value="yes" required> Sì</label>
 <label><input type="radio" name="adult" value="no"> No</label></fieldset>`;
export async function requireGameLogin(){
 if(supabase){try{const {data,error}=await supabase.auth.getSession();if(!error&&data.session?.user){signedInUser=data.session.user;return completeProfile(signedInUser);}}catch{}}
 const screen=document.createElement('section');screen.id='login-gate';screen.setAttribute('aria-label','Accesso a GTA Ctatella');screen.innerHTML='<div class="login-card"><p class="login-eyebrow">SAN GREGORIO MAGNO</p><h1>GTA CTATELLA</h1><p>Un solo giocatore, tutte le missioni del paese.</p><form><label class="login-name" hidden>Nickname univoco<input name="username" autocomplete="nickname" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}"><small>3–24 lettere, numeri o underscore.</small></label><fieldset class="login-profile" hidden disabled><legend>Profilo di gioco</legend>' + profileFields + '</fieldset><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><button class="login-submit" type="submit">Accedi e gioca</button></form><button class="login-mode" type="button">Non hai un account? Registrati</button><p class="login-status" role="status"></p></div>';document.body.append(screen);
 addHomeScreenHint(screen.querySelector('.login-card'));
 const form=screen.querySelector('form'),message=screen.querySelector('.login-status'),submit=screen.querySelector('.login-submit');let signup=false,busy=false;
 screen.querySelector('.login-mode').onclick=()=>{signup=!signup;screen.querySelector('.login-name').hidden=!signup;const profile=screen.querySelector('.login-profile');profile.hidden=profile.disabled=!signup;form.elements.username.required=signup;form.elements.password.autocomplete=signup?'new-password':'current-password';submit.textContent=signup?'Crea account':'Accedi e gioca';screen.querySelector('.login-mode').textContent=signup?'Hai già un account? Accedi':'Non hai un account? Registrati';message.textContent='';};
 if(!supabase){message.textContent='Accesso non configurato. Riprova quando il servizio sarà disponibile.';submit.disabled=true;}
 await new Promise(resolve=>{form.onsubmit=async e=>{e.preventDefault();if(busy||!supabase||!form.reportValidity())return;busy=true;submit.disabled=true;message.textContent='Accesso in corso…';try{const email=form.elements.email.value.trim(),password=form.elements.password.value,username=form.elements.username.value.trim();if(signup){const {data:names,error}=await supabase.from('player_profiles').select('username').ilike('username',username).limit(1);if(!error&&names.length)throw Error('Nickname già utilizzato. Scegline un altro.');}
 const {data,error}=signup?await supabase.auth.signUp({email,password,options:{data:{username,avatar:form.elements.avatar.value,adult:form.elements.adult.value==='yes'}}}):await supabase.auth.signInWithPassword({email,password});if(error)throw error;if(!data.session){message.textContent='Controlla la tua email per confermare l’account, poi accedi.';return;}signedInUser=data.session.user;resolve();}catch(error){message.textContent=error.message||'Accesso non riuscito. Riprova.';}finally{busy=false;submit.disabled=false;}};});screen.remove();return completeProfile(signedInUser);
}

async function completeProfile(user){
 const meta=user.user_metadata||{};
 if(typeof meta.adult==='boolean'&&['male','female'].includes(meta.avatar))return user;
 const screen=document.createElement('section');screen.id='login-gate';screen.setAttribute('aria-label','Profilo di gioco');
 screen.innerHTML='<div class="login-card"><p class="login-eyebrow">GTA CTATELLA</p><h1>Profilo</h1><form>' + profileFields + '<button class="login-submit">Entra in paese</button><p role="status"></p></form></div>';
 document.body.append(screen);
 const form=screen.querySelector('form'),submit=form.querySelector('button');
 form.elements.avatar.value=meta.avatar||'';form.elements.adult.value=typeof meta.adult==='boolean'?(meta.adult?'yes':'no'):'';
 return new Promise(resolve=>{
  form.onsubmit=async event=>{
   event.preventDefault();if(submit.disabled||!form.reportValidity())return;submit.disabled=true;
   try{
    const {data,error}=await supabase.auth.updateUser({data:{avatar:form.elements.avatar.value,adult:form.elements.adult.value==='yes'}});
    if(error)throw error;
    signedInUser=data.user;screen.remove();resolve(signedInUser);
   }catch{form.querySelector('[role="status"]').textContent='Profilo non salvato. Riprova.';}
   finally{submit.disabled=false;}
  };
 });
}
