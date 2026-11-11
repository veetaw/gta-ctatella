// Local fixture only: no cloud credentials, no remote database, loopback binding.
import {readFile} from 'node:fs/promises';
import {createOnlineServer} from '../server/online.mjs';
import {worldLocation,HELIPORT} from '../src/game-locations.js';
import {hideSavePoint} from '../src/online-wire.js';
const world=JSON.parse(await readFile(new URL('../public/world-data.json',import.meta.url)));
const server=createOnlineServer({terrain:world.terrain,trafficRoads:world.roads,garageCenter:worldLocation(world.origin,HELIPORT),spawn:hideSavePoint(world),solidsNear:()=>[],origins:['http://127.0.0.1:5197','http://localhost:5197'],
 authenticate:async token=>/^visual-preview-[A-Za-z0-9_-]{1,24}$/.test(token)?{id:token,user_metadata:{username:token.slice(15),adult:true,avatar:'male',gta_progress_v2:{economy:{rp:1000}}}}:null});
server.http.listen(8097,'127.0.0.1',()=>console.log('Online preview fixture http://127.0.0.1:8097'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
