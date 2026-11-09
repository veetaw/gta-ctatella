export function isStandalone(){
 return navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;
}

export function addHomeScreenHint(parent){
 if(!/iPhone|iPod/i.test(navigator.userAgent)||isStandalone())return;
 const hint=document.createElement('p');
 hint.className='install-hint';
 hint.innerHTML='<strong>Gioca senza la barra di Safari</strong><br>Condividi → Aggiungi a Home → Apri come app web. Poi avvia Ctatella dalla Home.';
 parent.append(hint);
}
