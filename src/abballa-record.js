export function abballaRecord(value){return {points:Math.max(0,Math.min(2147483647,Math.floor(Number(value?.points)||0))),max_combo:Math.max(0,Math.min(10000,Math.floor(Number(value?.max_combo)||0)))};}
export function betterAbballa(a,b){if(!a)return b;if(!b)return a;return b.points>a.points||b.points===a.points&&b.max_combo>a.max_combo?b:a;}
