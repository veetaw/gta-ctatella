import {inBuilding,nearest} from './world-math.js';
export const CELLAR_RULE={maxArea:80,maxHeight:4.2,corridorDistance:8};
export function eligibleCellar(b){const h=b.originalHeight??b.height,floors=b.originalFloors;return b.area>0&&b.area<CELLAR_RULE.maxArea&&(floors===1||Number.isFinite(h)&&h<CELLAR_RULE.maxHeight)&&!b.church&&(!b.classification||b.classification==='residential'||b.classification==='historic-cellar');}
export const cellarPartKey=(sourceId,bounds)=>`${sourceId}:${bounds.map(n=>n.toFixed(2)).join(',')}`;
export function cellarContext(b,context){
 const points=b.rings[0],center=[(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2];
 if(context.exclusions.some(p=>inBuilding(center,p)))return null;
 const core=context.perimeters.find(p=>points.slice(0,-1).every(q=>inBuilding(q,p)));if(core)return {kind:'inferred-historic-fabric',source:core.id,distance:0};
 let best=null;
 for(const p of context.corridors){if(b.bounds[0]>p.bounds[2]+8||b.bounds[2]<p.bounds[0]-8||b.bounds[1]>p.bounds[3]+8||b.bounds[3]<p.bounds[1]-8)continue;let d=Infinity;if(p.rings){if(points.some(q=>inBuilding(q,p))||p.rings[0].some(q=>inBuilding(q,b)))d=0;for(const r of p.rings)for(let i=1;i<r.length;i++)for(const q of points)d=Math.min(d,nearest(q,r[i-1],r[i]).d);for(const r of b.rings)for(let i=1;i<r.length;i++)for(const q of p.rings[0])d=Math.min(d,nearest(q,r[i-1],r[i]).d);}else for(let i=1;i<p.points.length;i++)for(const q of points)d=Math.min(d,nearest(q,p.points[i-1],p.points[i]).d);
 if(d<=CELLAR_RULE.corridorDistance&&(!best||d<best.distance))best={kind:'surveyed-pedestrian-corridor',source:p.id,distance:Math.round(d*1000)/1000};}
 return best;
}
export const BACCO_CELLAR_RULE={maxOriginalHeight:3.5,directDistance:35,historicVicinityDistance:65,maxRoofRise:.55};
export function baccoCellarEvidence(b,context){
 const h=b.originalHeight??b.height;if(b.originalFloors>1||!Number.isFinite(h)||h>BACCO_CELLAR_RULE.maxOriginalHeight||b.church||!['residential','historic-cellar'].includes(b.classification||'residential'))return null;
 const center=[(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2];if(context.exclusions.some(p=>inBuilding(center,p)))return null;
 let distance=Infinity,source=null;for(const road of context.historicCellarRoads||context.baccoRoads||[])for(let i=1;i<road.points.length;i++)for(const p of b.rings[0]){const d=nearest(p,road.points[i-1],road.points[i]).d;if(d<distance){distance=d;source=road.id;}}
 const historic=cellarContext(b,context);return distance<=BACCO_CELLAR_RULE.directDistance||distance<=BACCO_CELLAR_RULE.historicVicinityDistance&&historic?{kind:'via-bacco-low-historic-cellar',source,distance:Math.round(distance*1000)/1000}:null;
}
export function classifyBaccoCellar(b,context){const evidence=baccoCellarEvidence(b,context);if(!evidence)return false;b.classification='historic-cellar';b.classificationLabel='Cantina Storica in Pietra';b.height=2.75;b.roofY=b.maxGroundY+b.height;b.cellar={...b.cellar,evidence,typology:'via-bacco',wallMaterial:'rough-apennine-limestone',door:'segmental-squared-stone-arch',doorLeaf:Math.round(b.area)%3===0?'dark-iron':'solid-dark-wood',roof:'low-gable',roofRise:.4,hasPlaster:false,hasShutters:false,windows:1,window:'small-high-iron-grille',wallLantern:'wrought-iron-bracket',balconies:0};return true;}
export function classifyCellar(b,context){if(!eligibleCellar(b))return false;const evidence=cellarContext(b,context);if(!evidence)return false;b.classification='historic-cellar';b.classificationLabel='Cantina / Rimessa Storica in Pietra';b.cellar={evidence,wallMaterial:'exposed-local-limestone',door:'arched-solid-dark-wood',roof:'steep-mono-or-gable',hasPlaster:false,hasShutters:false,windows:0,balconies:0};return true;}
