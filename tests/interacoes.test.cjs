const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const handlers={};
const context={window:{addEventListener(){}},document:{addEventListener(k,fn){handlers[k]=fn},activeElement:null}};
runInNewContext(readFileSync(join(__dirname,'../engine3d.js'),'utf8'),context);
const {Engine,chairs}=context.window.SCAI3D;
function engine(){return Object.assign(Object.create(Engine.prototype),{player:{x:-5.2,z:-.25,dir:0},
  canvas:{width:1365,height:864,addEventListener(){}},events:{},keys:{},t:0,walkDistance:0,yaw:0,
  cameraScale:1,cameraNear:.12,cameraPadding:.22,hidePlayer:false,seating:null,door:{open:0,target:0}});}
function advance(e,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)e.update(1/60);}
function approach(e,c){
  for(let i=0;i<72;i++){
    const angle=i*Math.PI/36,x=c.x+Math.sin(angle)*.75,z=c.z+Math.cos(angle)*.75;
    Object.assign(e.player,{x,z,dir:Math.atan2(c.x-x,-(c.z-z))});
    if(e.canMove(x,z)&&e.nearbyChair()?.id===c.id)return;
  }
  assert.fail('Cadeira sem ponto acessível: '+c.id);
}
test('todas as oito cadeiras permitem sentar, bloquear caminhada e levantar para ponto livre',()=>{
  assert.equal(chairs.length,8);
  for(const c of chairs){
    const e=engine();approach(e,c);const start={...e.player};
    assert.equal(e.usePhysical(),true);assert.ok(e.seating);
    assert.equal(e.usePhysical(),false,'não repetir durante transição');
    e.keys.w=true;advance(e,3.5);assert.equal(e.seating.phase,'seated');
    assert.equal(e.seating.blend,1);assert.equal(e.walking,false);
    assert.ok(Math.hypot(e.player.x-c.x,e.player.z-c.z)<.1);
    const seated={...e.player};advance(e,.4);assert.deepEqual(e.player,seated);
    e.keys={};assert.equal(e.usePhysical(),true);advance(e,3.5);
    assert.equal(e.seating,null);assert.ok(e.canMove(e.player.x,e.player.z));
    assert.ok(Math.hypot(e.player.x-start.x,e.player.z-start.z)<1e-7);
  }
});
test('contato por qualquer lado independe da orientação e escolhe a cadeira mais próxima',()=>{
  const e=engine(),c=chairs[7];
  for(const [dx,dz] of [[.7,0],[-.7,0],[0,.75],[0,-.75]])for(const dir of [0,1,2,3]){
    Object.assign(e.player,{x:c.x+dx,z:c.z+dz,dir});
    assert.equal(e.nearbyChair()?.id,c.id);
  }
  const a=chairs[0],b=chairs[2];
  Object.assign(e.player,{x:(a.x+b.x)/2+.01,z:a.z+.505,dir:0});
  assert.equal(e.nearbyChair()?.id,b.id);
});
test('o auditor primeiro caminha e gira para o início da pose, mantendo pernas em pé até chegar',()=>{
  const e=engine();approach(e,chairs[7]);const start={...e.player};
  e.usePhysical();assert.equal(e.seating.phase,'aligning');
  e.update(1/60);assert.equal(e.seating.blend,0);
  assert.ok(Math.hypot(e.player.x-start.x,e.player.z-start.z)>0);
  let frames=0;
  while(e.seating.phase==='aligning'&&frames++<200){assert.equal(e.seating.blend,0);e.update(1/60);}
  assert.equal(e.seating.phase,'sitting');assert.equal(e.seating.blend,0);
  assert.ok(Math.abs(e.player.dir-chairs[7].dir)<1e-6);
  assert.ok(Math.abs(e.player.z-(chairs[7].z+chairs[7].facing*.44))<1e-6);
  advance(e,1);assert.equal(e.seating.phase,'seated');
});
test('E distante não usa cadeira e interação fica bloqueada durante diálogo',()=>{
  const e=engine();assert.equal(e.usePhysical(),false);
  approach(e,chairs[7]);e.events.isBlocked=()=>true;
  assert.equal(e.usePhysical(),false);assert.equal(e.seating,null);
});
test('porta tem folhas animadas, bloqueia fechada e libera a passagem aberta',()=>{
  const e=engine();Object.assign(e.player,{x:-1.1,z:0,dir:Math.PI/2});
  assert.equal(e.canMove(.12,0),false);assert.equal(e.physicalAction().kind,'door');
  assert.equal(e.usePhysical(),true);assert.equal(e.door.target,1);
  advance(e,.3);assert.ok(e.door.open>0&&e.door.open<1);advance(e,1);
  assert.equal(e.door.open,1);assert.equal(e.canMove(.12,0),true);
  assert.equal(e.usePhysical(),true);advance(e,1.2);assert.equal(e.door.open,0);
  assert.equal(e.canMove(.12,0),false);
});
test('aproximar da porta nunca abre ou fecha; obstrução apenas pausa o comando de fechar',()=>{
  const e=engine();Object.assign(e.player,{x:-.37,z:0,dir:Math.PI/2});
  advance(e,2);assert.equal(e.door.open,0);assert.equal(e.door.target,0);
  Object.assign(e.player,{x:-1.1});e.usePhysical();advance(e,1.2);
  assert.equal(e.door.open,1);Object.assign(e.player,{x:.12,z:0});advance(e,.5);
  assert.equal(e.door.open,1);assert.equal(e.door.target,1);
  e.usePhysical();advance(e,1.2);
  assert.equal(e.door.target,0);assert.ok(e.door.open>0&&e.door.open<1);assert.ok(e.door.blocked);
  const held=e.door.open;advance(e,.5);assert.equal(e.door.open,held);
  Object.assign(e.player,{x:1.1});advance(e,1.2);assert.equal(e.door.open,0);
});
test('a câmera atravessa o vidro fechado sem zoom; paredes continuam limitando',()=>{
  const e=engine();Object.assign(e.player,{x:-2,z:0,dir:0});e.yaw=Math.PI/2;e.update(1/60);
  assert.equal(e.cameraScale,1);assert.equal(e.hidePlayer,false);
  assert.equal(e.cameraPointBlocked(.12,3,0),false);
  assert.equal(e.canMove(.12,0),false);
});
test('Q usa missão, E usa ação física e tecla mantida não repete',()=>{
  const e=engine();let mission=0,physical=0;
  e.events.onInteract=()=>mission++;e.usePhysical=()=>{physical++;return true};e.bind();
  const down=(key,repeat=false)=>handlers.keydown({key,repeat,preventDefault(){}});
  down('q');assert.equal(mission,1);assert.equal(physical,0);
  down('e');assert.equal(mission,1);assert.equal(physical,1);
  down('e',true);down('q',true);assert.equal(physical,1);assert.equal(mission,1);
  e.seating={};down('q');assert.equal(mission,1);
  e.events.isBlocked=()=>true;down('e');assert.equal(physical,1);
});
