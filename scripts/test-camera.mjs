import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {cameraRoofClearance} from '../src/camera-clearance.js';
const focusY=491,desiredY=492;
const mixed=[{roofY:497},{id:'DBT-wall'},{roofY:null},{roofY:NaN},{roofY:Infinity}];
assert(Number.isNaN(mixed.reduce((y,b)=>Math.max(y,b.roofY+2.5),desiredY)),'Reproduce previous disappearing-scene bug');
assert.equal(cameraRoofClearance(desiredY,focusY,mixed),499.5);
assert.equal(cameraRoofClearance(desiredY,focusY,[{roofY:10000}]),focusY+18,'Keep nearby high structures from launching camera');
assert.equal(cameraRoofClearance(desiredY,focusY,[{}]),desiredY);
const root=JSON.parse(fs.readFileSync('dist/world-manifest.json')),manifest=JSON.parse(fs.readFileSync('dist'+root.mobileWorld));let missing=0,count=0;
for(const tile of Object.values(manifest.tiles)){
 const raw=gunzipSync(fs.readFileSync('dist'+tile.url)),header=JSON.parse(raw.subarray(4,4+raw.readUInt32LE(0)));
 missing+=header.colliders.filter(b=>!Number.isFinite(b.roofY)).length;
 const y=cameraRoofClearance(desiredY,focusY,header.colliders);assert(Number.isFinite(y));assert(y>=desiredY&&y<=focusY+18);count++;
}
assert(missing>0,'Regression must include real DBT obstacles without a roof');
console.log(`PASS: camera finite across ${count} real mobile tiles, including ${missing} roofless DBT colliders; bounded clearance and NaN regression.`);
