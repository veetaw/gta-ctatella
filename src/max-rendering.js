import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// HDR grading precedes OutputPass: exposure/ACES and sRGB are applied once.
const grade={uniforms:{tDiffuse:{value:null}},vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
 void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));
 c=mix(vec3(l),c,.94);float shade=1.-smoothstep(.03,.8,l);
 c*=mix(vec3(1.035,1.005,.96),vec3(.91,.975,1.06),shade*.55);
 float v=dot(vUv-.5,vUv-.5);c*=1.-.25*v;
 gl_FragColor=vec4(max(c,vec3(0.)),1.);}`};

export function createMaxRendering({scene,camera,renderer,atmosphere,mobile=false}){
 const {light,sun}=atmosphere,hemi=scene.children.find(o=>o.isHemisphereLight);
 const snapshot={sun:sun.clone(),background:scene.background,fog:scene.fog,tone:renderer.toneMapping,exposure:renderer.toneMappingExposure,
  color:light.color.clone(),intensity:light.intensity,shadowType:renderer.shadowMap.type,shadowSize:light.shadow.mapSize.clone(),bias:light.shadow.bias,normalBias:light.shadow.normalBias,radius:light.shadow.radius,
  hemi:hemi&&{color:hemi.color.clone(),ground:hemi.groundColor.clone(),intensity:hemi.intensity},skyMaterial:atmosphere.sky?.material,vehicleEnvironment:scene.userData.vehicleEnvironment};
 let originalRatio=renderer.getPixelRatio();
 let active=false,composer,bloom,output,colorPass,sky,environment,lastWidth=0,lastHeight=0,lastRatio=0,clock=0;
 const lamps=[],glass=[],reflections=[],pool=[],matrix=new THREE.Matrix4(),p=new THREE.Vector3();
 function gather(){
  scene.updateMatrixWorld(true);
  scene.traverse(mesh=>{
   const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   for(const mat of mats){if(!mat)continue;if(mat.envMap===snapshot.vehicleEnvironment&&mat.envMap&&!reflections.some(r=>r.mat===mat))reflections.push({mat,envMap:mat.envMap});}
   if(!mesh.isInstancedMesh||mesh.name!=='Lampioni del paese'||!mesh.material.emissive||mesh.material.emissive.getHex()===0||mesh.material.emissiveIntensity===0)return;
   glass.push({mat:mesh.material,color:mesh.material.emissive.clone(),intensity:mesh.material.emissiveIntensity});
   for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);lamps.push(p.clone());}
  });
 }
 function releaseTargets(){
  if(composer){for(const pass of composer.passes)pass.dispose?.();composer.dispose();composer=null;}
  environment?.dispose();environment=null;
 }
 function resetShadow(){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapPass?.dispose();light.shadow.mapPass=null;light.shadow.needsUpdate=true;}
 function enable(){
  if(active)return;originalRatio=renderer.getPixelRatio();
  try{
   gather();
   sky=new Sky();sky.scale.setScalar(3000);sky.frustumCulled=false;
   const u=sky.material.uniforms;u.turbidity.value=7;u.rayleigh.value=2.4;u.mieCoefficient.value=.006;u.mieDirectionalG.value=.86;
   sun.setFromSphericalCoords(1,THREE.MathUtils.degToRad(84),THREE.MathUtils.degToRad(245));u.sunPosition.value.copy(sun);
   if(atmosphere.sky){atmosphere.sky.material=sky.material;}else{scene.add(sky);atmosphere.sky=sky;}
   light.color.set('#ffbd82');light.intensity=3.0;
   if(hemi){hemi.color.set('#91a8ce');hemi.groundColor.set('#79604d');hemi.intensity=1.65;}
   scene.background=new THREE.Color('#b9a28e');scene.fog=new THREE.Fog('#baa18d',mobile?90:450,mobile?230:2600);
   renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.07;
   if(!mobile){renderer.shadowMap.type=THREE.PCFShadowMap;light.shadow.radius=2.5;light.shadow.mapSize.set(2048,2048);light.shadow.bias=-.00025;light.shadow.normalBias=.055;resetShadow();}
   if(!mobile){const envScene=new THREE.Scene();const envSky=new Sky();envSky.material=sky.material;envSky.scale.setScalar(3000);envScene.add(envSky);const pmrem=new THREE.PMREMGenerator(renderer);try{environment=pmrem.fromScene(envScene,.04,.8,4000);}finally{pmrem.dispose();envSky.geometry.dispose();}
    scene.userData.vehicleEnvironment=environment.texture;for(const {mat} of reflections){mat.envMap=environment.texture;mat.needsUpdate=true;}}
   for(const {mat} of glass){mat.emissive.set('#ffb05a');mat.emissiveIntensity=3.2;}
   // Fixed pool avoids shaders recompiling as nearby lamps change. No lamp shadows.
   for(let i=0;i<(mobile?2:6);i++){const lamp=new THREE.PointLight('#ffb567',0,14,2);lamp.castShadow=false;scene.add(lamp);pool.push(lamp);}
   const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});target.samples=mobile?0:Math.min(2,renderer.capabilities.maxSamples);
   composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
   bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.18,.65,1.15);composer.addPass(bloom);
   colorPass=new ShaderPass(grade);composer.addPass(colorPass);output=new OutputPass();composer.addPass(output);
   active=true;lastWidth=lastHeight=0;updateLamps(1);resize();
  }catch(error){active=true;disable();throw error;}
 }
 function disable(){
  if(!active)return;active=false;
  sun.copy(snapshot.sun);light.color.copy(snapshot.color);light.intensity=snapshot.intensity;
  if(hemi&&snapshot.hemi){hemi.color.copy(snapshot.hemi.color);hemi.groundColor.copy(snapshot.hemi.ground);hemi.intensity=snapshot.hemi.intensity;}
  scene.background=snapshot.background;scene.fog=snapshot.fog;renderer.toneMapping=snapshot.tone;renderer.toneMappingExposure=snapshot.exposure;renderer.setPixelRatio(originalRatio);
  renderer.shadowMap.type=snapshot.shadowType;light.shadow.mapSize.copy(snapshot.shadowSize);light.shadow.bias=snapshot.bias;light.shadow.normalBias=snapshot.normalBias;light.shadow.radius=snapshot.radius;if(!mobile)resetShadow();
  if(snapshot.skyMaterial)atmosphere.sky.material=snapshot.skyMaterial;else{sky?.removeFromParent();delete atmosphere.sky;}
  sky?.material.dispose();sky?.geometry.dispose();sky=null;
  scene.userData.vehicleEnvironment=snapshot.vehicleEnvironment;
  // Vehicles created while Max was enabled also need their original reflection.
  scene.traverse(mesh=>{for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(mat&&environment&&mat.envMap===environment.texture){mat.envMap=snapshot.vehicleEnvironment;mat.needsUpdate=true;}});
  for(const {mat,envMap} of reflections){mat.envMap=envMap;mat.needsUpdate=true;}
  for(const {mat,color,intensity} of glass){mat.emissive.copy(color);mat.emissiveIntensity=intensity;}
  for(const lamp of pool)lamp.removeFromParent();pool.length=lamps.length=glass.length=reflections.length=0;
  releaseTargets();
 }
 const size=new THREE.Vector2();
 function resize(){if(!composer)return;renderer.getSize(size);const ratio=renderer.getPixelRatio();if(size.x===lastWidth&&size.y===lastHeight&&ratio===lastRatio)return;
  lastWidth=size.x;lastHeight=size.y;lastRatio=ratio;composer.setPixelRatio(Math.min(ratio,mobile?1:1.5));composer.setSize(size.x,size.y);
 }
 function updateLamps(dt){clock+=dt;if(clock<.25)return;clock=0;
  lamps.sort((a,b)=>a.distanceToSquared(camera.position)-b.distanceToSquared(camera.position));
  for(let i=0;i<pool.length;i++){const pos=lamps[i],lamp=pool[i];const distance=pos?pos.distanceTo(camera.position):Infinity;lamp.intensity=distance<65?48*(1-THREE.MathUtils.smoothstep(distance,45,65)):0;if(pos)lamp.position.copy(pos).addScaledVector(THREE.Object3D.DEFAULT_UP,-.18);}
 }
 function restoreContext(){if(active){disable();enable();}}
 renderer.domElement.addEventListener('webglcontextrestored',restoreContext);
 return {enable,disable,get active(){return active;},render(dt){resize();updateLamps(dt);const autoReset=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();try{composer.render(dt);}finally{renderer.info.autoReset=autoReset;}},dispose(){disable();renderer.domElement.removeEventListener('webglcontextrestored',restoreContext);},
  stats:()=>({active,lamps:lamps.length,lightBudget:pool.length,postprocessing:!!composer})};
}
