export const needsLandscape=(touch,width,height)=>touch&&height>width;
let pending;
// Native orientation locks need a user gesture/fullscreen and may be refused.
// A portrait pause remains the fallback; never pretend CSS rotates the device.
export async function lockLandscape(display=globalThis.screen){
 if(!display?.orientation?.lock)return false;
 if(pending)return pending;
 pending=(async()=>{try{await display.orientation.lock('landscape');return true;}catch{return false;}})();
 try{return await pending;}finally{pending=null;}
}

export async function requestGameFullscreen(options={}){
 const toggle=options.toggle??true;
 try{if(!document.fullscreenElement&&!document.webkitFullscreenElement){const el=document.documentElement,fn=el.requestFullscreen||el.webkitRequestFullscreen;if(fn)await fn.call(el);}else if(toggle){const fn=document.exitFullscreen||document.webkitExitFullscreen;if(fn)await fn.call(document);return;}}catch{}
 await lockLandscape();
}
