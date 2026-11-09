export function showInstagramNotice(){
 const notice=document.createElement('dialog');
 notice.id='instagram-notice';
 notice.setAttribute('aria-labelledby','instagram-title');
 notice.innerHTML=`
  <p class="login-eyebrow">GTA CTATELLA</p>
  <h1 id="instagram-title">Apri nel browser esterno</h1>
  <p>Per giocare in orizzontale, tocca <strong>⋯</strong> nel menu di Instagram e scegli <strong>Apri nel browser esterno</strong>.</p>
  <p>Puoi anche copiare il link e incollarlo in Safari o Chrome.</p>
  <button type="button">Copia link del gioco</button>
  <input type="url" readonly hidden aria-label="Link del gioco">
  <p role="status"></p>`;
 const button=notice.querySelector('button'),link=notice.querySelector('input'),status=notice.querySelector('[role=status]');
 link.value=location.href;
 button.onclick=async()=>{
  try{
   await navigator.clipboard.writeText(link.value);
   status.textContent='Link copiato. Apri il tuo browser e incollalo.';
  }catch{
   link.hidden=false;
   link.focus();
   link.select();
   status.textContent='Tieni premuto sul link per copiarlo.';
  }
 };
 notice.addEventListener('cancel',event=>event.preventDefault());
 document.body.append(notice);
 notice.showModal();
}
