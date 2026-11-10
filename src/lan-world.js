import {makeCar, makePerson, updateCar} from './actors.js';
import {makeHelicopter, updateHelicopter} from './helicopter.js';
import {VEHICLES} from './vehicle-physics.js';
import {LAN_LIMIT} from './lan-room.js';

const TRAFFIC_COUNT = 2;
const WALKER_COUNT = 4;
const SNAPSHOT_INTERVAL = 1000 / 30;
const round = value => Math.round(value * 100) / 100;
const angle = value => Math.atan2(Math.sin(value), Math.cos(value));
const pose = (kind, actor, speed = 0) => [kind, ...actor.root.position.toArray().map(round),
 round(angle(actor.yaw ?? actor.root.rotation.y)), round(speed)];
const validKind = kind => typeof kind === 'string' && (kind === 'foot' || kind === 'helicopter' || Object.hasOwn(VEHICLES, kind));

function validPose(value) {
 return Array.isArray(value) && value.length === 6 && validKind(value[0]) &&
  value.slice(1).every(n => Number.isFinite(n) && Math.abs(n) <= 50000);
}

function place(root, target, blend) {
 const [, x, y, z, yaw] = target;
 const p = root.position;
 if (!root.visible || Math.hypot(p.x - x, p.z - z) > 12) {
  p.set(x, y, z);
  root.rotation.y = yaw;
 } else {
  p.x += (x - p.x) * blend;
  p.y += (y - p.y) * blend;
  p.z += (z - p.z) * blend;
  root.rotation.y += angle(yaw - root.rotation.y) * blend;
 }
 root.visible = true;
}

export function createLanWorld(scene, {terrain, traffic, plaza, height, clear, ready}) {
 const players = new Map(), models = [];
 const walkers = Array.from({length:WALKER_COUNT}, () => makePerson(scene));
 let room, sequence = 0, lastHost = -1, nextSend = 0, trafficPoses = [], walkerPoses = [], paths, time = 0;

 function bind(next) {
  if (room === next) return;
  room = next;
  sequence = 0;
  lastHost = -1;
  nextSend = 0;
  paths = undefined;
  time = 0;
  traffic.reset();
  trafficPoses = [];
  walkerPoses = [];
  players.clear();
  for (const {cache} of models) for (const model of cache.values()) model.root.visible = false;
  for (const walker of walkers) walker.root.visible = false;
  room?.onGameDataReceived((packet, id) => {
   if (!Number.isSafeInteger(packet?.seq) || packet.seq < 0) return;
   if (room.host) {
    if (validPose(packet.player) && packet.seq > (players.get(id)?.seq ?? -1)) players.set(id, {seq:packet.seq, pose:packet.player});
   } else if (packet.seq > lastHost && Array.isArray(packet.players) && packet.players.length <= LAN_LIMIT &&
    packet.players.every(entry => Array.isArray(entry) && typeof entry[0] === 'string' && /^[a-f0-9]{24}$/.test(entry[0]) && validPose(entry[1])) &&
    validAmbient(packet.traffic, TRAFFIC_COUNT, ['punto','rambo']) && validAmbient(packet.walkers, WALKER_COUNT, ['foot'])) {
    lastHost = packet.seq;
    players.clear();
    for (const [peer, target] of packet.players) if (peer !== room.id) players.set(peer, {pose:target});
    trafficPoses = packet.traffic;
    walkerPoses = packet.walkers;
   }
  });
 }

 function validAmbient(values, limit, kinds) {
  return Array.isArray(values) && values.length === limit && values.every(value =>
   value === null || (validPose(value) && kinds.includes(value[0])));
 }

 function renderPlayers(dt, blend) {
  for (const slot of models) {
   if (players.has(slot.id)) continue;
   if (slot.active) slot.active.root.visible = false;
   slot.id = null;
  }
  for (const [id, {pose:target}] of players) {
   let slot = models.find(item => item.id === id) || models.find(item => item.id === null);
   if (!slot) { slot = {cache:new Map()}; models.push(slot); }
   slot.id = id;
   const kind = target[0];
   if (!slot.cache.has(kind)) {
    const model = kind === 'foot' ? makePerson(scene) : kind === 'helicopter' ? makeHelicopter(scene) : makeCar(scene, kind);
    model.root.visible = false;
    slot.cache.set(kind, model);
   }
   const model = slot.cache.get(kind);
   if (slot.active && slot.active !== model) slot.active.root.visible = false;
   slot.active = model;
   place(model.root, target, blend);
   const speed = target[5];
   if (kind === 'foot') walk(model, speed);
   else if (kind === 'helicopter') {
    const {x,y,z} = model.root.position;
    Object.assign(model, {x,y,z,yaw:model.root.rotation.y});
    updateHelicopter(model, dt);
   } else {
    const {x,y,z} = model.root.position;
    Object.assign(model, {x,z,yaw:model.root.rotation.y,speed});
    updateCar(model, terrain, dt);
    model.root.position.y = y;
    if (model.rider) model.rider.visible = true;
   }
  }
 }
 function walk(model, speed) {
  model.limbs.forEach((limb, i) => {
   limb.rotation.x = Math.abs(speed) > .1 ? Math.sin(time * 9 + i % 2 * Math.PI) * .4 : 0;
  });
 }

 function walkAroundPlaza() {
  if (!paths && ready(plaza.x, plaza.z)) {
   paths = [];
   for (let i = 0; i < 24 && paths.length < WALKER_COUNT; i++) {
    const a = i * Math.PI / 12;
    const x = plaza.x + Math.sin(a) * 10, z = plaza.z + Math.cos(a) * 10;
    const dx = Math.cos(a) * 2.5, dz = -Math.sin(a) * 2.5;
    if (![-1,-.5,0,.5,1].every(t => clear(x + dx*t, z + dz*t, .5))) continue;
    if (paths.some(p => Math.hypot(x-p.x, z-p.z) < 4)) continue;
    paths.push({x,z,dx,dz});
   }
  }
  walkerPoses = walkers.map((_, i) => {
   const p = paths?.[i];
   if (!p) return null;
   const phase = time * .47 + i * 1.5, t = Math.sin(phase);
   const x = p.x + p.dx*t, z = p.z + p.dz*t, d = Math.sign(Math.cos(phase));
   return ['foot',round(x),round(height(x,z)),round(z),round(Math.atan2(p.dx*d,p.dz*d)),1];
  });
 }

 return function update(next, dt, now, player, simulating) {
  bind(next);
  if (!room) return;
  time += dt;
  const blend = 1 - Math.exp(-dt * 26);
  if (room.host) {
   for (const id of players.keys()) if (!room.hasPeer(id)) players.delete(id);
   traffic.update(dt, player.actor);
   walkAroundPlaza();
  } else {
   traffic.vehicles.forEach((vehicle, i) => {
    const target = trafficPoses[i];
    if (!target) { vehicle.root.visible = false; return; }
    const index = target[0] === 'rambo' ? 1 : 0;
    if (vehicle.wheels !== vehicle.variants[index].wheels) traffic.setVariant(vehicle, index);
    place(vehicle.root, target, blend);
    const {x,z} = vehicle.root.position;
    Object.assign(vehicle, {x,z,yaw:vehicle.root.rotation.y,speed:target[5]});
    updateCar(vehicle, terrain, dt);
   });
  }
  walkers.forEach((walker, i) => {
   if (!walkerPoses[i]) { walker.root.visible = false; return; }
   place(walker.root, walkerPoses[i], blend);
   walk(walker, 1);
  });
  renderPlayers(dt, blend);
  if (now < nextSend) return;
  nextSend = Math.max(now + 1, nextSend > now - SNAPSHOT_INTERVAL ? nextSend + SNAPSHOT_INTERVAL : now + SNAPSHOT_INTERVAL);
  const local = pose(player.kind, player.actor, simulating ? player.speed : 0);
  if (room.host) room.sendGameData({seq:sequence++, players:[[room.id, local], ...Array.from(players, ([id, state]) => [id, state.pose])],
   traffic:traffic.vehicles.map(vehicle => vehicle.root.visible ? pose(vehicle.wheels === vehicle.variants[1].wheels ? 'rambo' : 'punto', vehicle, vehicle.speed) : null), walkers:walkerPoses});
  else room.sendGameData({seq:sequence++, player:local});
 };
}
