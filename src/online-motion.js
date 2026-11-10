const BUFFER_MS=75;
const MAX_PREDICTION_MS=55;

export function rememberVehicle(samples,pose,at){
 if(!samples.length||samples.at(-1).pose[0]!==pose[0])samples.length=0;
 if(samples.at(-1)?.pose.every((value,i)=>value===pose[i]))return;
 samples.push({pose,at});
 if(samples.length>6)samples.shift();
}

export function sampleVehicle(samples,now){
 if(!samples?.length)return null;
 const time=now-BUFFER_MS;
 const next=samples.findIndex(sample=>sample.at>=time);
 if(next===0)return samples[0].pose;
 if(next>0){
  const a=samples[next-1],b=samples[next],t=(time-a.at)/(b.at-a.at||1);
  const angle=b.pose[4]-a.pose[4];
  const yaw=a.pose[4]+Math.atan2(Math.sin(angle),Math.cos(angle))*t;
  return [b.pose[0],...[1,2,3].map(i=>a.pose[i]+(b.pose[i]-a.pose[i])*t),
   yaw,a.pose[5]+(b.pose[5]-a.pose[5])*t];
 }
 const {pose,at}=samples.at(-1);
 const [kind,x,y,z,yaw,speed]=pose;
 const distance=speed*Math.min(MAX_PREDICTION_MS,time-at)/1000;
 return [kind,x+Math.sin(yaw)*distance,y,z+Math.cos(yaw)*distance,yaw,speed];
}
