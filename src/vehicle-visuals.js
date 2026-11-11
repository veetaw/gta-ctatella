// Normal mode registers vehicles without importing loaders, decoders or HQ assets.
const cars=new Set();let hq;
export function registerVehicleVisual(car){cars.add(car);hq?.registerVehicleVisual(car);return car;}
export async function setVehicleQuality(quality){
 if(quality!=='hq'){return hq?.setVehicleQuality('original')??'original';}
 hq??=await import('./vehicle-hq.js');for(const car of cars)hq.registerVehicleVisual(car);return hq.setVehicleQuality('hq');
}
export function updateVehicleVisuals(camera){hq?.updateVehicleVisuals(camera);}
export function vehicleVisualStats(){return hq?.vehicleVisualStats()??{quality:'original',ready:false,supported:['ferrari','corvette']};}
