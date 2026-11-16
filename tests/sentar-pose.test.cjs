/* Executar: node --test tests/sentar-pose.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const context={window:{}};
runInNewContext(readFileSync(join(__dirname,'../assets/personagens.js'),'utf8'),context);
const people=context.window.SCAIPeople;
const point=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const pose=(blend,time=.5,dir=0,walking=false)=>people.pose(0,0,time,walking,'auditor',dir,false,2.3,time,blend);
function vertices(model,rig,filter){
  const result=[];
  for(let i=0;i<model.data.length;i+=model.stride){
    const d=model.data,name=model.bones[d[i+11]];
    if(!filter(name))continue;
    const p=Array.from(d.slice(i,i+3)),a=point(rig[name],p),b=point(rig[model.bones[d[i+12]]],p),w=d[i+13];
    result.push(a.map((v,axis)=>v*(1-w)+b[axis]*w));
  }
  return result;
}

test('pose sem assento preserva exatamente a API e as animações existentes',()=>{
  for(const role of ['auditor','manager','worker'])for(const walking of [false,true]){
    const args=[2,-3,1.2,walking,role,.7,true,3.4,1.2];
    const original=people.pose(...args),standing=people.pose(...args,0);
    for(const bone of people.bones)assert.deepEqual(Array.from(standing[bone]),Array.from(original[bone]));
  }
});

test('transição de sentar é contínua e mantém o rig finito em todas as orientações',()=>{
  for(const dir of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    let previous;
    for(let i=0;i<=100;i++){
      const rig=pose(i/100,.5,dir);
      for(const bone of people.bones)assert.ok(Array.from(rig[bone]).every(Number.isFinite));
      const hip=point(rig.body,[0,1.52,.007]);
      if(previous)assert.ok(distance(hip,previous)<.008,'a pelve não pode saltar entre frames');
      previous=hip;
    }
  }
});

test('solas permanecem apoiadas no chão ao sentar e levantar',()=>{
  const model=people.build('auditor');
  for(let i=0;i<=100;i++){
    const feet=vertices(model,pose(i/100),name=>name==='footL'||name==='footR');
    const bottom=Math.min(...feet.map(p=>p[1]));
    assert.ok(Math.abs(bottom-.012)<.00001,`blend ${i/100}, sola ${bottom}`);
  }
});

test('pose sentada dobra os joelhos para a frente e repousa a calça sobre a almofada',()=>{
  const model=people.build('auditor');
  for(const time of [.3,2.1,5.1]){
    const rig=pose(1,time);
    for(const s of [-1,1]){
      const side=s<0?'L':'R',hip=point(rig['thigh'+side],[s*.151,1.52,.007]);
      const knee=point(rig['thigh'+side],[s*.165,.821,-.010]);
      const ankle=point(rig['shin'+side],[s*.166,.195,.010]);
      assert.ok(knee[2]<hip[2]-.45,'o joelho deve avançar à frente do assento');
      assert.ok(ankle[2]<-.58&&Math.abs(ankle[1]-.195)<.00001);
      const thigh=knee.map((v,i)=>v-hip[i]),shin=ankle.map((v,i)=>v-knee[i]);
      const angle=Math.acos(thigh.reduce((sum,v,i)=>sum+v*shin[i],0)/(Math.hypot(...thigh)*Math.hypot(...shin)));
      assert.ok(angle>.7&&angle<1.8,'o joelho deve estar flexionado');
    }
    const cushion=vertices(model,rig,name=>name.startsWith('thigh')).filter(p=>p[2]>-.42&&p[2]<.42);
    const bottom=Math.min(...cushion.map(p=>p[1]));
    assert.ok(bottom>.930&&bottom<.945,`a calça deve apoiar no topo .935 da almofada: ${bottom}`);
  }
});

test('tablet acompanha a mão e fica fora do apoio lateral da cadeira',()=>{
  const model=people.build('auditor');
  for(let i=0;i<=100;i++){
    const rig=pose(i/100,.5,.7);
    assert.ok(distance(point(rig.handR,[.456,1.595,-.055]),point(rig.tablet,[.456,1.595,-.055]))<1e-7);
  }
  const tablet=vertices(model,pose(1),name=>name==='tablet');
  assert.ok(Math.min(...tablet.map(p=>p[0]))>.55,'o tablet não deve atravessar o braço da cadeira em x=.45');
  assert.ok(Math.min(...tablet.map(p=>p[1]))>.6,'o tablet não deve tocar o chão');
});

test('estar sentado suprime o ciclo de caminhada mesmo com comando mantido',()=>{
  const idle=pose(1,.5,0,false),walking=pose(1,.5,0,true);
  for(const bone of people.bones)assert.deepEqual(Array.from(idle[bone]),Array.from(walking[bone]));
});
