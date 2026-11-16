const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const context={window:{}};
for(const file of ['assets/malha.js','engine3d.js','assets/renderizador.js'])runInNewContext(readFileSync(join(__dirname,'..',file),'utf8'),context);
context.SCAIMesh=context.window.SCAIMesh;
runInNewContext(readFileSync(join(__dirname,'../assets/porta.js'),'utf8'),context);
const {SCAIDoor,SCAIRenderer:Renderer,SCAI3D:{Engine}}=context.window;
function fixture(){
  const source=SCAIDoor.build(),calls=[],models=[];
  const geometry=(id,mesh)=>({id,count:mesh.length/12});
  const r=Object.assign(Object.create(Renderer.prototype),{
    hiddenDoorParts:new Set(),uniform:{Model:'model'},current:null,
    gl:{TRIANGLES:4,drawArrays:(mode,first,count)=>calls.push({id:r.current.id,first,count}),uniformMatrix4fv:(loc,transpose,value)=>models.push(Array.from(value))},
    bind:g=>{r.current=g},
    door:{fixed:geometry('frame',source.fixed),frameParts:source.frameParts,leaves:source.leaves.map(l=>({...l,opaque:geometry('opaque:'+l.side,l.opaque),glass:geometry('glass:'+l.side,l.glass)}))}
  });
  const e=Object.assign(Object.create(Engine.prototype),{eye:[.13,2.5,-1.3],cameraPadding:.22,door:{open:0,target:0}});
  const draw=()=>{calls.length=0;r.updateDoorVisibility(e);r.drawDoor(e);r.drawDoor(e,true)};
  return{r,e,calls,models,source,draw};
}

test('partes fixas têm limites independentes sem preencher o vão aberto',()=>{
  const {source}=fixture();let end=0;
  for(const part of source.frameParts){
    assert.equal(part.first,end);assert.ok(part.count>0);end+=part.count;
    assert.ok(part.min.every((v,i)=>Number.isFinite(v)&&v<part.max[i]));
    assert.ok(part.min[1]>4.9||part.min[2]>2.5||part.max[2]<-2.5);
  }
  assert.equal(end,source.fixed.length/12);
  for(const leaf of source.leaves){
    assert.ok(leaf.bounds.min[0]<.01&&leaf.bounds.max[0]>.25,'os limites incluem os puxadores dos dois lados');
    for(const mesh of [leaf.opaque,leaf.glass])for(let i=0;i<mesh.length;i+=12)for(let axis=0;axis<3;axis++){
      assert.ok(mesh.v[i+axis]>=leaf.bounds.min[axis]&&mesh.v[i+axis]<=leaf.bounds.max[axis]);
    }
  }
});

test('atravessar uma folha fechada oculta juntos vidro e caixilho',()=>{
  const {r,draw,calls}=fixture();draw();
  assert.ok(r.hiddenDoorParts.has('leaf:-1'));assert.ok(!r.hiddenDoorParts.has('leaf:1'));
  assert.ok(!calls.some(c=>c.id==='opaque:-1'||c.id==='glass:-1'));
  assert.ok(calls.some(c=>c.id==='opaque:1')&&calls.some(c=>c.id==='glass:1'));
});

test('câmera no encontro das folhas oculta ambas; no vão aberto mantém toda a porta visível',()=>{
  const {r,e,draw,calls}=fixture();e.eye=[.13,3.26,0];draw();
  assert.ok(r.hiddenDoorParts.has('leaf:-1')&&r.hiddenDoorParts.has('leaf:1'));
  e.door.open=1;draw();assert.equal(r.hiddenDoorParts.size,0);
  assert.equal(calls.filter(c=>c.id.startsWith('opaque:')).length,2);
  assert.equal(calls.filter(c=>c.id.startsWith('glass:')).length,2);
});

test('limites acompanham as folhas abertas e restauram sua geometria ao sair',()=>{
  const {r,e,draw,calls,models}=fixture();e.door.open=1;e.eye=[.13,2.5,-3.85];draw();
  assert.ok(r.hiddenDoorParts.has('leaf:-1'));assert.ok(!calls.some(c=>c.id==='glass:-1'));
  e.eye=[1,2.5,-3.85];draw();assert.equal(r.hiddenDoorParts.size,0);
  assert.ok(calls.some(c=>c.id==='opaque:-1')&&calls.some(c=>c.id==='glass:-1'));
  assert.deepEqual(models.at(-1),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],'a matriz de desenho é restaurada');
});

test('câmera atravessa montante ou trilho sem ocultar os outros trechos fixos',()=>{
  const {r,e,draw,calls}=fixture();e.door.open=1;
  for(const [id,eye] of [['frame:post:1',[.13,2.5,2.635]],['frame:header',[.13,5.055,0]]]){
    e.eye=eye;draw();const part=r.door.frameParts.find(p=>p.id===id);
    assert.ok(r.hiddenDoorParts.has(id));
    const frames=calls.filter(c=>c.id==='frame');assert.ok(frames.length>0);
    for(const call of frames)assert.ok(call.first+call.count<=part.first||call.first>=part.first+part.count);
  }
});

test('margem de saída impede cintilação e não deixa a folha permanentemente invisível',()=>{
  const {r,e,draw}=fixture(),edge=r.door.leaves[0].bounds.max[0];
  e.eye=[edge+.219,2.5,-1.3];draw();assert.ok(r.hiddenDoorParts.has('leaf:-1'));
  e.eye[0]=edge+.25;draw();assert.ok(r.hiddenDoorParts.has('leaf:-1'));
  e.eye[0]=edge+.281;draw();assert.ok(!r.hiddenDoorParts.has('leaf:-1'));
});
