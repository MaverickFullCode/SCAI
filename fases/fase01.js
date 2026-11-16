/* SCAI — Fase Alpha 01. Um caso completo de ensino, decisão, evidências e feedback. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const stageNames=['Introdução','Entrevista','Planejamento','Execução','Opinião','Avaliação'];
  const techs=[
    {id:'docs',name:'Conferir documentos',short:'Documentos',cost:2,weight:25,place:'Mesa de documentos',pos:[-4.3,2.8],desc:'Compare notas de entrada com o que foi registrado no estoque.',finding:'As notas de entrada não justificam todo o estoque registrado. A diferença não foi explicada pelos documentos.',why:'Os documentos mostram se as entradas registradas têm comprovação.',expected:true},
    {id:'count',name:'Contar mercadorias',short:'Contagem',cost:3,weight:35,place:'Estoque físico',pos:[5.1,-.55],desc:'Conte os produtos e compare a quantidade com o sistema.',finding:'O sistema registra 1.200 unidades, mas há 1.080 no galpão: faltam 120 unidades em relação ao registro.',why:'A contagem confirma o que realmente existe; o sistema sozinho não comprova isso.',expected:true},
    {id:'recalc',name:'Calcular a diferença',short:'Cálculo',cost:2,weight:30,place:'Mesa de cálculo',pos:[-8.8,2.8],desc:'Confira os cálculos para medir o valor da possível diferença.',finding:'O estoque foi registrado por R$ 120 mil a mais. Neste caso, erros acima de R$ 75 mil podem mudar a decisão de quem lê as contas: a diferença é relevante.',why:'Medir o valor mostra se o erro é grande o bastante para afetar a conclusão.',expected:true},
    {id:'analytics',name:'Comparar os indicadores',short:'Indicadores',cost:1,weight:10,place:'Painel de indicadores',pos:[-3.4,-4.45],desc:'Compare a evolução do estoque com a das vendas.',finding:'O valor do estoque cresceu 24%, mas as vendas só 3%. É um sinal de alerta, que precisa ser confirmado com documentos, contagem e cálculo.',why:'A comparação aponta algo incomum, mas não prova sozinha que há erro.',expected:true},
    {id:'confirm',name:'Consultar o fornecedor',short:'Fornecedor',cost:3,weight:0,place:'Terminal de fornecedores',pos:[14.15,1.4],desc:'Peça ao fornecedor que confirme as entregas selecionadas.',finding:'O fornecedor confirmou as entregas consultadas. Isso não mostra quantos produtos ainda estão no galpão nem explica a diferença atual.',why:'Confirmar entregas é útil em outros casos, mas aqui não resolve a dúvida sobre o estoque atual.',expected:false}
  ];
  const interviewTarget={x:-10.7,z:-.80};
  const opinions=[
    {id:'clean',name:'Sem ressalva (não modificada)',subtitle:'Há provas suficientes e nenhum erro relevante nas contas.'},
    {id:'qualified',name:'Com ressalva',subtitle:'Há um problema relevante, ou falta de provas, com efeitos limitados nas contas.'},
    {id:'adverse',name:'Adversa',subtitle:'As provas mostram erros relevantes que comprometem as contas como um todo.'},
    {id:'disclaimer',name:'Abstenção de opinião',subtitle:'Faltam provas e os possíveis problemas podem comprometer as contas como um todo.'}
  ];
  const st={stage:'welcome',dialogStep:0,dialogReply:null,interviewScore:0,interviewPath:[],plan:Object.fromEntries(techs.map(t=>[t.id,0])),executed:Object.fromEntries(techs.map(t=>[t.id,0])),spent:0,budget:8,adjustments:0,adjustmentOpen:false,report:null,modal:false,dialogueOpen:false,speaking:false,result:null};
  const SPEECH_CPS=30;
  function shuffleResponses(options){
    const shuffled=options.slice();
    for(let i=shuffled.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    return shuffled;
  }
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
  function show(html){closeHudPanels();$('#modalBody').innerHTML=inner(html);$('#modal').hidden=false;st.modal=true;$('.modalCard')?.scrollTo(0,0);}
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
  const credits=n=>`${n} ${n===1?'crédito':'créditos'}`;
  const planTotal=()=>techs.reduce((s,t)=>s+st.plan[t.id]*t.cost,0);
  const usedCount=()=>Object.values(st.executed).reduce((a,b)=>a+b,0);
  const completedTechs=()=>techs.filter(t=>t.expected&&st.executed[t.id]>0).length;
  const pct=()=>techs.reduce((sum,t)=>sum+(st.executed[t.id]>0?t.weight:0),0);
  function setStage(stage){st.stage=stage;refresh();}
  function refresh(){engine?.renderer.setMarkers(objectiveMarkers());const idx={welcome:0,interview:1,planning:2,execution:3,report:4,result:5}[st.stage];
    $('#stagebar').innerHTML=stageNames.map((t,i)=>{
      const done=i<idx||(i===idx&&st.stage==='result'&&st.result?.success===true);
      return `<span class="${done?'done':i===idx?'current':''}">${done?'✓ ':''}${t}</span>`;
    }).join('');
    const o={welcome:['Investigue o estoque','Descubra se as mercadorias e os valores registrados estão corretos.'],interview:['Converse com Marcos','Vá ao gestor, na sala de reunião. Aproxime-se e use Q ou Interagir.'],planning:['Escolha seus testes','Você tem 8 créditos. Selecione cada teste que pretende fazer uma vez.'],execution:['Confira os registros e o estoque','Vá aos círculos laranja. Use Q ou Interagir para abrir um teste; verde indica concluído.'],report:['Escolha sua conclusão','Releia os resultados e indique o que deve constar no relatório.'],result:['Veja o que aprendeu','Confira sua conclusão e os testes que ajudaram a explicar a diferença.']}[st.stage];
    $('#objectiveTitle').textContent=o[0];$('#objectiveText').textContent=o[1];$('#missionProgress span').style.width=[8,19,39,65,83,100][idx]+'%';$('#pointsText').textContent=`${credits(st.budget-st.spent)}`;
    $('#missionTip').textContent=st.stage==='execution'?'Localizar objetivo aponta o caminho; você precisa caminhar.':'WASD: andar · arrastar: câmera · Q: missão · E: cadeira/porta';
    $('#reportBtn').hidden=st.stage!=='execution';let q='';
    if(st.stage==='welcome'||st.stage==='interview')q='Primeiro, ouça o gestor. Depois, escolha como investigar.';
    if(st.stage==='planning')q=`Planejado: <b>${planTotal()} de ${st.budget} créditos</b><br>Escolher não gasta; executar gasta.`;
    if(st.stage==='execution')q=`<b>${usedCount()} testes concluídos</b><br>Gasto: ${st.spent} · saldo: <b>${credits(st.budget-st.spent)}</b><br>Verde: resultado disponível, sem novo custo.`;
    if(st.stage==='report'||st.stage==='result')q=`${usedCount()} testes concluídos · ${st.spent} créditos gastos.<br>Confira os resultados antes de concluir.`;

    $('#quickContent').innerHTML=q;
  }
  function intro(){setStage('welcome');show(`<div class="modal-label">MISSÃO 01 · ESTOQUE</div><h2 id="modalTitle" class="modal-title">O sistema diz uma coisa. O galpão, outra.</h2><p class="modal-desc">Você foi contratado para conferir o estoque da Aurora. Seu papel é buscar provas antes de concluir se as contas estão corretas.</p><div class="twoCol"><div class="miniCard"><h3>1 · Ouça e planeje</h3><p>Converse com Marcos. Escolha testes dentro dos 8 créditos disponíveis.</p></div><div class="miniCard"><h3>2 · Confira e conclua</h3><p>Faça os testes nos círculos laranja. Reúna os resultados e escolha seu relatório.</p></div></div><div class="notice"><b>Como jogar:</b> WASD para andar; arraste para girar a câmera. Q conversa ou abre testes. E senta, levanta e abre ou fecha a porta. F consulta o tablet por 3 segundos, apenas como animação. No celular, use os botões na tela.<br>Missão e Trabalho mostram sua tarefa e saldo. Localizar objetivo aponta o caminho, sem mover você. Você pode errar e tentar novamente.</div><div class="buttons"><button class="primary" id="startMission">Procurar Marcos →</button></div>`);$('#startMission').onclick=()=>{hide();setStage('interview');note('Encontre Marcos na sala de reunião. Use Localizar objetivo para se orientar.');};}

  const interview=[
    {s:'Bom dia! Nossa contagem encontrou menos produtos do que o sistema registra. Pode ser uma falha na contagem ou nos registros. Por onde você começaria?',opts:[
      {t:'Comparar os registros e verificar como a contagem foi feita.',good:true,response:'Você acertou: as duas fontes podem conter erros. Conferir os registros e a forma de contar ajuda a descobrir a causa antes de propor um ajuste.'},
      {t:'Repetir a contagem e usar o novo total para corrigir o sistema.',good:false,response:'Recontar ajuda, mas ainda não explica a diferença: entradas ou saídas podem ter sido registradas errado. Confira também os documentos antes de decidir o ajuste.'},
      {t:'Conferir as últimas entregas e corrigir apenas as entradas divergentes.',good:false,response:'As entregas são uma pista útil, mas o problema também pode estar nas saídas ou na contagem. Investigar só as entradas pode deixar a causa sem explicação.'}]},
    {s:'Precisamos publicar as contas nesta semana. A equipe teme atrasos e diz que pode corrigir o estoque depois. Como você organiza o trabalho?',opts:[
      {t:'Combinar um prazo para conferir a diferença e só então concluir o relatório.',good:true,response:'Você acertou: combinar prazos ajuda a equipe sem antecipar a conclusão. O relatório depende das provas e de saber se a empresa corrigiu o erro.'},
      {t:'Concluir agora, desde que o gestor assuma por escrito a correção posterior.',good:false,response:'O compromisso por escrito registra a promessa, mas não comprova que as contas atuais estão corretas. Confira o problema e a correção antes de concluir.'},
      {t:'Adiar a publicação até conferir todo o estoque, mesmo sem sinais de outros erros.',good:false,response:'Ampliar testes pode ser necessário, mas exigir uma revisão de tudo antes de avaliar o risco desperdiça tempo. Comece pela diferença identificada e amplie se os resultados pedirem.'}]}
  ];
  function interviewModal(){let d=interview[st.dialogStep];if(!d){setStage('planning');planningIntro();return;}
    // The second question changes according to how the student handled the initial inventory discrepancy.
    const line=st.dialogStep===1
      ? `${st.interviewPath[0]?'Vamos separar os registros para a conferência.':'Ainda precisamos esclarecer a causa da diferença.'} ${d.s}`
      :d.s;
    closeHudPanels();st.modal=false;$('#modal').hidden=true;st.dialogueOpen=true;$('#dialoguePanel').hidden=false;$('#dialoguePanel').scrollTop=0;$('#dialogueChoices').scrollTop=0;
    $('#dialogueSpeaker').textContent='MARCOS · GESTOR OPERACIONAL';$('#dialogueStep').textContent=`ENTREVISTA ${st.dialogStep+1} / ${interview.length}`;
    $('#dialogueChoices').innerHTML='';$('#dialogueContinue').hidden=true;$('#dialogueHint').textContent='Ouça o gestor; as opções aparecem quando a fala terminar.';
    typeSpeech(line,()=>{
      const options=shuffleResponses(d.opts);
      $('#dialogueHint').textContent='A fala terminou. Escolha sua resposta.';
      $('#dialogueChoices').innerHTML=options.map((o,i)=>`<button class="dialogue-choice" data-choice="${i}"><strong>${String.fromCharCode(65+i)}</strong>${o.t}</button>`).join('');
      document.querySelectorAll('#dialogueChoices [data-choice]').forEach(b=>b.onclick=()=>{
        const answer=options[+b.dataset.choice];st.interviewPath[st.dialogStep]=!!answer.good;if(answer.good)st.interviewScore++;
        $('#dialogueSpeaker').textContent='SUA DECISÃO';$('#dialogueStep').textContent=answer.good?'BOM CAMINHO':'VEJA O QUE FALTOU';$('#dialogueChoices').innerHTML='';
        $('#dialogueHint').textContent='Leia o retorno antes de continuar.';$('#dialogueContinue').hidden=true;
        stopSpeech();$('#dialogueText').textContent=answer.response;$('#dialogueHint').textContent=`${answer.good?'Resposta adequada.':'Veja o motivo da correção.'} Continue para seguir.`;$('#dialogueContinue').hidden=false;
      });
    });
    $('#dialogueContinue').onclick=()=>{if(st.speaking)return;$('#dialogueContinue').hidden=true;if(st.dialogStep<interview.length-1){st.dialogStep++;interviewModal();}else{endDialogue();setStage('planning');planningIntro();}};
  }
  function planningIntro(){show(`<div class="modal-label">ANTES DE INVESTIGAR</div><h2 id="modalTitle" class="modal-title">O que vale a pena conferir?</h2><p class="modal-desc">Há menos produtos do que o sistema informa. Seu plano é a lista de testes que você pretende usar para entender essa diferença.</p><div class="notice">Você tem <b>8 créditos</b>, suficientes para os quatro testes úteis ao caso. Leia o que cada teste verifica: nem toda opção ajuda a resolver esta dúvida.<br>Cada teste pode ser feito <b>uma única vez</b>. Selecionar no plano não gasta créditos; executar gasta. Consultar um resultado já obtido é grátis.</div><p class="modal-desc">Você pode executar algo fora do plano se ainda tiver saldo. Isso registra uma mudança, sem conceder créditos ou descontar nota. Gastar em um teste pouco útil pode deixar créditos insuficientes para outro.</p><div class="buttons"><button class="primary" id="openPlan">Escolher testes →</button></div>`);$('#openPlan').onclick=planModal;}
  function planModal(){const total=planTotal();show(`<div class="modal-label">PLANO · 8 CRÉDITOS</div><h2 id="modalTitle" class="modal-title">Escolha o que vai conferir</h2><p class="modal-desc">Marque o que vai conferir. Cada teste dá um resultado único. Se uma opção não couber nos 8 créditos, desmarque outra para trocar.</p><div class="tech-list">${techs.map(t=>`<div class="tech"><div><div class="name">${t.name}</div><div class="explain">${t.desc} · ${credits(t.cost)}</div></div><label class="plan-choice"><input type="checkbox" aria-label="Incluir ${t.name} no plano" data-plan="${t.id}" ${st.plan[t.id]?'checked':''} ${!st.plan[t.id]&&total+t.cost>st.budget?'disabled':''}/> Incluir</label></div>`).join('')}</div><div class="budget"><div><small>CUSTO DO PLANO</small><br><strong>${total} de ${st.budget} créditos</strong></div><b>${st.budget-total} livres</b></div><p class="modal-desc">Para concluir a missão, reúna os quatro resultados úteis e escolha um relatório coerente com eles. A avaliação explica o papel de cada teste.</p><div class="buttons"><button class="ghost" id="backRisk">Como funciona?</button><button class="primary" id="startExecution" ${total===0?'disabled':''}>Confirmar e investigar →</button></div>`);
    document.querySelectorAll('[data-plan]').forEach(b=>b.onchange=()=>{const t=techs.find(t=>t.id===b.dataset.plan);if(b.checked&&planTotal()+t.cost>st.budget)return;const scroll=$('.modalCard').scrollTop;st.plan[t.id]=b.checked?1:0;refresh();planModal();$('.modalCard').scrollTop=scroll;document.querySelector(`[data-plan="${t.id}"]`)?.focus({preventScroll:true});});
    $('#backRisk').onclick=planningIntro;
    $('#startExecution').onclick=()=>{if(!planTotal()||planTotal()>st.budget)return;hide();setStage('execution');note('Vá aos círculos laranja e use Q ou Interagir.');};}

  function objectiveMarkers(){return [
    {key:'interview',x:interviewTarget.x,z:interviewTarget.z,complete:st.stage!=='welcome'&&st.stage!=='interview'},
    ...techs.map(t=>({key:t.id,x:t.pos[0],z:t.pos[1],complete:st.executed[t.id]>0}))
  ];}
  function relevantSpots(){if(st.stage==='interview')return [{key:'interview',name:'Falar com o gestor',x:interviewTarget.x,z:interviewTarget.z,y:.05}];if(st.stage==='execution')return techs.map(t=>({key:t.id,name:t.place,x:t.pos[0],z:t.pos[1],y:.05}));return [];}
  function nearest(){let list=relevantSpots().map(h=>({...h,dist:engine?engine.distance(h.x,h.z):999})).sort((a,b)=>a.dist-b.dist);return list[0]||null;}
  function interact(h){if(st.modal||st.dialogueOpen)return;if(engine?.tabletRead){note('Aguarde a consulta do tablet terminar.');return;}if(engine?.seating){note('Pressione E ou toque em Levantar antes de continuar a missão.');return;}if(!h)return;if(h.dist>2.85){note('Aproxime-se do local antes de interagir.');return;}if(h.key==='interview')interviewModal();else if(st.stage==='execution')procedureModal(h.key);}
  function guide(){if(!engine)return;if(engine.tabletRead){note('Aguarde a consulta do tablet terminar.');return;}if(engine.seating){note('Levante-se da cadeira para localizar o próximo objetivo.');return;}if(st.stage==='welcome'){intro();return;}if(st.stage==='planning'){planModal();return;}if(st.stage==='report'){reportModal();return;}if(st.stage==='result'){resultModal();return;}
    let h;
    if(st.stage==='execution'){
      const remaining=st.budget-st.spent;
      let candidates=techs.filter(t=>st.executed[t.id]<st.plan[t.id]&&t.cost<=remaining);
      if(!candidates.length)candidates=techs.filter(t=>t.expected&&st.executed[t.id]===0&&t.cost<=remaining);
      if(!candidates.length)candidates=techs.filter(t=>st.executed[t.id]===0&&t.cost<=remaining);
      if(!candidates.length){note(remaining===0?'Sem créditos. Reveja os resultados e escolha seu relatório.':'Não há teste pendente que caiba no saldo. Reveja os resultados e escolha seu relatório.');return;}
      const target=candidates.map(t=>({...t,distance:engine.distance(t.pos[0],t.pos[1])})).sort((a,b)=>a.distance-b.distance)[0];
      h={key:target.id,name:target.place,x:target.pos[0],z:target.pos[1]};
    }else h=nearest();
    if(!h)return;engine.faceTarget([h.x,h.z]);note(`Próximo objetivo: ${h.name}. Câmera e personagem apontados para ele; caminhe até o local.`);}
  function procedureModal(id){
    const t=techs.find(t=>t.id===id);if(!t)return;
    const remaining=st.budget-st.spent,done=st.executed[id]>0,unplanned=!st.plan[id],canRun=!done&&remaining>=t.cost;
    const actionId=unplanned?'procChange':'procGo';
    show(`<div class="modal-label">${t.place.toUpperCase()}</div><h2 id="modalTitle" class="modal-title">${t.name}</h2><p class="modal-desc">${t.desc}</p>${done?`<div class="evidence"><b>✓ Resultado registrado</b>${t.finding}</div><p class="modal-desc">Consulta gratuita. Repetir este teste não traria informações novas.</p>`:`<div class="notice">Custo: <b>${credits(t.cost)}</b> · saldo: <b>${remaining}</b>.<br>${canRun?(unplanned?'Não estava no plano. Executar registra 1 mudança, sem créditos extras.':'Está no seu plano. Os créditos só serão gastos ao executar.'):'Seu saldo não cobre este teste. Você pode concluir com o que reuniu ou reiniciar a missão.'}</div>`}<div class="buttons"><button class="ghost" id="procClose">Voltar ao ambiente</button>${!done?`<button class="primary" id="${actionId}" ${canRun?'':'disabled'}>${unplanned?'Executar e registrar mudança':'Executar teste'} · ${credits(t.cost)} →</button>`:''}</div>`);
    $('#procClose').onclick=hide;
    if(done)return;
    $('#'+actionId).onclick=()=>{
      if(st.stage!=='execution'||st.executed[id]>0||st.budget-st.spent<t.cost)return;
      if(unplanned)st.adjustments++;
      st.spent+=t.cost;st.executed[id]=1;refresh();
      show(`<div class="modal-label">TESTE CONCLUÍDO</div><h2 id="modalTitle" class="modal-title">O que você descobriu</h2><div class="evidence"><b>✓ ${t.name}</b>${t.finding}</div><p class="modal-desc">Gasto: ${credits(t.cost)} · saldo: ${st.budget-st.spent}. O resultado fica salvo para a conclusão.</p><div class="buttons"><button class="ghost" id="backToProcedure">Rever resultado</button><button class="primary" id="toScene">Voltar à investigação →</button></div>`);
      $('#backToProcedure').onclick=()=>procedureModal(id);$('#toScene').onclick=()=>{hide();note('Resultado salvo. Procure outro teste ou escolha seu relatório.');};
    };
  }

  function findingsHTML(){let got=techs.filter(t=>st.executed[t.id]>0);return got.length?got.map(t=>`<div class="evidence"><b>${t.name}</b>${t.finding}</div>`).join(''):'<div class="notice">Você ainda não fez testes. Volte à investigação para reunir provas antes de concluir.</div>';}
  function reportModal(){setStage('report');show(`<div class="modal-label">RELATÓRIO FINAL</div><h2 id="modalTitle" class="modal-title">O que as provas permitem concluir?</h2><p class="modal-desc">Releia o que descobriu. Um erro é relevante quando pode mudar a decisão de quem usa as contas. Ele pode ter efeitos limitados ou comprometer as contas como um todo.</p><div class="notice"><b>Resposta da empresa:</b> a gestão manterá os valores sem correção. Neste caso, os possíveis efeitos ficam limitados ao estoque e não comprometem as contas como um todo.</div><h3>Seus resultados</h3>${findingsHTML()}<h3>Escolha a conclusão do relatório</h3><div class="reportOptions">${opinions.map(o=>`<button class="opinion ${st.report===o.id?'selected':''}" data-opinion="${o.id}"><b>${o.name}</b><small>${o.subtitle}</small></button>`).join('')}</div><div class="buttons"><button class="ghost" id="returnExecution">Voltar aos testes</button><button class="primary" id="finalize" ${st.report?'':'disabled'}>Concluir e ver avaliação →</button></div>`);
    document.querySelectorAll('[data-opinion]').forEach(b=>b.onclick=()=>{st.report=b.dataset.opinion;reportModal();});$('#returnExecution').onclick=()=>{hide();setStage('execution');};$('#finalize').onclick=finish;
  }
  function finish(){if(!st.report)return;const coverage=pct(),opinionRight=st.report==='qualified',success=coverage===100&&opinionRight;st.result={coverage,opinionRight,success,techniqueCount:completedTechs(),chosen:opinions.find(o=>o.id===st.report).name,score:Math.round(coverage*.8+(opinionRight?15:0)+st.interviewScore*2.5)};setStage('result');resultModal();const payload={case:'Aurora Distribuição S.A.',success,coverage,opinion:st.report,score:st.result.score,date:new Date().toISOString()};try{localStorage.setItem('SCAI_ALPHA01_LAST',JSON.stringify(payload));parent.postMessage({type:'scai:completed',payload},'*');}catch(e){} }
  function resultModal(){const r=st.result;if(!r){intro();return;}
    const reasons={clean:'Sem ressalva não cabe: o erro de R$ 120 mil é relevante e não foi corrigido.',qualified:'Com ressalva cabe: há um erro relevante, não corrigido, mas com efeitos limitados ao estoque.',adverse:'Adversa exigiria que o erro comprometesse as contas como um todo. Neste caso, os efeitos são limitados.',disclaimer:'Abstenção é usada quando faltam provas com possíveis efeitos amplos. O caso permite comprovar e medir um erro limitado ao estoque.'};
    show(`<div class="modal-label">AVALIAÇÃO</div><h2 id="modalTitle" class="modal-title">${r.success?'Missão concluída!':'Veja o que falta melhorar'}</h2><div class="summaryTop"><div class="scorebox"><b>${r.score}/100</b><span>${Math.round(r.coverage*.8)}/80 testes · ${r.opinionRight?15:0}/15 relatório · ${st.interviewScore*2.5}/5 entrevista</span></div><div class="scorebox"><b>${completedTechs()}/4</b><span>Testes úteis concluídos</span></div></div><div class="feedback ${r.opinionRight?'':'warn'}"><b>Seu relatório: ${r.chosen}.</b> ${reasons[st.report]}</div><p class="modal-desc">R$ 120 mil supera o limite de R$ 75 mil definido neste caso. A empresa não corrigiu o erro. Por isso, o relatório deve destacar esse problema com uma ressalva.</p><h3>O que cada teste acrescentou</h3><div class="tech-list">${techs.map(t=>`<div class="miniCard"><h3>${st.executed[t.id]?'✓ Feito':'○ Não feito'} · ${t.name} · ${t.weight}% do peso dos testes</h3><p>${t.why}</p></div>`).join('')}</div><p class="modal-desc">${r.success?'Você reuniu os quatro resultados úteis e escolheu a conclusão adequada.':`Para concluir, reúna os quatro resultados úteis e escolha um relatório coerente. ${completedTechs()<4?'Faltaram: '+techs.filter(t=>t.expected&&!st.executed[t.id]).map(t=>t.short).join(', ')+'.':''}`}<br>Gasto: ${st.spent} de 8 créditos · mudanças de plano: ${st.adjustments} (sem desconto na nota).</p><div class="buttons"><button class="ghost" id="reviewConcepts">Entender os relatórios</button><button class="primary" id="retryMission">Jogar novamente ↻</button></div>`);
    $('#reviewConcepts').onclick=()=>{show(`<div class="modal-label">GUIA RÁPIDO</div><h2 id="modalTitle" class="modal-title">Quatro conclusões possíveis</h2><p class="modal-desc">Primeiro, pergunte: tenho provas? Depois: o problema é relevante e até onde afeta as contas?</p><div class="tech-list">${opinions.map(o=>`<div class="miniCard"><h3>${o.name}</h3><p>${o.subtitle}</p></div>`).join('')}</div><div class="notice">Com ressalva também pode ser usada quando faltam provas, mas os possíveis efeitos são relevantes e limitados. No caso da Aurora, há provas de um erro não corrigido. Estas situações são simplificadas para aprender.</div><div class="buttons"><button class="primary" id="backResult">Voltar à avaliação</button></div>`);$('#backResult').onclick=resultModal;};
    $('#retryMission').onclick=()=>location.reload();
  }

  function updateNearbyAction(){if(!engine)return;const spots=relevantSpots();const nearby=spots.map(h=>({...h,dist:engine.distance(h.x,h.z)})).sort((a,b)=>a.dist-b.dist);near=nearby[0]||null;
    const blocked=st.modal||st.dialogueOpen;
    let physical=blocked?null:engine.physicalAction?.();
    if(physical&&engine.seating?.phase==='aligning')physical={...physical,label:'Posicionando…',hint:'Aguarde o auditor se posicionar para sentar.',disabled:true};
    if(physical&&engine.seating?.phase==='leaving')physical={...physical,label:'Saindo…',hint:'Aguarde o auditor se afastar da cadeira.',disabled:true};
    $('#actionBtn').disabled=!!(engine.seating||engine.tabletRead);$('#reportBtn').disabled=!!(engine.seating||engine.tabletRead);
    $('#tabletBtn').disabled=blocked||!!engine.tabletRead||!!(engine.seating&&engine.seating.phase!=='seated');
    if(physical&&engine.tabletRead)physical={...physical,disabled:true};
    $('#action').classList.toggle('visible',!blocked&&!engine.seating&&!!near&&near.dist<=2.85);
    if(near){$('#actionTitle').textContent=near.name;$('#actionSubtitle').textContent=st.stage==='interview'?'Pressione Q para conversar':'Q ou Interagir: abrir teste ou rever resultado';}
    $('#physicalAction').classList.toggle('visible',!!physical);
    if(physical){
      $('#physicalTitle').textContent=physical.title;$('#physicalSubtitle').textContent=physical.hint||'Pressione E ou toque no botão.';
      $('#physicalBtn').textContent=physical.label;$('#physicalBtn').disabled=!!physical.disabled;
      $('#physicalBtn').setAttribute('aria-label',`${physical.label}: ${physical.title}`);
    }
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
      // Cancel the native long press before its menu/haptic feedback starts.
      // Preventing pointerdown alone does not cancel the browser's touch gesture.
      button.addEventListener('touchstart', event => {
        if (event.cancelable) event.preventDefault();
      }, {passive: false});
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
  function boot(){bindHudPanels();try{engine=new SCAI3D.Engine($('#scene'),{isBlocked:()=>st.modal||st.dialogueOpen,isTalking:()=>st.speaking,isDialogueOpen:()=>st.dialogueOpen,onInteract:()=>{if(!st.modal&&!st.dialogueOpen&&!engine?.seating)interact(near)},onNotice:note,onFrame:(e)=>{refreshTimer++;if(refreshTimer%6===0)updateNearbyAction()}});}
    catch(e){console.error(e);$('#fallback').hidden=false;$('#fallback').style.display='grid';return;}
    $('#quality').onclick=()=>{engine.setEco(!engine.low);$('#quality').textContent=engine.low?'⚙ Eco ✓':'⚙ Eco';note(engine.low?'Modo econômico: imagem mais simples para jogar com mais fluidez.':'Imagem em qualidade padrão.')};
    $('#exit').onclick=()=>{if(window.parent!==window){parent.postMessage({type:'scai:exit'},'*')}else location.href='../SCAI.html'};
    $('#tabletBtn').onclick=()=>{engine.consultTablet();updateNearbyAction();};$('#actionBtn').onclick=()=>interact(near);$('#physicalBtn').onclick=()=>{if(st.modal||st.dialogueOpen)return;engine.usePhysical();updateNearbyAction();};$('#routeBtn').onclick=()=>{closeHudPanels();guide();};$('#reportBtn').onclick=reportModal;$('#modalClose').onclick=()=>{hide();if(st.stage==='welcome')setStage('interview')};
    bindTouchControls();
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&st.modal&&st.stage!=='result')hide();});
    intro();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
