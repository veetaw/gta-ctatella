import {CanvasTexture,Sprite,SpriteMaterial} from 'three';

export function updateNameplate(model,name){
 if(!name){
  if(model.nameplate)model.nameplate.visible=false;
  return;
 }
 if(!model.nameplate){
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=96;
  const texture=new CanvasTexture(canvas);
  const sprite=new Sprite(new SpriteMaterial({map:texture,depthWrite:false,toneMapped:false}));
  sprite.name='Nickname online';
  sprite.position.y=2.2;
  model.root.add(sprite);
  model.nameplate=sprite;
 }
 const sprite=model.nameplate;
 if(sprite.userData.nickname!==name){
  const texture=sprite.material.map;
  const canvas=texture.image,ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font='700 42px system-ui';
  const width=Math.min(canvas.width,Math.ceil(ctx.measureText(name).width)+32);
  ctx.fillStyle='#101a22e6';
  ctx.fillRect((canvas.width-width)/2,14,width,68);
  ctx.fillStyle='#fff';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(name,canvas.width/2,48,width-24);
  sprite.scale.set(3.2,.6,1);
  sprite.userData.nickname=name;
  texture.needsUpdate=true;
 }
 sprite.visible=true;
}
