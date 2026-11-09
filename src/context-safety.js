// Three.js restores its GPU buffers from retained CPU data. Never force a reload
// loop: a second loss requires an explicit retry, with an explanation on screen.
export function installContextSafety(renderer,{show=()=>{},hide=()=>{},stop=()=>{},resume=()=>{},clear=()=>{}}={}){
 const canvas=renderer.domElement;let lost=false,hidden=!!document.hidden,losses=0,blocked=false;
 const onLost=e=>{e.preventDefault();lost=true;losses++;blocked=losses>1;stop();clear();show(blocked?'La memoria grafica del dispositivo è insufficiente. Chiudi le altre schede e riprova.':'Grafica in pausa: ripristino della memoria del dispositivo…',blocked);};
 const onRestored=()=>{lost=false;if(blocked)return;renderer.setPixelRatio(Math.min(renderer.getPixelRatio(),.75));hide();if(!hidden)resume();};
 const onVisibility=()=>{hidden=document.hidden;if(hidden){stop();clear();}else if(!lost&&!blocked)resume();};
 canvas.addEventListener('webglcontextlost',onLost,false);canvas.addEventListener('webglcontextrestored',onRestored,false);document.addEventListener('visibilitychange',onVisibility);
 return {get canRender(){return !lost&&!hidden&&!blocked;},get losses(){return losses;},dispose(){canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);document.removeEventListener('visibilitychange',onVisibility);}};
}
