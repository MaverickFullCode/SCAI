/* Executar: node --test tests/movimento.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const context={window:{}};
runInNewContext(readFileSync(join(__dirname,'../engine3d.js'),'utf8'),context);
const {Engine}=context.window.SCAI3D;
function engine(x=-4.3,z=2.8,yaw=Math.PI+.08){
  return Object.assign(Object.create(Engine.prototype),{canvas:{width:1365,height:864},player:{x,z,dir:0},
    events:{},keys:{w:true},t:0,walkDistance:0,yaw,cameraScale:1,cameraNear:.12,cameraPadding:.22,hidePlayer:false});
}
function hold(e,frames,dt=1/60){for(let i=0;i<frames;i++)e.update(dt);}
function assertStopped(e,dt=1/60){
  assert.equal(e.walking,false,'a caminhada deve parar ao atingir o obstáculo');
  const stopped={...e.player},distance=e.walkDistance;
  for(let i=0;i<120;i++){
    e.update(dt);
    assert.equal(e.walking,false,'a animação não pode voltar enquanto o comando permanecer bloqueado');
    assert.deepEqual(e.player,stopped,'não pode haver deslizamento residual');
    assert.equal(e.walkDistance,distance,'a passada não pode avançar sem deslocamento');
  }
}

test('encostar em um obstáculo para o movimento e a animação, inclusive em ângulos oblíquos',()=>{
  const cases=[
    ['mesa',-4.3,2.8,Math.PI+.08],
    ['cadeira',-8.85,-.95,.08],
    ['paletes',5.1,.1,.08],
    ['bancada',5.65,3.2,.08],
    ['operador',1.9,-2.25,-Math.PI/2+.08],
    ['parede externa',1.5,-6.7,.08],
    ['divisória',-.8,-3.2,-Math.PI/2+.08]
  ];
  for(const [name,x,z,yaw] of cases)for(const dt of [.008,1/60,1/30,.038]){
    const e=engine(x,z,yaw);assert.ok(e.canMove(x,z),name);
    hold(e,60,dt);assert.ok(e.walkDistance>0,`${name}: deve caminhar até se aproximar`);
    assertStopped(e,dt);
  }
});

test('teclado e comandos das setas de toque param na direção bloqueada',()=>{
  const yaws={w:Math.PI+.08,arrowup:Math.PI+.08,s:.08,arrowdown:.08,a:Math.PI/2+.08,d:-Math.PI/2+.08};
  for(const [key,yaw] of Object.entries(yaws)){
    const e=engine(-4.3,2.8,yaw);e.keys={};e.setInput(key,true);
    hold(e,60);assertStopped(e);
    e.setInput(key,false);e.update(1/60);assert.equal(e.walking,false);
  }
});

test('um passo bloqueado não inicia a caminhada nem desloca o personagem lateralmente',()=>{
  const e=engine(-4.3,2.999);assert.ok(e.canMove(e.player.x,e.player.z));
  const start={...e.player};e.update(1/60);
  assert.equal(e.walking,false);assert.deepEqual(e.player,start);assert.equal(e.walkDistance,0);
});

test('é possível voltar a caminhar imediatamente ao se afastar ou andar paralelo ao obstáculo',()=>{
  for(const key of ['s','d']){
    const e=engine();hold(e,60);assertStopped(e);
    const before={...e.player},distance=e.walkDistance;
    e.keys={};if(key==='d')e.yaw=0;e.setInput(key,true);e.update(1/60);
    assert.equal(e.walking,true);assert.ok(e.walkDistance>distance);
    assert.ok(Math.hypot(e.player.x-before.x,e.player.z-before.z)>.05);
    assert.ok(e.canMove(e.player.x,e.player.z));
  }
});

test('movimento diagonal bloqueado para; movimento livre preserva a velocidade',()=>{
  const blocked=engine(-4.3,2.8,Math.PI);blocked.setInput('d',true);
  hold(blocked,60);assertStopped(blocked);
  for(const keys of [{w:true},{w:true,d:true},{a:true},{s:true}]){
    const e=engine(8,0,.4);e.keys=keys;e.update(1/60);
    assert.equal(e.walking,true);
    assert.ok(Math.abs(Math.hypot(e.player.x-8,e.player.z)-3.6/60)<1e-8);
  }
});
