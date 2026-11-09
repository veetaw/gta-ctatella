export const ENGINE_PROFILES={motocross:{idle:1450,redline:10000,shiftRPM:8500,shiftSeconds:.12,tone:1.28},panda:{idle:900,redline:5800,shiftRPM:5000,shiftSeconds:.19,tone:.92},punto:{idle:850,redline:6500,shiftRPM:5600,shiftSeconds:.16,tone:1},ferrari:{idle:1050,redline:9000,shiftRPM:8000,shiftSeconds:.09,tone:1.22}};
export function updatePowertrain(car,dt,throttle=car.throttle||0){
 const p=ENGINE_PROFILES[car.spec.id]||ENGINE_PROFILES.panda,v=Math.abs(car.speed),gears=car.spec.gears;
 let gear=car.driveGear||Math.max(1,gears.filter(x=>v>=x).length);car.shiftRemaining=Math.max(0,(car.shiftRemaining||0)-dt);
 if(v<.1){gear=1;car.shiftRemaining=0;}else if(!car.shiftRemaining){const previous=gear;if(gear<gears.length&&v>gears[gear]+.15)gear++;else if(gear>1&&v<gears[gear-1]-.8)gear--;if(gear!==previous)car.shiftRemaining=p.shiftSeconds;}
 car.driveGear=gear;const upper=gears[gear]??car.spec.maxSpeed,wheelRPM=v/Math.max(1,upper)*p.shiftRPM,target=Math.min(p.redline,Math.max(p.idle,wheelRPM)+Math.max(0,Math.abs(throttle))*(1-Math.min(1,v/4))*650);
 car.engineRPM=(car.engineRPM??p.idle)+(target-(car.engineRPM??p.idle))*(1-Math.exp(-dt*12));return car;
}
