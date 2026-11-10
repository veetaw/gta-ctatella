const SPEED=4;
const COUNT=2;
const UPDATE_MS=100;

export function createRoomTraffic({roads=[],height,send,spawn}){
 const paths=roads.flatMap(road=>{
  if(!road.points||/scal[ei]|gradini|sentiero|pedonale/i.test(road.name||''))return [];
  const points=[];
  let length=0;
  for(const [x,z] of road.points){
   const last=points.at(-1);
   if(last)length+=Math.hypot(x-last.x,z-last.z);
   if(!last||length>last.s)points.push({x,z,s:length});
  }
  if(length<35)return [];
  const middle=points[Math.floor(points.length/2)];
  return [{points,length,distance:spawn?Math.hypot(middle.x-spawn.x,middle.z-spawn.z):0}];
 }).sort((a,b)=>a.distance-b.distance).slice(0,COUNT);
 const enabled=paths.length>0;
 function makeCars(){
  return paths.map((path,index)=>({path,kind:index?'rambo':'punto',meters:path.length*(index?.55:.25),direction:index?-1:1,respawn:0,pose:null}));
 }
 function position(car,meters,speed){
  const {points}=car.path;
  let i=1;
  while(i<points.length-1&&points[i].s<meters)i++;
  const a=points[i-1],b=points[i],t=(meters-a.s)/(b.s-a.s);
  const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
  const yaw=Math.atan2((b.x-a.x)*car.direction,(b.z-a.z)*car.direction);
  return [car.kind,x,height(x,z),z,yaw,speed];
 }
 function publish(room,recipient){
  if(!enabled||!room.traffic)return;
  const vehicles=room.traffic.cars.map(car=>car.pose?.map(value=>typeof value==='number'?Math.round(value*100)/100:value)??null);
  if(!recipient){
   const signature=JSON.stringify(vehicles);
   if(room.traffic.signature===signature)return;
   room.traffic.signature=signature;
  }
  const message={type:'traffic',vehicles};
  for(const player of recipient?[recipient]:room.players.values())if(player.trafficEnabled&&player.ws.bufferedAmount<1024)send(player,message);
 }
 function update(room,now){
  if(!enabled)return;
  room.traffic??={cars:makeCars(),at:now-UPDATE_MS};
  const {cars,at}=room.traffic;
  if(now-at<UPDATE_MS)return;
  room.traffic.at=now;
  const dt=Math.min(.25,(now-at)/1000);
  const people=[...room.players.values()].filter(player=>player.pose&&!player.driver);
  for(const car of cars){
   if(car.claimedId){
    if(room.parked?.has(car.claimedId)||people.some(player=>player.vehicleId===car.claimedId))continue;
    car.claimedId=null;car.respawn=now+20000;
   }
   if(now<car.respawn)continue;
   const next=Math.max(0,Math.min(car.path.length,car.meters+car.direction*SPEED*dt));
   const pose=position(car,next,SPEED);
   const blocked=people.some(({pose:p})=>Math.hypot(pose[1]-p[1],pose[3]-p[3])<4);
   if(blocked){car.pose=position(car,car.meters,0);continue;}
   car.meters=next;car.pose=pose;
   if(next===0||next===car.path.length)car.direction*=-1;
  }
  publish(room);
 }
 function take(room,id,now,claim){
  const car=room.traffic?.cars[id];
  if(!car?.pose)return;
  const claimedId=claim(car.pose);
  if(!claimedId)return;
  car.pose=null;car.claimedId=claimedId;car.respawn=now+20000;
  publish(room);
 }
 return {enabled,update,take,publish};
}
