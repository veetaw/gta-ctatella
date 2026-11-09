import proj4 from 'proj4';
const UTM33='+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs';
export const HELIPORT={lat:40.659552,lon:15.400300};
export const MAZZUOCCOLO_START={lat:40.6575901,lon:15.4012597};
export const MAZZUOCCOLO_FINISH={lat:40.6555031,lon:15.4018798};
export function worldLocation(origin,{lat,lon}){const [x,y]=proj4('EPSG:4326',UTM33,[lon,lat]);return {x:x-origin.x,z:origin.y-y};}

export function geographicLocation(origin,{x,z}){const [lon,lat]=proj4(UTM33,'EPSG:4326',[origin.x+x,origin.y-z]);return {lat:+lat.toFixed(7),lon:+lon.toFixed(7)};}
