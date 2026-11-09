export const REWARDS={
 mazzuoccolo:[650_000,590],turneia:[100_000,360],abballa:[25_000,130],
 wine:[20_000,120],pigs:[1_000,75],raid:[15_000,140],
};
export const SHOP={
 panda:{name:'Panda 4×4',price:1_000,level:1},
 motocross:{name:'Moto da cross',price:8_000,level:2},
 ape:{name:'Ape',price:12_000,level:2},
 offroad:{name:'Fuoristrada',price:65_000,level:4},
 ferrari:{name:'Ferrari',price:150_000,level:6},
 helicopter:{name:'Elicottero',price:1_000_000,level:10},
 shotgun:{name:'Doppietta',price:35_000,level:3},
 smg:{name:'Mitra',price:90_000,level:5},
};
export const levelFor=rp=>1+Math.floor(rp/100);
export const formatCP=cp=>cp.toLocaleString('it-IT')+' CP';

export function economyFor(progress){
 if(progress.economy)return progress.economy;
 const economy={cp:100,rp:0,owned:{},claimed:{},farm:{hens:3},updatedAt:0};
 if(progress.unlocked_ferrari||progress.turneia_completed)economy.owned.ferrari=true;
 if(progress.unlocked_heli)economy.owned.helicopter=true;
 for(const [key,complete] of Object.entries({
  mazzuoccolo:progress.throws_count,turneia:progress.turneia_completed,
  abballa:progress.abballa_completed,wine:progress.farm_wine?.completed,pigs:progress.farm_pigs?.completed,
  raid:progress.raid_completed,
 }))if(complete)rewardMission(economy,key);
 economy.cp+=Math.floor(Math.min(15,progress.procession_meters||0)*100);
 economy.rp+=Math.floor(Math.min(15,progress.procession_meters||0)*5);
 return economy;
}
export function rewardMission(economy,key){
 const [base,experience]=REWARDS[key],first=!economy.claimed[key];
 const repeat=key==='wine'||key==='pigs'||key==='raid'?1:.1;
 const cp=first?base:Math.round(base*repeat),rp=first?experience:Math.ceil(experience/5);
 economy.cp+=cp;economy.rp+=rp;economy.claimed[key]=true;
 return {cp,rp};
}
