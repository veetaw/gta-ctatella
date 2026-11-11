import {supabase} from './supabase.js';
import {normalizeAppearance,profileAppearance} from './avatar-appearance.js';
const storageKey=user=>'ctatella-appearance-v1:'+user?.id;
export function readAvatarProfile(user){
 const remote=user?.user_metadata?.avatarAppearance;
 let local;try{local=JSON.parse(localStorage.getItem(storageKey(user))||'null');}catch{}
 const saved=local&&Number(local.updatedAt)>Number(remote?.updatedAt||0)?local:remote;
 return normalizeAppearance(saved?.appearance??profileAppearance(user));
}
const saves=new Map();
export async function saveAvatarProfile(user,value){
 const record={appearance:normalizeAppearance(value),updatedAt:Date.now()};
 try{localStorage.setItem(storageKey(user),JSON.stringify(record));}catch{}
 if(!supabase||!user?.id||user.id.startsWith('visual-preview-'))return {cloud:false};
 const previous=saves.get(user.id)||Promise.resolve();
 const save=previous.catch(()=>{}).then(async()=>{
  const {data,error}=await supabase.auth.updateUser({data:{avatar:record.appearance.variant,avatarAppearance:record}});
  if(error)throw Error('Aspetto salvato su questo dispositivo; sincronizzazione del profilo non riuscita. Riprova.');
  Object.assign(user.user_metadata,data.user.user_metadata);return {cloud:true};
 });
 saves.set(user.id,save);try{return await save;}finally{if(saves.get(user.id)===save)saves.delete(user.id);}
}
