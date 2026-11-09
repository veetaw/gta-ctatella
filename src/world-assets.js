import {MOBILE} from './device-profile.js';
import {gunzipSync} from 'fflate';
let manifestPromise;
export const production=(import.meta.env?.PROD??false);
export function getWorldManifest(){return manifestPromise??=fetch('/world-manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Manifest dati non disponibile');return r.json();});}
export async function unpackResponse(response){if(!response.ok)throw Error(`Dati non disponibili: HTTP ${response.status}`);if(typeof DecompressionStream!=='undefined')return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();const output=gunzipSync(new Uint8Array(await response.arrayBuffer()));return output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength);}
export async function loadWorldJSON(name){if(!production){const r=await fetch('/'+name+'.json');if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}const manifest=await getWorldManifest(),entry=manifest.assets[name];return JSON.parse(new TextDecoder().decode(await unpackResponse(await fetch(entry.url))));}
export async function orthophotoURL(){if(!production)return MOBILE?'/orthophoto-mobile.webp':'/orthophoto.jpg';const manifest=await getWorldManifest();return MOBILE?manifest.orthophotoMobile:manifest.orthophoto;}
