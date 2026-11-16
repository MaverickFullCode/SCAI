/* SCAI — Fase Alpha 01. Um caso completo de ensino, decisão, evidências e feedback. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const stageNames=['Introdução','Entrevista','Planejamento','Execução','Opinião','Avaliação'];
  const techs=[
    {id:'docs',name:'Inspeção documental',short:'Documentos',cost:2,priority:'Alta',place:'Mesa de documentos',pos:[-4.3,2.8],desc:'Examina notas fiscais, entradas e registros contábeis.',finding:'Notas e documentos de entrada não sustentam integralmente o saldo registrado. Há uma divergência que precisa ser conciliada.',expected:true},
    {id:'count',name:'Observação e contagem física',short:'Contagem',cost:3,priority:'Alta',place:'Estoque físico',pos:[5.1,-.55],desc:'Compara mercadorias existentes com quantidades registradas.',finding:'O sistema indica 1.200 unidades; a contagem física identificou 1.080. Diferença: 120 unidades.',expected:true},
    {id:'recalc',name:'Recálculo e conciliação',short:'Recálculo',cost:2,priority:'Alta',place:'Estação de conciliação',pos:[-8.8,2.8],desc:'Refaz cálculos e compara demonstrações com evidências.',finding:'A diferença de estoque representa superavaliação estimada em R$ 120 mil. Materialidade da missão: R$ 75 mil.',expected:true},
    {id:'analytics',name:'Procedimentos analíticos',short:'Análises',cost:1,priority:'Média',place:'Painel de indicadores',pos:[-9.65,-6.5],desc:'Investiga variações e indicadores atípicos.',finding:'O valor do estoque subiu 24%, enquanto as receitas cresceram 3%. Isso reforça o risco identificado.',expected:true},
    {id:'confirm',name:'Confirmação externa',short:'Confirmação',cost:3,priority:'Baixa',place:'Terminal de fornecedores',pos:[14.15,1.4],desc:'Solicita informação diretamente a terceiros independentes.',finding:'O fornecedor confirmou operações selecionadas, mas isso, isoladamente, não explica as divergências de estoque.',expected:false}
  ];
  const interviewTarget={x:-10.7,z:-.80};
  const opinions=[
    {id:'clean',name:'Opinião não modificada',subtitle:'Parecer sem ressalva — não há distorção material identificada.'},
    {id:'qualified',name:'Opinião com ressalva',subtitle:'Distorção material, mas não generalizada.'},
    {id:'adverse',name:'Opinião adversa',subtitle:'Distorções materiais e generalizadas.'},
    {id:'disclaimer',name:'Abstenção de opinião',subtitle:'Impossibilidade de obter evidência suficiente, com possíveis efeitos materiais e generalizados.'}
  ];
  const st={stage:'welcome',dialogStep:0,dialogReply:null,interviewScore:0,interviewPath:[],plan:Object.fromEntries(techs.map(t=>[t.id,0])),priority:Object.fromEntries(techs.map(t=>[t.id,t.priority])),executed:Object.fromEntries(techs.map(t=>[t.id,0])),spent:0,budget:12,adjustments:0,adjustmentOpen:false,report:null,modal:false,dialogueOpen:false,speaking:false,result:null};
  const SPEECH_CPS=30;
  let engine=null,near=null,toastTimer=null,speechTimer=null,speechToken=0;
  const phoneInput=matchMedia('(any-pointer: coarse)');
  const hudPanels=[['missionCard','missionToggle'],['quickbar','workToggle']];
  let phoneUi=false,activeHudPanel=null;
  function syncHudPanels(){
    for(const [panelId,toggleId] of hudPanels){
      const open=phoneUi&&activeHudPanel===panelId;
      $('#'+panelId).hidden=phoneUi&&!open;
      const toggle=$('#'+toggleId);
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',`${open?'Recolher':'Abrir'} ${panelId==='missionCard'?'missão':'painel de trabalho'}`);
    }
  }
  function closeHudPanels(restoreFocus=false){
    const previous=activeHudPanel;activeHudPanel=null;syncHudPanels();
    if(restoreFocus&&previous){
      const toggle=hudPanels.find(([panel])=>panel===previous)?.[1];
      if(toggle)$('#'+toggle).focus({preventScroll:true});
    }
  }
  function bindHudPanels(){
    const updateLayout=()=>{
      // Embedded browsers may report the host screen; explicit phone/tablet hints take priority.
      const shortSide=Math.min(screen.width||innerWidth,screen.height||innerHeight);
      const ua=navigator.userAgent;
      const tablet=/iPad|Tablet|PlayBook|Silk/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
      const phone=/iPhone|iPod|Windows Phone/i.test(ua)||(/Android/i.test(ua)&&/Mobile/i.test(ua))||navigator.userAgentData?.mobile===true;
      const next=!tablet&&(phone||(phoneInput.matches&&shortSide<=620));
      if(next!==phoneUi)activeHudPanel=null;
      phoneUi=next;$('#game').classList.toggle('phone-ui',phoneUi);syncHudPanels();
    };
    document.querySelectorAll('[data-hud-toggle]').forEach(button=>button.addEventListener('click',()=>{
      if(!phoneUi||st.modal||st.dialogueOpen)return;
      activeHudPanel=activeHudPanel===button.dataset.hudToggle?null:button.dataset.hudToggle;
      syncHudPanels();
    }));
    document.querySelectorAll('[data-hud-close]').forEach(button=>button.addEventListener('click',()=>closeHudPanels(true)));
    document.addEventListener('pointerdown',event=>{
      if(phoneUi&&activeHudPanel&&!event.target.closest?.('#missionCard, #quickbar, #mobilePanelButtons'))closeHudPanels();
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&phoneUi&&activeHudPanel){event.preventDefault();closeHudPanels(true);}
    });
    window.addEventListener('resize',updateLayout);
    phoneInput.addEventListener('change',updateLayout);
    updateLayout();
  }
  const inner=html=>`<div class="modal-inner">${html}</div>`;
  function show(html){closeHudPanels();$('#modalBody').innerHTML=inner(html);$('#modal').hidden=false;st.modal=true;$('#modalCard')?.scrollTo(0,0);}
  function stopSpeech(){speechToken++;if(speechTimer!==null){clearTimeout(speechTimer);speechTimer=null;}st.speaking=false;}
  function endDialogue(){stopSpeech();st.dialogueOpen=false;$('#dialoguePanel').hidden=true;$('#dialogueChoices').innerHTML='';$('#dialogueContinue').hidden=true;}
  function typeSpeech(text, onComplete) {
    stopSpeech();
    const token = speechToken;
    const chars = Array.from(text);
    const startedAt = performance.now();
    const duration = chars.length * 1000 / SPEECH_CPS;
    let visibleCharacters = 0;
    st.speaking = chars.length > 0;
    $('#dialogueText').textContent = '';
    const step = () => {
      if (token !== speechToken) return;
      const elapsed = performance.now() - startedAt;
      const count = Math.min(chars.length, 1 + Math.floor(elapsed * SPEECH_CPS / 1000));
      if (count !== visibleCharacters) {
        $('#dialogueText').textContent = chars.slice(0, count).join('');
        visibleCharacters = count;
      }
      if (elapsed >= duration) {
        st.speaking = false;
        speechTimer = null;
        onComplete?.();
        return;
      }
      speechTimer = setTimeout(step, Math.min(1000 / SPEECH_CPS, duration - elapsed));
    };
    step();
  }
  function hide(){if(st.dialogueOpen)endDialogue();st.modal=false;$('#modal').hidden=true;}
  function note(message){let el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}
  const planTotal=()=>techs.reduce((s,t)=>s+st.plan[t.id]*t.cost,0);
  const usedCount=()=>Object.values(st.executed).reduce((a,b)=>a+b,0);
  const completedTechs=()=>techs.filter(t=>t.expected&&st.executed[t.id]>0).length;
  const pct=()=>Math.round(completedTechs()/4*100);
  function setStage(stage){st.stage=stage;refresh();}
  function refresh(){engine?.renderer.setMarkers(objectiveMarkers());const idx={welcome:0,interview:1,planning:2,execution:3,report:4,result:5}[st.stage];
    $('#stagebar').innerHTML=stageNames.map((t,i)=>`<span class="${i<idx?'done':i===idx?'current':''}">${i<idx?'✓ ':''}${t}</span>`).join('');
    const o={welcome:['Boas-vindas ao SCAI','Aprenda a observar riscos, decidir técnicas de auditoria e justificar sua opinião.'],interview:['Entrevista com a administração','Converse com o gestor para compreender o contexto, os riscos e as pessoas envolvidas.'],planning:['Defina seu plano de auditoria','Selecione técnicas, metas e prioridades. Você dispõe de 12 pontos técnicos.'],execution:['Colete evidências suficientes','Explore os dois ambientes em 3D. Execute testes planejados ou fora da meta se houver saldo, nos pontos sinalizados.'],report:['Emita sua opinião independente','Analise as evidências que reuniu e escolha uma das quatro opiniões.'],result:['Avaliação e aprendizagem','Compare sua execução com o esperado e veja como aperfeiçoar a próxima tentativa.']}[st.stage];
    $('#objectiveTitle').textContent=o[0];$('#objectiveText').textContent=o[1];$('#missionProgress span').style.width=[8,19,39,65,83,100][idx]+'%';$('#pointsText').textContent=`Saldo ${st.budget-st.spent} PT`;
    $('#missionTip').textContent=st.stage==='execution'?'Aproxime-se de um ponto ◎ e pressione E ou toque em Interagir.':'WASD: andar • Arrastar: câmera • E: interagir';
    $('#reportBtn').hidden=st.stage!=='execution';let q='';
    if(st.stage==='welcome'||st.stage==='interview')q='<b>Meta inicial:</b> ouvir o gestor e levantar os principais riscos antes de definir os testes.';
    if(st.stage==='planning')q=`Alocado no plano: <b>${planTotal()} / ${st.budget} PT</b><br>Consumido: ${st.spent} PT · Saldo disponível para testes: ${st.budget-st.spent} PT.`;
    if(st.stage==='execution')q=`<b>${usedCount()} procedimento(s)</b> realizado(s)<br><b>${completedTechs()}/4 técnicas relevantes</b> utilizadas<br>Plano alocado: <b>${planTotal()} PT</b> · consumido: <b>${st.spent} PT</b><br><span style="color:#8ee3ce">Saldo disponível: ${st.budget-st.spent} PT</span>`;
    if(st.stage==='report'||st.stage==='result')q=`Técnicas relevantes utilizadas: <b>${pct()}%</b><br>Plano alocado: ${planTotal()} PT · consumido: ${st.spent} PT · saldo: ${st.budget-st.spent} PT.`;
    $('#quickContent').innerHTML=q;
  }
  function intro(){setStage('welcome');show(`<div class="modal-label">MISSÃO INTRODUTÓRIA • APRENDIZADO</div><h2 id="modalTitle" class="modal-title">Bem-vindo à sua primeira auditoria.</h2><p class="modal-desc">Você é um auditor independente contratado para avaliar o estoque da <b>Aurora Distribuição S.A.</b> Nesta demonstração, terá liberdade para andar por um escritório e um galpão verdadeiramente tridimensionais.</p><img class="cover-photo" src="../assets/galpao.webp" alt="Referência artística Clean Stylized 3D do centro de distribuição"/><div class="twoCol"><div class="miniCard"><h3>01 · Aprenda com decisões</h3><p>Entrevista, identificação de riscos, técnicas, amostragem e emissão da opinião.</p></div><div class="miniCard"><h3>02 · Erros fazem parte</h3><p>O sistema compara o que era esperado com o que você fez e explica por quê.</p></div><div class="miniCard"><h3>03 · Segurança razoável</h3><p>Os pontos técnicos simulam limites de tempo e recursos. Não é possível testar tudo.</p></div><div class="miniCard"><h3>04 · Quatro opiniões</h3><p>Não modificada, com ressalva, adversa e abstenção. Sua escolha exige justificativa.</p></div></div><div class="notice"><b>O que este alfa testa:</b> movimentação/câmera WebGL, ambientes 3D, personagem com animação de boca, diálogos ramificados, plano ajustável, execução orientada por técnicas e avaliação pedagógica. O caso é fictício e simplificado para ensino.</div><div class="buttons"><button class="primary" id="startMission">Começar a entrevista →</button></div>`);$('#startMission').onclick=()=>{hide();setStage('interview');note('Procure o gestor na sala de reunião. ◎');};}
  const interview=[
    {s:'Bom dia! Fechamos nosso inventário, mas alguns lotes apresentaram diferenças. O sistema aponta mais unidades do que o levantamento físico. Qual é a sua primeira preocupação?',opts:[
      {t:'Solicitar registros, entender o processo de contagem e avaliar riscos.',good:true,response:'Excelente. Primeiro compreendemos o processo e buscamos evidências apropriadas, sem presumir culpados.'},
      {t:'Aceitar a explicação verbal porque o gerente conhece o estoque.',good:false,response:'A indagação é útil, mas isoladamente não fornece evidência suficiente para concluir sobre os saldos.'},
      {t:'Mandar ajustar os números imediatamente, antes de investigar.',good:false,response:'Correções exigem base documental. Primeiro investigue a causa, a extensão e os efeitos.'}]},
    {s:'Temos muitos empregados e pressão para publicar as demonstrações. Os gestores têm receio de que um problema contábil afete a operação. Como você conduzirá isso?',opts:[
      {t:'Ouvir as preocupações, agir com respeito e preservar a independência.',good:true,response:'Correto. A dimensão humana importa, mas não substitui o julgamento profissional nem a evidência.'},
      {t:'Garantir um parecer positivo para proteger a empresa.',good:false,response:'Prometer uma opinião compromete a independência e a qualidade do trabalho.'},
      {t:'Ignorar completamente o contexto e encerrar a conversa.',good:false,response:'O auditor precisa manter objetividade e também compreender o contexto das operações.'}]}
  ];
  function interviewModal(){let d=interview[st.dialogStep];if(!d){setStage('planning');planningIntro();return;}
    // The second question changes according to how the student handled the initial inventory discrepancy.
    const line=st.dialogStep===1&&st.interviewPath[0]===false
      ?'Como você preferiu confiar inicialmente na explicação verbal, ainda não temos uma conciliação documentada. Há pressão para publicar as demonstrações e os empregados temem impactos na operação. Como conduzirá os próximos passos?'
      :st.dialogStep===1&&st.interviewPath[0]===true
        ?'Sua solicitação nos ajudou a localizar registros de contagem e entradas. Há pressão para publicar as demonstrações e os empregados temem impactos na operação. Como conduzirá os próximos passos?'
        :d.s;
    closeHudPanels();st.modal=false;$('#modal').hidden=true;st.dialogueOpen=true;$('#dialoguePanel').hidden=false;$('#dialoguePanel').scrollTop=0;$('#dialogueChoices').scrollTop=0;
    $('#dialogueSpeaker').textContent='MARCOS · GESTOR OPERACIONAL';$('#dialogueStep').textContent=`ENTREVISTA ${st.dialogStep+1} / ${interview.length}`;
    $('#dialogueChoices').innerHTML='';$('#dialogueContinue').hidden=true;$('#dialogueHint').textContent='Ouça o gestor; as opções aparecem quando a fala terminar.';
    typeSpeech(line,()=>{
      $('#dialogueHint').textContent='A fala terminou. Escolha sua resposta.';
      $('#dialogueChoices').innerHTML=d.opts.map((o,i)=>`<button class="dialogue-choice" data-choice="${i}"><strong>${String.fromCharCode(65+i)}</strong>${o.t}</button>`).join('');
      document.querySelectorAll('#dialogueChoices [data-choice]').forEach(b=>b.onclick=()=>{
        const answer=d.opts[+b.dataset.choice];st.interviewPath[st.dialogStep]=!!answer.good;if(answer.good)st.interviewScore++;
        $('#dialogueSpeaker').textContent='FEEDBACK PEDAGÓGICO';$('#dialogueStep').textContent=answer.good?'BOA CONDUÇÃO':'REVEJA A DECISÃO';$('#dialogueChoices').innerHTML='';
        $('#dialogueHint').textContent='Leia o retorno antes de continuar.';$('#dialogueContinue').hidden=true;
        stopSpeech();$('#dialogueText').textContent=answer.response;$('#dialogueHint').textContent=`${answer.good?'Boa condução.':'Use o feedback para revisar o julgamento.'} Continue para seguir.`;$('#dialogueContinue').hidden=false;
      });
    });
    $('#dialogueContinue').onclick=()=>{if(st.speaking)return;$('#dialogueContinue').hidden=true;if(st.dialogStep<interview.length-1){st.dialogStep++;interviewModal();}else{endDialogue();setStage('planning');planningIntro();}};
  }
  function planningIntro(){show(`<div class="modal-label">APRENDIZADO · PLANEJAMENTO</div><h2 id="modalTitle" class="modal-title">Amostragem e risco de auditoria</h2><p class="modal-desc">O risco de emitir uma opinião inadequada precisa orientar <b>onde, como e quanto testar</b>. Sua equipe tem recursos limitados. Por isso, você selecionará técnicas e estabelecerá metas de utilização.</p><div class="twoCol"><div class="miniCard"><h3>Risco elevado</h3><p>Divergências entre registros e existência física podem produzir distorção material nas demonstrações.</p></div><div class="miniCard"><h3>Plano flexível, orçamento fixo</h3><p>As metas são créditos alocados, não consumidos. Cada teste só consome seu custo quando realizado e usa o saldo disponível.</p></div></div><div class="notice">Se executar um teste além da meta ou em uma técnica com meta zero, o botão registra +1 mudança de plano e realiza o teste. A mudança não acrescenta créditos; o custo descontado é somente o do teste.</div><div class="buttons"><button class="primary" id="openPlan">Preparar meu plano →</button></div>`);$('#openPlan').onclick=planModal;}
  function planModal(){let total=planTotal();show(`<div class="modal-label">GESTÃO DE RISCOS · ORÇAMENTO DE TESTES</div><h2 id="modalTitle" class="modal-title">Seu plano de auditoria</h2><p class="modal-desc">Defina a <b>meta prevista</b> de cada técnica (0 a 3 testes) e sua prioridade. Os créditos alocados no plano não são consumidos: cada teste só reduz o saldo quando é executado. O orçamento total continua sendo 12 PT.</p><div class="tech-list">${techs.map(t=>`<div class="tech"><div><div class="name">${t.name}</div><div class="explain">${t.desc} • Custo: ${t.cost} PT por teste</div></div><div class="controls"><select class="priority" data-priority="${t.id}" aria-label="Prioridade de ${t.name}">${['Alta','Média','Baixa'].map(p=>`<option ${st.priority[t.id]===p?'selected':''}>${p}</option>`).join('')}</select><button data-dec="${t.id}" aria-label="Reduzir meta de ${t.name}">−</button><strong>${st.plan[t.id]}</strong><button data-inc="${t.id}" aria-label="Aumentar meta de ${t.name}">+</button></div></div>`).join('')}</div><div class="budget ${total>12?'over':''}"><div><small>CRÉDITOS ALOCADOS NO PLANO</small><br><strong>${total} de 12 pontos técnicos</strong></div><b>${Math.max(0,12-total)} PT sem alocação</b></div><p class="modal-desc" style="margin:0">Você pode escolher diferentes estratégias. O jogo avaliará os procedimentos pertinentes que efetivamente executar e a opinião final, não apenas a meta.</p><div class="buttons"><button class="ghost" id="backRisk">Rever conceitos</button><button class="primary" id="startExecution" ${total>12||total===0?'disabled':''}>Confirmar plano e entrar no galpão →</button></div>`);
    document.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{let k=b.dataset.inc;if(st.plan[k]<3)st.plan[k]++;planModal()});
    document.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{let k=b.dataset.dec;if(st.plan[k]>0)st.plan[k]--;planModal()});
    document.querySelectorAll('[data-priority]').forEach(b=>b.onchange=()=>{st.priority[b.dataset.priority]=b.value});
    $('#backRisk').onclick=planningIntro;
    $('#startExecution').onclick=()=>{hide();setStage('execution');note('Plano aprovado. Vá até um ponto de exame ◎');};}
  function objectiveMarkers(){return [
    {key:'interview',x:interviewTarget.x,z:interviewTarget.z,complete:st.stage!=='welcome'&&st.stage!=='interview'},
    ...techs.map(t=>({key:t.id,x:t.pos[0],z:t.pos[1],complete:st.executed[t.id]>=Math.max(1,st.plan[t.id])}))
  ];}
  function relevantSpots(){if(st.stage==='interview')return [{key:'interview',name:'Falar com o gestor',x:interviewTarget.x,z:interviewTarget.z,y:.05}];if(st.stage==='execution')return techs.map(t=>({key:t.id,name:t.place,x:t.pos[0],z:t.pos[1],y:.05}));return [];}
  function nearest(){let list=relevantSpots().map(h=>({...h,dist:engine?engine.distance(h.x,h.z):999})).sort((a,b)=>a.dist-b.dist);return list[0]||null;}
  function interact(h){if(!h)return;if(h.dist>2.85){note('Aproxime-se do local antes de interagir.');return;}if(h.key==='interview')interviewModal();else if(st.stage==='execution')procedureModal(h.key);}
  function guide(){if(!engine)return;if(st.stage==='welcome'){intro();return;}if(st.stage==='planning'){planModal();return;}if(st.stage==='report'){reportModal();return;}if(st.stage==='result'){resultModal();return;}
    let h;
    if(st.stage==='execution'){
      const remaining=st.budget-st.spent;
      let candidates=techs.filter(t=>st.executed[t.id]<st.plan[t.id]&&t.cost<=remaining);
      if(!candidates.length)candidates=techs.filter(t=>t.expected&&st.executed[t.id]===0&&t.cost<=remaining);
      if(!candidates.length)candidates=techs.filter(t=>st.executed[t.id]===0&&t.cost<=remaining);
      if(!candidates.length){note(remaining===0?'Saldo esgotado. Todos os testes possíveis foram concluídos; você pode emitir o relatório.':'Todos os objetivos de teste já foram concluídos. Você ainda pode repetir um exame manualmente se houver saldo ou emitir o relatório.');return;}
      const target=candidates.map(t=>({...t,distance:engine.distance(t.pos[0],t.pos[1])})).sort((a,b)=>a.distance-b.distance)[0];
      h={key:target.id,name:target.place,x:target.pos[0],z:target.pos[1]};
    }else h=nearest();
    if(!h)return;engine.faceTarget([h.x,h.z]);note(`Próximo objetivo: ${h.name}. Câmera e personagem apontados para ele; caminhe até o local.`);}
  function procedureModal(id){
    const t=techs.find(t=>t.id===id);if(!t)return;
    const remaining=st.budget-st.spent,unplanned=st.executed[id]>=st.plan[id],canRun=remaining>=t.cost;
    const status=remaining<t.cost
      ? `Saldo insuficiente: restam ${remaining} PT e este teste custa ${t.cost} PT.`
      : unplanned
        ? `Este teste está fora da meta. Ao clicar, ele será executado e consumirá ${t.cost} PT; o contador de mudanças de plano aumentará em 1. Isso não concede créditos adicionais.`
        : `Esta execução está dentro da meta alocada. Ela consumirá ${t.cost} PT do saldo efetivo.`;
    const action=unplanned
      ? remaining>0?`<button class="primary" id="procChange" ${canRun?'':'disabled'}>Executar teste e somar +1 ao contador de mudanças · −${t.cost} PT →</button>`:''
      : `<button class="primary" id="procGo" ${canRun?'':'disabled'}>Executar teste planejado · −${t.cost} PT →</button>`;
    show(`<div class="modal-label">EXECUÇÃO DE PROCEDIMENTOS · ${t.place.toUpperCase()}</div><h2 id="modalTitle" class="modal-title">${t.name}</h2><p class="modal-desc">${t.desc}</p><div class="twoCol"><div class="miniCard"><h3>Meta alocada</h3><p><b>${st.plan[id]} aplicação(ões)</b> · Prioridade ${st.priority[id]}</p></div><div class="miniCard"><h3>Execução real</h3><p><b>${st.executed[id]} teste(s)</b> · ${t.cost} PT por aplicação</p></div></div>${st.executed[id]>0?`<div class="evidence"><b>✓ Evidência já obtida</b>${t.finding}</div>`:''}<div class="notice">${status}<br>Plano alocado: ${planTotal()} PT · consumido: ${st.spent} PT · saldo disponível: ${remaining} PT.</div><div class="buttons"><button class="ghost" id="procClose">Voltar ao cenário</button>${action}</div>`);
    $('#procClose').onclick=hide;
    const complete=(registerChange)=>{
      const currentRemaining=st.budget-st.spent,currentUnplanned=st.executed[id]>=st.plan[id];
      if(currentRemaining<t.cost){note(`Saldo insuficiente: restam ${currentRemaining} PT e o teste custa ${t.cost} PT.`);procedureModal(id);return;}
      if(registerChange!==currentUnplanned){procedureModal(id);return;}
      if(registerChange)st.adjustments++;
      st.spent+=t.cost;st.executed[id]++;refresh();
      show(`<div class="modal-label">PAPEL DE TRABALHO · EVIDÊNCIA COLETADA</div><h2 id="modalTitle" class="modal-title">Procedimento concluído</h2><div class="evidence"><b>✓ ${t.name}</b>${t.finding}</div><div class="notice">O teste consumiu ${t.cost} PT. Plano alocado: ${planTotal()} PT · total consumido: ${st.spent} PT · saldo: ${st.budget-st.spent} PT.${registerChange?' A mudança de plano foi registrada sem crédito adicional.':''}</div><div class="buttons"><button class="ghost" id="backToProcedure">Rever procedimento</button><button class="primary" id="toScene">Continuar investigação →</button></div>`);
      $('#backToProcedure').onclick=()=>procedureModal(id);$('#toScene').onclick=()=>{hide();note('Evidência registrada! Você pode explorar outra área ou emitir o relatório.')};
    };
    const plannedButton=$('#procGo');if(plannedButton)plannedButton.onclick=()=>complete(false);
    const changeButton=$('#procChange');if(changeButton)changeButton.onclick=()=>complete(true);
  }
  function findingsHTML(){let got=techs.filter(t=>st.executed[t.id]>0);return got.length?got.map(t=>`<div class="evidence"><b>${t.name}</b>${t.finding}</div>`).join(''):'<div class="notice">Nenhuma evidência coletada. Sua decisão ficará sem sustentação; você ainda pode voltar para testar.</div>';}
  function reportModal(){setStage('report');show(`<div class="modal-label">ETAPA FINAL · OPINIÃO DE AUDITORIA</div><h2 id="modalTitle" class="modal-title">Qual opinião é apropriada?</h2><p class="modal-desc">Faça seu julgamento com base nas evidências que <b>você realmente obteve</b>. Não se confunda: distorção material não é, por si só, generalizada.</p><div class="notice"><b>Informação adicional da administração:</b> após sua investigação, a gestão foi informada do possível ajuste e declarou que manterá as demonstrações sem corrigi-lo. A missão considera que seus efeitos estão concentrados em estoques.</div><h3 style="color:#244a60;font-size:14px">Papel de trabalho — constatações</h3>${findingsHTML()}<h3 style="color:#244a60;font-size:14px;margin-top:19px">Selecione um dos quatro modelos</h3><div class="reportOptions">${opinions.map(o=>`<button class="opinion ${st.report===o.id?'selected':''}" data-opinion="${o.id}"><b>${o.name}</b><small>${o.subtitle}</small></button>`).join('')}</div><div class="buttons"><button class="ghost" id="returnExecution">Continuar exames</button><button class="primary" id="finalize" ${st.report?'':'disabled'}>Emitir opinião e ser avaliado →</button></div>`);
    document.querySelectorAll('[data-opinion]').forEach(b=>b.onclick=()=>{st.report=b.dataset.opinion;reportModal()});$('#returnExecution').onclick=()=>{hide();setStage('execution')};$('#finalize').onclick=finish;
  }
  function finish(){const coverage=pct(),opinionRight=st.report==='qualified',success=coverage>=70&&opinionRight;st.result={coverage,opinionRight,success,techniqueCount:completedTechs(),chosen:opinions.find(o=>o.id===st.report).name,score:Math.round(coverage*.75+(opinionRight?20:0)+st.interviewScore*2.5-Math.max(0,st.adjustments*2))};setStage('result');resultModal();let payload={case:'Aurora Distribuição S.A.',success,coverage,opinion:st.report,date:new Date().toISOString()};try{localStorage.setItem('SCAI_ALPHA01_LAST',JSON.stringify(payload))}catch(e){}try{parent.postMessage({type:'scai:completed',payload},'*')}catch(e){} }
  function resultModal(){let r=st.result;if(!r){intro();return;}
    const right=techs.filter(t=>t.expected&&st.executed[t.id]>0).map(t=>t.name);show(`<div class="modal-label">RESULTADO DA AUDITORIA · FASE 01</div><h2 id="modalTitle" class="modal-title">${r.success?'Missão concluída!':'Missão precisa de revisão'}</h2><span class="result-badge ${r.success?'':'fail'}">${r.success?'APROVADO':'REVISÃO NECESSÁRIA'}</span><p class="modal-desc" style="margin-top:12px">Você terminou o trabalho na Aurora Distribuição S.A. Agora veja os critérios, o que foi executado e como melhorar suas decisões.</p><div class="summaryTop"><div class="scorebox"><b>${r.coverage}%</b><span>Cobertura de técnicas pertinentes • mínimo 70%</span></div><div class="scorebox"><b>${r.opinionRight?'✓':'✕'}</b><span>Opinião final ${r.opinionRight?'adequada':'inadequada'}<br><strong>${r.chosen}</strong></span></div></div><div class="notice"><b>Gabarito comentado:</b> opinião <b>com ressalva</b>, pois a distorção de estoque é material (R$ 120 mil diante de materialidade de R$ 75 mil), mas seus efeitos são apresentados como <b>não generalizados</b>. A administração não efetuou o ajuste. O caso é simplificado para fins didáticos.</div><h3 style="font-size:15px">Comparativo: esperado × realizado</h3><div style="overflow-x:auto"><table class="comparison"><thead><tr><th>Técnica</th><th>Meta</th><th>Executado</th><th>Esperado</th></tr></thead><tbody>${techs.map(t=>`<tr><td><b>${t.short}</b></td><td>${st.plan[t.id]}</td><td>${st.executed[t.id]}</td><td>${t.expected?(st.executed[t.id]>0?'✓ Aplicada':'◯ Faltou'):'Complementar'}</td></tr>`).join('')}</tbody></table></div><div class="feedback ${r.success?'':'warn'}">${r.success?'Sua escolha de opinião e a cobertura mínima de 70% foram atendidas. Compare as prioridades para aprimorar sua eficiência.':'Nesta missão, é necessário emitir o relatório adequado E executar pelo menos 70% das quatro técnicas relevantes. Acertar a opinião por acaso não basta.'}</div><div class="notice"><b>Aspectos para refletir:</b> ${r.coverage<100?'faltaram técnicas relevantes; reveja o risco de existência e valorização do estoque. ':'você cobriu todas as técnicas essenciais. '}${!r.opinionRight?'Diferencie distorção material não generalizada (ressalva), distorção generalizada (adversa) e impossibilidade de evidência suficiente (abstenção). ':'A escolha da ressalva corresponde ao cenário didático. '}Plano alocado: ${planTotal()} PT; consumido: ${st.spent} de ${st.budget} PT; registrou ${st.adjustments} mudança(s) de plano.</div><div class="buttons"><button class="ghost" id="reviewConcepts">Rever conceitos</button><button class="primary" id="retryMission">${r.success?'Refazer para testar outra estratégia':'Tentar novamente'} ↻</button></div>`);
    $('#reviewConcepts').onclick=()=>{show(`<div class="modal-label">GUIA DIDÁTICO · APRENDIZADO</div><h2 id="modalTitle" class="modal-title">Como interpretar as quatro opiniões</h2><div class="tech-list"><div class="miniCard"><h3>Não modificada (sem ressalva)</h3><p>Demonstrações livres de distorção relevante, em todos os aspectos materiais, conforme a estrutura aplicável.</p></div><div class="miniCard"><h3>Com ressalva</h3><p>Distorção material, mas não generalizada, ou limitação de evidência cujos possíveis efeitos sejam materiais, mas não generalizados.</p></div><div class="miniCard"><h3>Adversa</h3><p>Distorções materiais e generalizadas, sustentadas por evidência suficiente e apropriada.</p></div><div class="miniCard"><h3>Abstenção</h3><p>Não é possível obter evidência suficiente e apropriada e os possíveis efeitos podem ser materiais e generalizados.</p></div></div><div class="buttons"><button class="primary" id="backResult">Voltar à avaliação</button></div>`);$('#backResult').onclick=resultModal;};
    $('#retryMission').onclick=()=>location.reload();
  }
  function updateNearbyAction(){if(!engine)return;const spots=relevantSpots();const nearby=spots.map(h=>({...h,dist:engine.distance(h.x,h.z)})).sort((a,b)=>a.dist-b.dist);near=nearby[0]||null;
    if(st.modal||st.dialogueOpen){$('#action').classList.remove('visible');return;}
    $('#action').classList.toggle('visible',!!near&&near.dist<=2.85);if(near){$('#actionTitle').textContent=near.name;$('#actionSubtitle').textContent=st.stage==='interview'?'Converse e escolha respostas':'Pressione E para executar se houver saldo';}
    $('#location').textContent=engine.player.x>0?'● Centro de distribuição':'● Escritório de auditoria';}
  let refreshTimer=0;
  function bindTouchControls() {
    const pressedPointers = new Map();
    const release = event => {
      const pressed = pressedPointers.get(event.pointerId);
      if (!pressed) return;
      if (event.cancelable) event.preventDefault();
      pressedPointers.delete(event.pointerId);
      const stillPressed = [...pressedPointers.values()].some(input => input.key === pressed.key);
      engine.setInput(pressed.key, stillPressed);
    };
    const reset = () => {
      const pressed = [...pressedPointers.entries()];
      pressedPointers.clear();
      for (const [pointerId, input] of pressed) {
        engine.setInput(input.key, false);
        if (input.button.hasPointerCapture?.(pointerId)) input.button.releasePointerCapture(pointerId);
      }
    };
    document.querySelectorAll('#touchControls [data-key]').forEach(button => {
      button.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        pressedPointers.set(event.pointerId, {key: button.dataset.key, button});
        engine.setInput(button.dataset.key, true);
        button.setPointerCapture?.(event.pointerId);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(type, release);
      }
    });
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) reset();
    });
    for (const type of ['selectstart', 'contextmenu', 'dragstart']) {
      $('#game').addEventListener(type, event => {
        const editable = event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
        if (!editable) event.preventDefault();
      });
    }
  }
  function boot(){bindHudPanels();try{engine=new SCAI3D.Engine($('#scene'),{isBlocked:()=>st.modal||st.dialogueOpen,isTalking:()=>st.speaking,isDialogueOpen:()=>st.dialogueOpen,onInteract:()=>{if(!st.modal&&!st.dialogueOpen)interact(near)},onFrame:(e)=>{refreshTimer++;if(refreshTimer%6===0)updateNearbyAction()}});}
    catch(e){console.error(e);$('#fallback').hidden=false;$('#fallback').style.display='grid';return;}
    $('#quality').onclick=()=>{engine.setEco(!engine.low);$('#quality').textContent=engine.low?'⚙ Eco ✓':'⚙ Eco';note(engine.low?'Modo econômico: resolução reduzida e até 30 FPS.':'Qualidade padrão ativada.')};
    $('#exit').onclick=()=>{if(window.parent!==window){parent.postMessage({type:'scai:exit'},'*')}else location.href='../SCAI.html'};
    $('#actionBtn').onclick=()=>interact(near);$('#routeBtn').onclick=()=>{closeHudPanels();guide();};$('#reportBtn').onclick=reportModal;$('#modalClose').onclick=()=>{hide();if(st.stage==='welcome')setStage('interview')};
    bindTouchControls();
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&st.modal&&st.stage!=='result')hide();});
    intro();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
