import {economyFor,levelFor,rewardMission,SHOP} from './economy.js';
import {createClient} from '@supabase/supabase-js';
import {EMPTY_PROGRESS,mergeProgress,totalCountryPoints,accountStorageKey} from './progress-record.js';
import {abballaRecord} from './abballa-record.js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase=url&&key?createClient(url,key,{global:{fetch:(url,options={})=>fetch(url,{...options,keepalive:typeof document!=='undefined'&&document.visibilityState==='hidden',signal:options.signal||AbortSignal.timeout(10000)})}}):null;
const PROFILE_FIELDS=Object.keys(EMPTY_PROGRESS).filter(k=>!k.startsWith('raid_')&&!k.startsWith('farm_')&&k!=='piloted'&&k!=='economy'),CLOUD_KEY='gta_progress_v2';
let currentProgress=null;
export function saveGameProgress(patch={}){return currentProgress?.saveGameProgress(patch)||Promise.resolve(false);}
function read(key){try{return JSON.parse(localStorage.getItem(key))||{};}catch{return {};}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{console.warn('Salvataggio locale non disponibile');}}
export function createProgress(onChange,{user:initialUser=null,sandbox=false}={}){
 let user=initialUser,local={...EMPTY_PROGRESS},remote=null,channel=null,pending=false,syncTask=null,timer=null,revision=0,disposed=false;
 const storageKey=id=>accountStorageKey(id)+(sandbox?'-sandbox':'');
 const backend=sandbox?null:supabase;
 const unlockedItems=sandbox?Object.fromEntries(Object.keys(SHOP).map(id=>[id,true])):null;
 function persist(){if(user)write(storageKey(user.id),local);}
 function switchLocal(next){user=next;remote=null;local=mergeProgress(user?read(storageKey(user.id)):{},(sandbox?null:user?.user_metadata?.[CLOUD_KEY])||{});if(!sandbox&&user&&!read('sgm-legacy-migrated-to').userId){local=mergeProgress(local,read('sgm-mazzuoccolo-progress'));write('sgm-legacy-migrated-to',{userId:user.id});}persist();revision++;}
 switchLocal(initialUser);
 const state=()=>{const saved=economyFor(local),economy=sandbox?{...saved,owned:unlockedItems}:saved;return {economy,level:levelFor(economy.rp),user,username:remote?.username||user?.user_metadata?.username||'Giocatore',configured:!!backend,processionDone:!!local.procession_done,processionMeters:local.procession_meters,unlocked:!!local.unlocked_heli,piloted:!!local.piloted,turneiaCompleted:!!local.turneia_completed,turneiaBest:local.turneia_points,abballaCompleted:!!local.abballa_completed,abballaBest:local.abballa_points,raidCompleted:local.raid_completed,raidWave:local.raid_wave,raidBest:local.raid_points,pending,local,remote};};
 const emit=()=>{if(!disposed)onChange(state());};
 function schedule(delay=5000){clearTimeout(timer);timer=setTimeout(()=>void sync(),delay);}
 async function sync(){
  if(disposed||!backend||!user)return false;if(syncTask)return syncTask;
  const owner=user.id,version=revision,snapshot={...local};pending=true;
  syncTask=(async()=>{try{
   const row={user_id:owner,username:remote?.username||user.user_metadata?.username||`Gregorese_${owner.slice(0,8)}`,...Object.fromEntries(PROFILE_FIELDS.map(k=>[k,snapshot[k]])),updated_at:new Date().toISOString()};
   // Existing public score tables remain compatible. Full progress, including
   // resumable raid checkpoints, lives in the authenticated user's metadata.
   const upsert=async()=>{
    const write=fields=>backend.from('player_profiles').upsert(fields,{onConflict:'user_id'}).select().single();
    const result=await write({...row,rp:economyFor(snapshot).rp});
    return ['PGRST204','42703'].includes(result.error?.code)?write(row):result;
   };
   const [profileResult,authResult]=await Promise.allSettled([upsert(),backend.auth.updateUser({data:{...user.user_metadata,[CLOUD_KEY]:snapshot}})]);
   if(user?.id!==owner)return false;
   let profileOK=false,authOK=false;
   if(profileResult.status==='fulfilled'&&!profileResult.value.error){remote=profileResult.value.data;local=mergeProgress(local,remote);profileOK=true;}
   if(authResult.status==='fulfilled'&&!authResult.value.error){user=authResult.value.data.user;authOK=true;}
   pending=!(profileOK&&authOK)||version!==revision;persist();emit();return profileOK&&authOK;
  }catch(error){if(user?.id===owner){pending=true;persist();emit();}console.warn('Progressi locali conservati',error.message);return false;}
  finally{syncTask=null;if(!disposed&&user?.id===owner&&revision!==version)schedule(1000);}})();return syncTask;
 }
 async function load(){
  if(!backend||!user)return;const owner=user.id;
  try{const [profileResult,authResult]=await Promise.allSettled([backend.from('player_profiles').select('*').eq('user_id',owner).maybeSingle(),backend.auth.getUser()]);if(user?.id!==owner)return;
   if(profileResult.status==='fulfilled'&&!profileResult.value.error){remote=profileResult.value.data;local=mergeProgress(local,remote||{});}
   if(authResult.status==='fulfilled'&&!authResult.value.error&&authResult.value.data.user?.id===owner){user=authResult.value.data.user;local=mergeProgress(local,user.user_metadata?.[CLOUD_KEY]||{});}
   if(!local.economy){const economy=economyFor(local);economy.updatedAt=Date.now();economy.farm.eggAt=economy.updatedAt;local={...local,economy};}
   revision++;persist();emit();await sync();
  }catch(error){pending=true;persist();emit();console.warn('Profilo online non disponibile',error.message);}
 }
 function save(patch={},immediate=true){local=mergeProgress(local,patch);revision++;pending=!!backend;persist();emit();if(immediate){clearTimeout(timer);return sync();}schedule();return Promise.resolve(false);}
 function transact(change,patch={}){
  const current=economyFor(local),next={...current,owned:{...current.owned},claimed:{...current.claimed},farm:{...current.farm}};
  const result=change(next);
  if(result===false)return false;
  next.updatedAt=Math.max(Date.now(),current.updatedAt+1);
  void save({...patch,economy:next},false);return result??true;
 }
 async function leaderboard(game='rp'){
  if(game==='rp'){
   if(backend)try{
    const {data,error}=await backend.from('player_profiles').select('username,rp').order('rp',{ascending:false}).limit(20);
    if(error)throw error;
    return {rows:data,scope:'globale'};
   }catch{}
   return {rows:user?[{username:state().username,rp:economyFor(local).rp}]:[],scope:'locale'};
  }
  const orders={total:['total_points'],procession:['procession_meters'],mazzuoccolo:['throws_count','best_distance_m'],turneia:['turneia_points'],abballa:['abballa_points','abballa_max_combo']};
  if(backend)try{let query=backend.from('player_profiles').select('username,total_points,procession_meters,throws_count,best_distance_m,turneia_points,abballa_points,abballa_max_combo');if(game==='mazzuoccolo')query=query.not('throws_count','is',null);for(const k of orders[game]||orders.total)query=query.order(k,{ascending:k==='throws_count',nullsFirst:false});const {data,error}=await query.limit(20);if(error)throw error;return {rows:data,scope:'globale'};}catch{}
  return {rows:user?[{...local,username:state().username,total_points:totalCountryPoints(local)}]:[],scope:'locale'};
 }
 const ready=load();
 const {data:authSubscription}=backend?.auth.onAuthStateChange((_event,session)=>{if(session?.user?.id!==user?.id){clearTimeout(timer);switchLocal(session?.user||null);emit();if(user)setTimeout(()=>void load(),0);}else if(session?.user)user=session.user;})||{data:null};
 const flush=()=>{persist();if(pending)void sync();},visibility=()=>{if(document.hidden)flush();};
 if(typeof window!=='undefined'){window.addEventListener('online',flush);window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',visibility);}
 const autoSave=setInterval(()=>{if(pending)void sync();},15000);
 const api={state,ready,leaderboard,transact,
  saveGameProgress(patch={},gain){
   if(gain)return transact(e=>{e.cp+=gain.cp;e.rp+=gain.rp;},patch);
   return save(patch,false);
  },
  buy(id){
   const item=SHOP[id];if(!item||sandbox)return false;
   return transact(e=>{
    if(e.owned[id]||e.cp<item.price||levelFor(e.rp)<item.level)return false;
    e.cp-=item.price;e.owned[id]=true;
   },id==='ferrari'?{unlocked_ferrari:true}:id==='helicopter'?{unlocked_heli:true}:{});
  },
  penalty(){return transact(e=>{const lost=Math.round(e.cp*.2);e.cp-=lost;return lost;});},
  addProcessionMeters(meters){
   if(!Number.isFinite(meters)||meters<=0)return false;
   const before=local.procession_meters,after=before+meters;
   return transact(e=>{
    e.cp+=Math.floor(after*100+1e-6)-Math.floor(before*100+1e-6);
    e.rp+=Math.floor(after*5+1e-6)-Math.floor(before*5+1e-6);
   },{procession_meters:after});
  },
  complete(throws,distance){if(sandbox||local.procession_done)return transact(e=>rewardMission(e,'mazzuoccolo'),{throws_count:throws,best_distance_m:distance});},
  completeTurneia(points){if(sandbox||local.procession_done)return transact(e=>rewardMission(e,'turneia'),{turneia_completed:true,turneia_points:Math.floor(points)});},
  completeRaid(points){return transact(e=>rewardMission(e,'raid'),{raid_completed:true,raid_wave:3,raid_points:Math.floor(points)});},
  async completeAbballa(record){
   if(!sandbox&&!local.procession_done)return {cp:0,rp:0};
   const r=abballaRecord(record);
   return transact(e=>rewardMission(e,'abballa'),{abballa_completed:true,abballa_points:r.points,abballa_max_combo:r.max_combo});
  },
  piloted(){return save({piloted:true},false);},
  subscribe(callback){if(backend)channel=backend.channel('game-profiles').on('postgres_changes',{event:'*',schema:'public',table:'player_profiles'},callback).subscribe();},
  dispose(){disposed=true;clearTimeout(timer);clearInterval(autoSave);if(channel)backend.removeChannel(channel);authSubscription?.subscription.unsubscribe();window.removeEventListener('online',flush);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);if(currentProgress===api)currentProgress=null;}
 };
 currentProgress=api;return api;
}
