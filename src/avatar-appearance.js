// Shared by renderer, profile persistence and online server. No Three.js dependency.
export const AVATAR_DEFAULTS={quality:'original',variant:'male',shirt:'#7d2948',trousers:'#292d35',hair:'#302722',skin:'#ed9875'};
export function normalizeAppearance(value={}){
 if(!value||typeof value!=='object')value={};
 const result={...AVATAR_DEFAULTS};
 if(['original','hq'].includes(value.quality))result.quality=value.quality;
 if(['male','female'].includes(value.variant))result.variant=value.variant;
 for(const key of ['shirt','trousers','hair','skin'])if(typeof value[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))result[key]=value[key].toLowerCase();
 return result;
}
export function appearanceSignature(value){return JSON.stringify(normalizeAppearance(value));}
export function profileAppearance(user){return normalizeAppearance({variant:user?.user_metadata?.avatar,...user?.user_metadata?.avatarAppearance?.appearance});}
