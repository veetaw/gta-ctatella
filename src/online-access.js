import {economyFor,levelFor} from './economy.js';

export const ONLINE_MIN_LEVEL=5;

export function offlineLevel(user,profile){
 const progress=user?.user_metadata?.gta_progress_v2??{};
 const savedRP=Number(economyFor(progress).rp)||0;
 const profileRP=Number(profile?.rp)||0;
 const legacyRP=Number(economyFor(profile??{}).rp)||0;
 return levelFor(Math.max(0,savedRP,profileRP,legacyRP));
}
