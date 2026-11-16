/* Executar: node --test tests/personagens.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const context={window:{}};
runInNewContext(readFileSync(require('node:path').join(__dirname,'../assets/personagens.js'),'utf8'),context);
const people=context.window.SCAIPeople;
const point=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

for(const role of ['auditor','manager','worker']){
  test(`${role}: malha indexada íntegra e influências válidas`,()=>{
    const {data,indices,stride,bones}=people.build(role),count=data.length/stride;
    assert.ok(count<=65535,'o modelo deve usar índices de 16 bits no WebGL 1');
    assert.ok(indices.length>count*3,'os vértices devem ser compartilhados');
    assert.equal(indices.length%3,0);
    assert.equal(stride,16);
    for(const index of indices)assert.ok(index>=0&&index<count);
    for(let i=0;i<data.length;i+=stride){
      for(let j=0;j<stride;j++)assert.ok(Number.isFinite(data[i+j]));
      for(const j of [11,12])assert.ok(Number.isInteger(data[i+j])&&data[i+j]>=0&&data[i+j]<bones.length);
      assert.ok(data[i+13]>=0&&data[i+13]<=1);
      assert.ok(Math.hypot(data[i+3],data[i+4],data[i+5])>.8);
    }
  });
  test(`${role}: rig completo ao caminhar, falar e girar`,()=>{
    for(const walking of [false,true])for(const mouth of [false,true]){
      for(const dir of [0,Math.PI/2,Math.PI,-Math.PI/2]){
        for(const time of [.05,.52,1.17,3.575,5.31]){
          const rig=people.pose(2,-3,time,walking,role,dir,mouth,time*3.6);
          for(const bone of people.bones){
            assert.equal(rig[bone].length,16,bone);
            assert.ok(Array.from(rig[bone]).every(Number.isFinite),bone);
          }
        }
      }
    }
  });
}

test('o pé apoiado fica no lugar enquanto o corpo avança',()=>{
  let planted;
  for(const phase of [.12,.20,.28,.36,.44]){
    const travel=phase*2.2,rig=people.pose(0,-travel,.5,true,'auditor',0,false,travel);
    const ankle=point(rig.footL,[-.166,.195,.010]);
    if(!planted)planted=ankle;
    assert.ok(Math.abs(ankle[2]-planted[2])<.00001);
    assert.ok(Math.abs(ankle[0]-planted[0])<.00001);
  }
});

test('solas permanecem acima do piso em todo o ciclo',()=>{
  const model=people.build('auditor'),feet=new Map();
  for(const side of ['L','R']){
    const bone=model.bones.indexOf('foot'+side),vertices=[];
    for(let i=0;i<model.data.length;i+=model.stride){
      if(model.data[i+11]===bone)vertices.push(Array.from(model.data.slice(i,i+3)));
    }
    feet.set('foot'+side,vertices);
  }
  for(let step=0;step<=80;step++){
    const travel=step/80*2.2,rig=people.pose(0,-travel,.5,true,'auditor',0,false,travel);
    for(const [bone,vertices] of feet){
      const bottom=Math.min(...vertices.map(p=>point(rig[bone],p)[1]));
      assert.ok(bottom>-.003,`${bone}, fase ${step}/80, piso ${bottom}`);
    }
  }
});

test('caminhar mantém a altura da postura e o tablet ancorado à mão',()=>{
  for(let step=0;step<=40;step++){
    const t=step/40*2.2,rig=people.pose(0,-t,.5,true,'auditor',.7,false,t);
    assert.ok(Math.abs(point(rig.body,[0,1.66,0])[1]-1.66)<.004);
    assert.ok(distance(point(rig.handR,[.456,1.595,-.055]),point(rig.tablet,[.456,1.595,-.055]))<.000001);
  }
});
