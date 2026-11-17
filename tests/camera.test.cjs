/* Executar: node --test tests/camera.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const context={window:{SCAIGraphics:{uv:()=>[0,0,1,1]}}};
for(const file of ['assets/galpao.js','engine3d.js','assets/malha.js','assets/iluminacao.js','assets/cenario.js','assets/renderizador.js']){
  runInNewContext(readFileSync(join(__dirname,'..',file),'utf8'),context);
}
const {SCAI3D:{Engine},SCAIMesh:Mesh,SCAIWorld:World,SCAIRenderer:Renderer}=context.window;
const mesh=new Mesh();World.build(mesh,{});
function engine(width=1365,height=864){
  return Object.assign(Object.create(Engine.prototype),{canvas:{width,height},player:{x:-5.2,z:-.25,dir:0},
    events:{},keys:{},t:0,walkDistance:0,yaw:0,cameraScale:1,cameraNear:.12,cameraPadding:.22,hidePlayer:false});
}
function position(e,x,z,yaw){Object.assign(e.player,{x,z});e.yaw=yaw;e.cameraScale=1;e.hidePlayer=false;e.update(.016);}
function renderer(){
  const calls=[];
  return Object.assign(Object.create(Renderer.prototype),{world:{count:mesh.length/12},cameraObjects:mesh.cameraObjects,
    hiddenObjects:new Set(),hiddenActors:new Set(),bind:()=>{},gl:{TRIANGLES:4,drawArrays:(mode,first,count)=>calls.push({first,count})},calls});
}

test('móveis e pessoas na trajetória não aproximam a câmera nem ocultam o auditor',()=>{
  for(const [x,z,yaw] of [[-8.85,-.8,Math.PI],[4.5,0,Math.PI],[3.3,1,Math.PI],[8,-1.35,Math.PI/2]]){
    const e=engine();position(e,x,z,yaw);
    assert.equal(e.cameraScale,1);assert.equal(e.hidePlayer,false);
    assert.ok(e.cameraArmClear([x,1.59,z],e.eye));
  }
});

test('só o zoom muito próximo da parede oculta o auditor e ele reaparece ao afastar',()=>{
  const e=engine();position(e,-10.5,0,-Math.PI/2);
  assert.ok(e.cameraScale<1&&e.cameraScale>.24);assert.equal(e.hidePlayer,false);
  position(e,-12.04,0,-Math.PI/2);assert.ok(e.cameraScale<.20);assert.equal(e.hidePlayer,true);
  Object.assign(e.player,{x:-5.2,z:-.25});e.yaw=0;
  for(let i=0;i<40;i++)e.update(.016);
  assert.equal(e.cameraScale,1);assert.equal(e.hidePlayer,false);
});

test('paredes externas e divisórias impedem a saída da câmera em giros rápidos',()=>{
  // The open glass leaf is parked on the warehouse face of the partition.
  const points=[[-5.2,-.25],[-10.7,-.8],[-12.04,0],[16.19,0],[1.5,-7.07],[-3,7.03],[.65,-3],[-.5,3],[.5,0],[-.5,0]];
  for(const [w,h] of [[1365,864],[390,844],[844,390]])for(const [x,z] of points){
    const e=engine(w,h);assert.ok(e.canMove(x,z));
    for(let angle=0;angle<72;angle++){
      position(e,x,z,angle*Math.PI/36);
      assert.equal(e.cameraPointBlocked(...e.eye),false,`${w}x${h}, ${x},${z}, ${angle}`);
      assert.ok(e.cameraArmClear([x,1.59,z],e.eye));
      assert.ok(Array.from(e.vp).every(Number.isFinite));
    }
  }
});

test('vão de passagem permanece livre, enquanto as divisórias acionam o zoom',()=>{
  const e=engine();position(e,-1,0,Math.PI/2);assert.equal(e.cameraScale,1);
  position(e,-1,-3,Math.PI/2);assert.ok(e.cameraScale<.2);assert.ok(e.eye[0]<0);
});

test('a caminhada continua bloqueada por mesas, cadeiras, equipamentos e personagens',()=>{
  const e=engine();
  for(const [x,z] of [[-8.85,-3.25],[-8.85,-1.92],[-4.3,3.8],[4.5,-5.75],[12.615,-1.35],[-10.7,-5.2],[5.65,3.15]]){
    assert.equal(e.canMove(x,z),false,`${x},${z}`);
  }
});

test('objetos do cenário têm limites medidos e triângulos independentes das paredes',()=>{
  const owners=new Uint8Array(mesh.length/12),ids=new Set(),data=mesh.v;
  for(const object of mesh.cameraObjects){
    assert.ok(!ids.has(object.id),object.id);ids.add(object.id);
    assert.ok(object.min.every((v,i)=>Number.isFinite(v)&&v<object.max[i]),object.id);
    for(const {first,count} of object.ranges){
      assert.ok(first>=mesh.propsStart);assert.equal(first%3,0);assert.equal(count%3,0);
      for(let i=first;i<first+count;i++){
        assert.equal(owners[i],0,'um triângulo não pode desaparecer junto com dois objetos');owners[i]=1;
        for(let axis=0;axis<3;axis++)assert.ok(data[i*12+axis]>=object.min[axis]-1e-5&&data[i*12+axis]<=object.max[axis]+1e-5);
      }
    }
  }
  for(const id of ['meeting-table','chair:-8.85:-1.92','desk:-4.3:3.8','rack:4.5:-5.75','forklift','inspection-bench','supplier-kiosk'])assert.ok(ids.has(id));
});

test('estante atravessada fica invisível por inteiro e reaparece sem alterar o zoom',()=>{
  const e=engine(),r=renderer();position(e,4.5,0,Math.PI);r.drawWorld(e);
  assert.equal(e.cameraScale,1);assert.equal(e.hidePlayer,false);
  assert.ok(r.hiddenObjects.has('rack:4.5:-5.75'));
  const rack=mesh.cameraObjects.find(o=>o.id==='rack:4.5:-5.75');
  for(const hidden of rack.ranges)for(const drawn of r.calls){
    assert.ok(drawn.first+drawn.count<=hidden.first||drawn.first>=hidden.first+hidden.count);
  }
  position(e,8,0,Math.PI/2);r.calls.length=0;r.drawWorld(e);
  assert.equal(r.hiddenObjects.size,0);assert.equal(r.calls.length,1);assert.equal(r.calls[0].count,r.world.count);
});

test('mesa e cadeira somem apenas junto à câmera, conservando o restante do cenário',()=>{
  const e=engine(),r=renderer();
  for(const id of ['meeting-table','chair:-8.85:-1.92','desk:-4.3:3.8','forklift','supplier-kiosk']){
    const object=mesh.cameraObjects.find(o=>o.id===id);
    e.eye=object.min.map((v,i)=>(v+object.max[i])*.5);r.drawWorld(e);
    assert.ok(r.hiddenObjects.has(id),id);
    assert.ok(r.calls.some(c=>c.first===0&&c.count>=mesh.propsStart),'paredes e piso permanecem visíveis');
  }
  // A table on the sight line is not hidden when the camera is safely outside it.
  position(e,-8.85,-.8,Math.PI);r.drawWorld(e);assert.ok(!r.hiddenObjects.has('meeting-table'));
});

test('personagem atravessado desaparece e reaparece sem ocultar o jogador',()=>{
  const e=engine(),r=renderer();r.actors={worker:{seatedBounds:{min:[-.55,0,-.75],max:[.55,2.95,.3]}}};
  e.eye=[5.65,2.5,3.115];assert.equal(r.personVisible(e,5.65,3.115,'worker',0,true),false);
  e.eye=[5.65,3.26,1];assert.equal(r.personVisible(e,5.65,3.115,'worker',0,true),true);
  assert.equal(e.hidePlayer,false);assert.equal(e.cameraScale,1);
});
