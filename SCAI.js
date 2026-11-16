/* SCAI centraliza a seleção e inicialização das fases; cada fase é um HTML independente. */
(() => {
  'use strict';
  const phaseCatalog=[{id:'alpha01',name:'Auditoria de estoques',file:'fases/fase01.html?v=interacoes-2',enabled:true}];
  const menu=document.getElementById('menu'),player=document.getElementById('player'),frame=document.getElementById('phaseFrame');
  const start=(id='alpha01')=>{const phase=phaseCatalog.find(p=>p.id===id&&p.enabled);if(!phase)return;menu.hidden=true;player.hidden=false;document.body.style.overflow='hidden';frame.src=phase.file;frame.focus();};
  const exit=()=>{frame.src='about:blank';player.hidden=true;menu.hidden=false;document.body.style.overflow='';updateLast();};
  const updateLast=()=>{try{let v=JSON.parse(localStorage.getItem('SCAI_ALPHA01_LAST')||'null');if(v){document.getElementById('lastResult').textContent=`Última tentativa: ${v.success?'aprovada':'revisar'} • ${v.coverage}% de técnicas relevantes • ${new Date(v.date).toLocaleDateString('pt-BR')}`;}}catch(e){}};
  for(const id of ['topPlay','heroPlay','missionPlay'])document.getElementById(id).onclick=()=>start();
  document.getElementById('closeGame').onclick=exit;
  for (const type of ['selectstart','contextmenu','dragstart']) {
    player.addEventListener(type,event=>event.preventDefault());
  }
  window.addEventListener('message',e=>{if(e.data?.type==='scai:exit')exit();if(e.data?.type==='scai:completed')updateLast()});
  updateLast();
})();
