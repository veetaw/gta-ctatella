import {prepareLocalLandmarks,shopWallCuts} from './local-landmarks.js';
import {preparePuntoGarage,garageWallCuts} from './punto-location.js';
import {tileMaterial} from './roof-material.js';
import {makeCellars} from './cellars.js';
import {makeChurch,makeBellTower} from './churches.js';
import * as THREE from 'three';
import earcut,{flatten} from 'earcut';
import {elevation,inBuilding} from './world-math.js';
import {buildingSeed,facadePlans,roofPlan,inRings,edgeDistance} from './building-plan.js';
import {PLASTER,createFacadeMaterial} from './facade-material.js';

const bucket=()=>({position:[],uv:[],groundY:[],edgeDistance:[],roofDistance:[],color:[],tint:null});
function triangle(out,vertices,uv=[[0,0],[1,0],[1,1]],metadata=null){for(let i=0;i<3;i++){out.position.push(...vertices[i]);out.uv.push(...uv[i]);if(out.tint)out.color.push(...out.tint);if(metadata){out.groundY.push(metadata[i][0]);out.edgeDistance.push(metadata[i][1]);out.roofDistance.push(metadata[i][2]);}}}
function quad(out,p,uv,metadata){triangle(out,[p[0],p[1],p[2]],uv?[uv[0],uv[1],uv[2]]:undefined,metadata?[metadata[0],metadata[1],metadata[2]]:null);triangle(out,[p[0],p[2],p[3]],uv?[uv[0],uv[2],uv[3]]:undefined,metadata?[metadata[0],metadata[2],metadata[3]]:null);}
function box(out,center,size,basis={dx:1,dz:0,nx:0,nz:1}){const points=[];for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1])points.push([center[0]+basis.dx*x*size[0]/2+basis.nx*z*size[2]/2,center[1]+y*size[1]/2,center[2]+basis.dz*x*size[0]/2+basis.nz*z*size[2]/2]);for(const f of [[0,1,3,2],[5,4,6,7],[4,0,2,6],[1,5,7,3],[2,3,7,6],[4,5,1,0]])quad(out,(basis.dx*basis.nz-basis.dz*basis.nx>0?[f[0],f[3],f[2],f[1]]:f).map(i=>points[i]));}
function mesh(out,material,parent,name){if(!out.position.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(out.position,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(out.uv,2));for(const attribute of ['groundY','edgeDistance','roofDistance'])if(out[attribute].length)geometry.setAttribute(attribute,new THREE.Float32BufferAttribute(out[attribute],1));if(out.color.length)geometry.setAttribute('color',new THREE.Float32BufferAttribute(out.color,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}


export function makeBuildings(scene,world,{atlas=createFacadeMaterial(),localDetails=true,onBalcony}={}){
  if(localDetails){preparePuntoGarage(world);prepareLocalLandmarks(world);}
  const group=new THREE.Group();group.name='Borgo · diverse Italian houses';scene.add(group);
  const walls=bucket(),roofs=bucket(),stone=bucket(),metal=bucket(),brick=bucket();
  const chimneyInstances=[];const stats={buildings:0,openings:0,blindShortWalls:0,balconies:0,chimneys:0,roofTriangles:0};
  if(localDetails)makeCellars(group,world);
  for(const building of world.buildings){
    if(building.cellar)continue;
    if(building.church){makeChurch(group,building,world.terrain);continue;}if(building.classification==='bell-tower'||building.classification==='church'){makeBellTower(group,building);continue;}
    const seed=buildingSeed(building.id),palette=seed%7,facades=facadePlans(building,world.terrain);
    const foundation=Math.min(building.minGroundY-10,...building.rings.flat().map(p=>elevation(world.terrain,...p)-2));
    for(const wall of facades){
      const localShop=shopWallCuts(building,wall);if(localShop)wall.balconies=[];
      const sampled=building.facadeColors?.find(f=>f.ring===wall.ringIndex&&f.edge===wall.edgeIndex);walls.tint=new THREE.Color(sampled?.color||building.wallColor||PLASTER[palette]).toArray();
      wall.balconies=wall.balconies.filter(balcony=>{const p=wall.point(balcony.center);return [-1.14,1.14].every(offset=>{const q=[p[0]+wall.dx*offset+wall.nx*.92,p[1]+wall.dz*offset+wall.nz*.92];return !world.buildings.some(b=>b!==building&&q[0]>b.bounds[0]&&q[0]<b.bounds[2]&&q[1]>b.bounds[1]&&q[1]<b.bounds[3]&&inBuilding(q,b));});});
      if(wall.length<6&&!wall.centers.length)stats.blindShortWalls++;
      const pieces=[];let previous=0;
      for(let i=0;i<wall.centers.length;i++){const center=wall.centers[i],start=Math.max(previous,center-2.5),end=Math.min(wall.length,center+2.5,i+1<wall.centers.length?(center+wall.centers[i+1])/2:wall.length);if(start>previous)pieces.push({start:previous,end:start,center:null});pieces.push({start,end,center,index:i});previous=end;}
      if(previous<wall.length)pieces.push({start:previous,end:wall.length,center:null});
      if(!pieces.length)pieces.push({start:0,end:wall.length,center:null});
      const levels=[{bottom:foundation,top:Math.min(wall.floorY,building.roofY),floor:-1}];
      for(let y=wall.floorY,level=0;y<building.roofY-.02;y+=3.2,level++)levels.push({bottom:y,top:Math.min(building.roofY,y+3.2),floor:level});
      for(const piece of pieces)for(const level of levels){if(level.top<=level.bottom)continue;let type='blank';
        if(piece.center!==null&&level.top-level.bottom>2.65){
          const variant=buildingSeed(`${seed}/${wall.variant}/${piece.index}/${level.floor}`);
          if(level.floor===0){const middle=Math.floor(wall.centers.length/2);type=piece.index===middle?'door':piece.index===0&&wall.length>8?'garage':variant%3?'cellar':'blank';}
          else if(level.floor>0){const balcony=level.floor===1&&wall.balconies.some(b=>Math.abs(b.center-piece.center)<.01);type=balcony?'balcony':variant%6===0?'blank':['green','brown','roller','arch'][variant%4];}
          if(building.classification&&building.classification!=='residential'){if(level.floor>0)type=type==='blank'?'blank':'arch';wall.balconies=[];}
          if(type!=='blank')stats.openings++;
        }
        const n=Math.max(1,Math.ceil((piece.end-piece.start)/3.0));
        for(let i=0;i<n;i++){
          const d0=piece.start+(piece.end-piece.start)*i/n,d1=piece.start+(piece.end-piece.start)*(i+1)/n,p0=wall.point(d0),p1=wall.point(d1),g0=elevation(world.terrain,...p0),g1=elevation(world.terrain,...p1);
          const cuts=garageWallCuts(building.puntoGarage,p0,p1),fractions=[0,...cuts.filter(t=>t>1e-7&&t<1-1e-7),1].sort((a,b)=>a-b);
          for(let part=1;part<fractions.length;part++){
           const t0=fractions[part-1],t1=fractions[part],inside=cuts.length&&(t0+t1)/2>cuts[0]&&(t0+t1)/2<cuts[1],bottom=Math.max(level.bottom,inside?building.puntoGarage.ceiling:-Infinity,localShop?wall.floorY+localShop.ceiling:-Infinity);if(bottom>=level.top-.001)continue;
           const from=d0+(d1-d0)*t0,to=d0+(d1-d0)*t1,a=wall.point(from),b=wall.point(to),vertices=[[a[0],bottom,a[1]],[b[0],bottom,b[1]],[b[0],level.top,b[1]],[a[0],level.top,a[1]]];
           const u=d=>piece.center===null?.5:(d-piece.center)/5+.5,v=y=>level.floor<0?(y-level.bottom)/(level.top-level.bottom):(y-(wall.floorY+level.floor*3.2))/3.2;
           const coords=[[from,bottom],[to,bottom],[to,level.top],[from,level.top]].map(([d,y])=>atlas.uv(palette,type,Math.max(0,Math.min(1,u(d))),v(y)));
           const metadata=vertices.map((p,j)=>[elevation(world.terrain,p[0],p[2]),Math.min(j===0||j===3?from:to,wall.length-(j===0||j===3?from:to)),building.roofY-p[1]]);quad(walls,vertices,coords,metadata);
          }
        }
      }
      for(const balcony of wall.balconies){const p=wall.point(balcony.center),basis=wall,at=(x,y,z)=>[p[0]+wall.dx*x+wall.nx*z,balcony.y+y,p[1]+wall.dz*x+wall.nz*z];
        const corners=[at(-1.14,0,.92),at(1.14,0,.92)];if(corners.some(p=>world.buildings.some(b=>b!==building&&p[0]>b.bounds[0]&&p[0]<b.bounds[2]&&p[2]>b.bounds[1]&&p[2]<b.bounds[3]&&inBuilding([p[0],p[2]],b))))continue;
        box(stone,at(0,.01,.45),[2.35,.15,.96],basis);for(const x of [-.8,.8])box(stone,at(x,-.20,.28),[.16,.32,.55],basis);
        box(metal,at(0,1.02,.9),[2.30,.045,.045],basis);box(metal,at(0,.23,.9),[2.30,.025,.025],basis);
        for(let x=-1.1;x<=1.11;x+=.2)box(metal,at(x,.61,.9),[.023,.8,.023],basis);
        for(const x of [-1.12,1.12]){box(metal,at(x,1.02,.45),[.035,.04,.9],basis);for(let z=.1;z<.9;z+=.2)box(metal,at(x,.61,z),[.023,.8,.023],basis);}
        if(onBalcony){
         const [x,y,z]=at(0,.085,.53);
         onBalcony({x,y,z,yaw:Math.atan2(wall.nx,wall.nz)});
        }
        stats.balconies++;
      }
    }
    roofs.tint=new THREE.Color(building.roofColor||'#a46b4d').toArray();const roof=roofPlan(building);
    for(const part of roof.parts){
      for(const tri of part.triangles){const [a,b,c]=tri,ordered=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0])>0?[a,c,b]:tri;triangle(roofs,ordered,ordered.map(p=>[p[0]/2,p[2]/2]));stats.roofTriangles++;}
      for(const ring of part.rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];quad(stone,[[a[0],building.roofY-.18,a[1]],[b[0],building.roofY-.18,b[1]],[b[0],building.roofY+.08,b[1]],[a[0],building.roofY+.08,a[1]]]);}
      const f=flatten(part.rings),ids=earcut(f.vertices,f.holes,2);for(let i=0;i<ids.length;i+=3){const p=ids.slice(i,i+3).map(j=>[f.vertices[j*2],building.roofY-.18,f.vertices[j*2+1]]);triangle(stone,p);}
      if(building.area>=45&&building.area<1100&&building.height>4){const count=building.area>180&&seed%3===0?2:1;for(let i=0;i<count;i++){
        const candidate=[part.pole[0]+(i?1.3:-.8),part.pole[1]+(i?-.7:.6)],p=inRings(candidate,part.rings)&&edgeDistance(candidate,part.rings)>1?candidate:part.pole,y=part.heightAt(p);
        chimneyInstances.push([p[0],y+.43,p[1]]);box(stone,[p[0],y+1.08,p[1]],[.7,.12,.77]);box(metal,[p[0],y+1.15,p[1]],[.39,.035,.44]);stats.chimneys++;
      }}
    }
    stats.buildings++;
  }
  mesh(walls,atlas.material,group,'Sparse facades · independent ground floors');mesh(roofs,tileMaterial(true),group,'Pitched terracotta roofs');mesh(stone,new THREE.MeshStandardMaterial({color:'#c6baa1',roughness:.94,side:THREE.DoubleSide}),group,'Projecting cornices, balconies and chimney caps');mesh(metal,new THREE.MeshStandardMaterial({color:'#303a33',roughness:.75,metalness:.25,side:THREE.DoubleSide}),group,'Open iron balcony railings');mesh(brick,new THREE.MeshStandardMaterial({color:'#a58164',roughness:1}),group,'Masonry chimneys');
  if(chimneyInstances.length){const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(.48,1.18,.55),new THREE.MeshStandardMaterial({color:'#a58164',roughness:1}),chimneyInstances.length),matrix=new THREE.Matrix4();chimneyInstances.forEach((p,i)=>instances.setMatrixAt(i,matrix.makeTranslation(...p)));instances.name='Instanced masonry chimneys';instances.castShadow=false;group.add(instances);}
  if(world.puntoGarage){const g=world.puntoGarage,floor=bucket();world.puntoGarageSurface=[];for(let u=g.min;u<g.max;u+=1)for(let v=-g.half;v<g.half;v+=1){const at=(a,b)=>{const x=g.x+g.dx*a+g.dz*b,z=g.z+g.dz*a-g.dx*b;return [x,elevation(world.terrain,x,z)+.015,z];},p=[at(u,v),at(u+1,v),at(u+1,Math.min(g.half,v+1)),at(u,Math.min(g.half,v+1))];quad(floor,p);for(const ids of [[0,1,2],[0,2,3]]){const ps=ids.map(i=>p[i]);world.puntoGarageSurface.push({points:ps.map(p=>[p[0],p[2]]),y:ps.map(p=>p[1]-.06),bounds:[Math.min(...ps.map(p=>p[0])),Math.min(...ps.map(p=>p[2])),Math.max(...ps.map(p=>p[0])),Math.max(...ps.map(p=>p[2]))]});}}mesh(floor,new THREE.MeshStandardMaterial({color:'#a29b8e',roughness:.98,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),group,'Punto garage access paving');}
  group.userData.statistics=stats;return group;
}
