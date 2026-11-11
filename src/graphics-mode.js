const KEY='ctatella-graphics-v1';
export const graphicsMode=(()=>{try{return localStorage.getItem(KEY)==='max'?'max':'normal';}catch{return 'normal';}})();
export const hqEnabled=graphicsMode==='max';
export function restartWithGraphics(mode){localStorage.setItem(KEY,mode==='max'?'max':'normal');location.reload();}
