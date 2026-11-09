// Keep GPU quality independent of screen orientation and touch-control state.
export function mobileClient(nav=globalThis.navigator,search=globalThis.location?.search||''){
 return /Mobi|Android|iPhone|iPad/i.test(nav?.userAgent||'')||(/Macintosh/i.test(nav?.userAgent||'')&&nav?.maxTouchPoints>1)||new URLSearchParams(search).has('mobile');
}
export const MOBILE=mobileClient();
export const TEXTURE_ANISOTROPY=MOBILE?4:16;
export function canvasDimensions(width,height=width,mobile=MOBILE){const scale=mobile?Math.min(.5,1024/Math.max(width,height)):1;return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
// Drawing coordinates stay in the original atlas space, so metric UVs do not change.
export function drawingCanvas(width,height=width){const c=document.createElement('canvas'),size=canvasDimensions(width,height);c.width=size.width;c.height=size.height;c.getContext('2d').scale(size.width/width,size.height/height);return c;}
export function pixelRatioFor(width,height,dpr=1,mobile=MOBILE){return Math.min(dpr,mobile?1:1.35,Math.sqrt((mobile?850000:Infinity)/Math.max(1,width*height)));}
