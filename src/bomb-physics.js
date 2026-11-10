// Fixed pools: no accumulating projectiles, particles, textures or timers.
export function createBombSimulation(surfaceAt){
 const bombs=Array.from({length:8},()=>({active:false,x:0,y:0,z:0,vx:0,vy:0,vz:0}));
 const bursts=Array.from({length:8},()=>({active:false,x:0,y:0,z:0,age:0}));
 let cooldown=0,dropped=0,explosions=0;
 function burst(point,scale){
  const effect=bursts.find(e=>!e.active)||bursts.reduce((a,b)=>a.age>b.age?a:b);
  Object.assign(effect,{...point,active:true,age:0,scale});
  explosions++;
 }
 return {
  bombs,bursts,
  drop(h){
   if(cooldown>0||h.altitude<4)return false;
   const bomb=bombs.find(b=>!b.active);
   if(!bomb)return false;
   Object.assign(bomb,{active:true,x:h.x,y:h.y-.6,z:h.z,vx:Math.sin(h.yaw)*h.speed,vy:-1,vz:Math.cos(h.yaw)*h.speed,shell:false});
   cooldown=.65;dropped++;return true;
  },
  launch(origin,direction,trace,onImpact){
   const shell=bombs.find(b=>!b.active);
   if(!shell)return false;
   Object.assign(shell,{x:origin.x,y:origin.y,z:origin.z,active:true,shell:true,life:1.5,
    vx:direction.x*55,vy:direction.y*55,vz:direction.z*55,trace,onImpact});
   return true;
  },
  update(dt){
   cooldown=Math.max(0,cooldown-dt);
   for(const e of bursts)if(e.active){e.age+=dt;if(e.age>=2)e.active=false;}
   for(const b of bombs)if(b.active){
    b.vy-=9.81*dt;
    const next={x:b.x+b.vx*dt,y:b.y+b.vy*dt,z:b.z+b.vz*dt};
    if(b.shell){
     b.life-=dt;
     const hit=b.trace(b,next);
     if(hit<1||b.life<=0){
      const point={x:b.x+(next.x-b.x)*hit,y:b.y+(next.y-b.y)*hit,z:b.z+(next.z-b.z)*hit};
      b.active=false;burst(point,1.65);b.onImpact(point);b.trace=b.onImpact=null;
     }else Object.assign(b,next);
    }else{
     Object.assign(b,next);
     const ground=surfaceAt(b.x,b.z);
     if(b.y<=ground+.12){b.active=false;burst({x:b.x,y:ground+.18,z:b.z},1);}
    }
   }
  },
  reset(){for(const b of bombs){b.active=false;b.trace=b.onImpact=null;}for(const e of bursts)e.active=false;cooldown=0;},
  stats:()=>({dropped,explosions,activeBombs:bombs.filter(b=>b.active).length,activeBursts:bursts.filter(b=>b.active).length})
 };
}
