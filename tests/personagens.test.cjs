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
  test(`${role}: rosto mantém o comprimento anterior ao experimento`,()=>{
    const model=people.build(role),skin=[];
    for(let i=0;i<model.data.length;i+=model.stride){
      if(model.data[i+9]===1&&model.data[i+11]===model.bones.indexOf('head'))skin.push(model.data[i+1]);
    }
    const height=Math.max(...skin)-Math.min(...skin);
    assert.ok(Math.abs(height-(role==='manager'?.50436:.48568))<.00001,`altura do rosto ${height}`);
  });
  test(`${role}: boca neutra em repouso, animada somente na fala`,()=>{
    let talkingLip=0,talkingTeeth=0;
    const level=2.84+(2.724-2.84)*(role==='manager'?1.08:1.04);
    const upper=[0,level,-.18],lower=[0,level-.020,-.18];
    for(const time of [.07,.21,.44,.61,.8,1.1,2.3]){
      for(const walking of [false,true]){
        const rest=people.pose(0,0,time,walking,role,.7,false,time*3.6);
        assert.ok(distance(point(rest.lip,upper),point(rest.head,upper))<.000001);
        assert.ok(distance(point(rest.jaw,upper),point(rest.head,upper))<.000001);
        for(const bone of ['mouth','teeth']){
          assert.ok(distance(point(rest[bone],lower),point(rest[bone],upper))<.00015);
        }
      }
      const speech=people.pose(0,0,time,false,role,.7,true);
      talkingLip=Math.max(talkingLip,distance(point(speech.lip,upper),point(speech.head,upper)));
      talkingTeeth=Math.max(talkingTeeth,distance(point(speech.teeth,lower),point(speech.teeth,upper)));
    }
    assert.ok(talkingLip>.008,'o lábio precisa acompanhar a fala');
    assert.ok(talkingTeeth>.010,'os dentes só são revelados durante a fala');
  });
  test(`${role}: dedos e palma formam uma superfície única e fechada`,()=>{
    const model=people.build(role);
    for(const name of ['handL','handR']){
      const part=model.parts.find(p=>p.bone===name),neighbors=new Map(),edges=new Map();
      for(let i=part.first;i<part.first+part.count;i+=3){
        const triangle=Array.from(model.indices.slice(i,i+3));
        if(!triangle.every(index=>model.data[index*model.stride+9]===1))continue;
        for(let j=0;j<3;j++){
          const a=triangle[j],b=triangle[(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
          edges.set(key,(edges.get(key)||0)+1);
          if(!neighbors.has(a))neighbors.set(a,new Set());
          neighbors.get(a).add(b);
        }
      }
      assert.ok(neighbors.size>100,name);
      for(const count of edges.values())assert.equal(count,2,'a pele não pode ter bordas abertas');
      const visited=new Set(),queue=[neighbors.keys().next().value];
      while(queue.length){
        const vertex=queue.pop();if(visited.has(vertex))continue;visited.add(vertex);
        for(const neighbor of neighbors.get(vertex))if(!visited.has(neighbor))queue.push(neighbor);
      }
      assert.equal(visited.size,neighbors.size,'todos os dedos devem estar unidos à palma');
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

test('tablet fica vertical ao lado da coxa na pose original',()=>{
  const model=people.build('auditor'),tablet=model.bones.indexOf('tablet'),vertices=[];
  for(let i=0;i<model.data.length;i+=model.stride){
    if(model.data[i+11]===tablet)vertices.push(Array.from(model.data.slice(i,i+3)));
  }
  const span=axis=>Math.max(...vertices.map(p=>p[axis]))-Math.min(...vertices.map(p=>p[axis]));
  assert.ok(span(0)<.035,'a face larga do tablet não deve apontar para a câmera frontal');
  assert.ok(span(1)>.43&&span(1)<.45);
  assert.ok(span(2)>.28&&span(2)<.30);
  const rig=people.pose(0,0,.5,false,'auditor',0,false);
  const heights=vertices.map(p=>point(rig.tablet,p)[1]);
  assert.ok(Math.min(...heights)>1.05&&Math.max(...heights)<1.75,'o tablet deve ficar abaixo da cintura');
});

test('polegar da mão direita nasce na palma e apoia o tablet sem atravessá-lo',()=>{
  const model=people.build('auditor'),hand=model.bones.indexOf('handR'),thumb=[];
  for(let i=0;i<model.data.length;i+=model.stride){
    if(model.data[i+11]!==hand||model.data[i+9]!==1)continue;
    const [x,y,z]=model.data.slice(i,i+3);
    if(x<.398)thumb.push([x,y,z]);
    const insideTablet=Math.abs(x-.400)<.009&&Math.abs(y-1.294)<.205&&Math.abs(z+.065)<.130;
    assert.ok(!insideTablet,'a pele não pode atravessar o interior do tablet');
  }
  assert.ok(thumb.length>20,'o polegar deve contornar a face interna do tablet');
  assert.ok(Math.max(...thumb.map(p=>p[1]))<1.56,'o polegar deve se encaixar abaixo do punho');
  assert.ok(thumb.some(([x,y])=>x>.378&&y>1.48&&y<1.52),'a ponta deve apoiar a face interna do tablet');
});

test('ambos os olhos piscam a cada 2 segundos mesmo com a simulação parada',()=>{
  for(const role of ['auditor','manager','worker'])for(const side of ['L','R']){
    const blinks=[];let previouslyClosed=false;
    for(let frame=0;frame<=14*60;frame++){
      const clock=frame/60,rig=people.pose(0,0,0,false,role,0,false,0,clock);
      const closed=distance(point(rig['eyelid'+side],[0,2.87,-.17]),point(rig.head,[0,2.87,-.17]))>.020;
      if(closed&&!previouslyClosed)blinks.push(clock);
      previouslyClosed=closed;
    }
    assert.ok(blinks.length>=6,`${role}, ${side}: ${blinks}`);
    for(let i=1;i<blinks.length;i++)assert.ok(Math.abs(blinks[i]-blinks[i-1]-2)<.020,`${role}, ${side}: ${blinks}`);
  }
});
