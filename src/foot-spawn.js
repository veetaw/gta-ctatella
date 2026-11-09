export function findFootSpawn(home,clear,fallback=home){
 if(clear(home.x,home.z,.35))return {...home};
 for(let r=1;r<=10;r++)for(let a=0;a<Math.PI*2;a+=Math.PI/6){const x=home.x+Math.cos(a)*r,z=home.z+Math.sin(a)*r;if(clear(x,z,.35))return {...home,x,z};}
 return {...fallback};
}
