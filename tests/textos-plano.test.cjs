const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function game(){
 const nodes=new Map();
 const get=key=>{if(!nodes.has(key))nodes.set(key,{hidden:false,style:{},classList:{toggle(){},add(){},remove(){}},scrollTo(){},setAttribute(){},innerHTML:'',textContent:''});return nodes.get(key);};
 const context={document:{readyState:'loading',querySelector:get,querySelectorAll:()=>[],addEventListener(){}},matchMedia:()=>({matches:false}),setTimeout,clearTimeout,performance,console,localStorage:{setItem(){}},parent:{postMessage(){}},location:{reload(){}},Math};
 vm.createContext(context);
 const source=fs.readFileSync(require.resolve('../fases/fase01.js'),'utf8').replace(/\}\)\(\);\s*$/, 'globalThis.qa={st,techs,interview,opinions,planTotal,pct,planModal,procedureModal,finish,objectiveMarkers,guide};})();');
 vm.runInContext(source,context);
 return {...context.qa,get};
}
function run(g,id){g.procedureModal(id);const button=g.get(g.st.plan[id]?'#procGo':'#procChange');assert.equal(typeof button.onclick,'function');button.onclick();return button.onclick;}
test('8 créditos cobrem os quatro testes úteis; pesos somam 100',()=>{
 const g=game();assert.equal(g.st.budget,8);assert.equal(g.techs.filter(t=>t.expected).reduce((s,t)=>s+t.cost,0),8);assert.equal(g.techs.reduce((s,t)=>s+t.weight,0),100);assert.ok(g.techs.find(t=>t.id==='count').weight>g.techs.find(t=>t.id==='analytics').weight);
});
test('as 24 ordens dos testes úteis concluem a missão sem repetição paga',()=>{
 const permutations=a=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>j!==i)).map(p=>[v,...p])):[[]];
 for(const order of permutations(['docs','count','recalc','analytics'])){
  const g=game();g.st.stage='execution';
  for(const id of order){const stale=run(g,id);const spent=g.st.spent;stale();assert.equal(g.st.spent,spent);g.procedureModal(id);assert.ok(g.get('#modalBody').innerHTML.includes('Consulta gratuita'));assert.ok(!g.get('#modalBody').innerHTML.includes('id="procChange"'));}
  assert.equal(g.st.spent,8);assert.equal(g.st.adjustments,4);assert.equal(g.pct(),100);g.st.report='qualified';g.st.interviewScore=2;g.finish();assert.equal(g.st.result.success,true);assert.equal(g.st.result.score,100);assert.ok(g.get('#stagebar').innerHTML.includes('class="done">✓ Avaliação'));
 }
});
test('fornecedor não substitui contagem nem concede pontos',()=>{
 const g=game();g.st.stage='execution';run(g,'confirm');assert.equal(g.pct(),0);run(g,'docs');run(g,'recalc');g.procedureModal('count');assert.match(g.get('#modalBody').innerHTML,/disabled/);assert.match(g.get('#modalBody').innerHTML,/saldo não cobre/);const spent=g.st.spent;g.get('#procChange').onclick();assert.equal(g.st.spent,spent);g.st.report='qualified';g.finish();assert.equal(g.st.result.success,false);
});
test('32 combinações: pesos corretos, saldo respeitado e opinião sozinha insuficiente',()=>{
 for(let mask=0;mask<32;mask++){
  const g=game();g.st.stage='execution';
  g.techs.forEach((t,i)=>{if(mask&(1<<i))run(g,t.id);});
  assert.ok(g.st.spent<=8);assert.equal(g.pct(),g.techs.reduce((sum,t)=>sum+(g.st.executed[t.id]?t.weight:0),0));
  g.st.report='qualified';g.finish();assert.equal(g.st.result.success,g.techs.filter(t=>t.expected).every(t=>g.st.executed[t.id]===1));
 }
});
test('plano sem prioridade ou quantidade; teste planejado não registra mudança',()=>{
 const g=game();g.planModal();const html=g.get('#modalBody').innerHTML;assert.ok(html.includes('type="checkbox"'));assert.ok(!html.includes('data-priority'));assert.ok(!html.includes('data-inc'));g.st.plan.docs=1;g.st.stage='execution';run(g,'docs');assert.equal(g.st.adjustments,0);assert.equal(g.st.spent,2);
});
test('cada resposta explica o motivo e cada pergunta tem uma resposta adequada',()=>{
 const g=game();for(const question of g.interview){assert.equal(question.opts.filter(o=>o.good).length,1);for(const o of question.opts){assert.ok(o.response.length>90);assert.ok(o.t.length<110);}}
 for(const id of ['clean','adverse','disclaimer']){const g=game();for(const t of g.techs.filter(t=>t.expected))g.st.executed[t.id]=1;g.st.report=id;g.finish();assert.equal(g.st.result.success,false);}
});
