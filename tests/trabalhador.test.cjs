const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{runInNewContext}=require('node:vm');
const context={window:{}};
for(const file of ['engine3d.js','assets/personagens.js'])runInNewContext(readFileSync(join(__dirname,'..',file),'utf8'),context);
const {SCAI3D:{Engine},SCAIPeople:people}=context.window;
function engine(x,z){return Object.assign(Object.create(Engine.prototype),{player:{x,z,dir:0},canvas:{width:1365,height:864},events:{},keys:{},t:0,walkDistance:0,yaw:0,cameraScale:1,cameraNear:.12,cameraPadding:.22,door:{open:0,target:0},seating:null,tabletRead:null});}
function advance(e,seconds){for(let i=0;i<Math.ceil(seconds*60);i++){e.update(1/60);assert.ok(e.canMove(e.player.x,e.player.z),'o trajeto deve respeitar colisões');}}
test('contato com frente, lados da bancada ou trabalhador oferece E e chega à frente sem atravessar objetos',()=>{
 for(const [x,z] of [[5.65,1.19],[4.29,2.05],[7.01,2.05],[5.65,3.87],[5,3.8],[6.3,3.8],[7,2.73]]){
  const e=engine(x,z);assert.ok(e.canMove(x,z),`${x},${z}`);assert.ok(e.workerContact());assert.equal(e.physicalAction().kind,'worker');let calls=0;e.events.onWorkerTalk=()=>calls++;
  assert.equal(e.usePhysical(),true);e.keys.w=true;advance(e,7);
  assert.equal(calls,1);assert.equal(e.workerTalk.phase,'speaking');assert.equal(e.workerTalk.look,1);assert.ok(Math.abs(e.player.x-5.65)<1e-8&&Math.abs(e.player.z-1.11)<1e-8);assert.ok(Math.abs(Math.abs(e.player.dir)-Math.PI)<1e-8);
  const p={...e.player};advance(e,1);assert.deepEqual(e.player,p);assert.equal(e.consultTablet(),false);assert.equal(e.usePhysical(),false);
 }
});
test('distância, diálogo ou tablet não iniciam conversa; cadeira ocupada continua indisponível',()=>{
 const e=engine(9,3);assert.equal(e.workerContact(),false);assert.equal(e.usePhysical(),false);
 Object.assign(e.player,{x:5.65,z:1.19});e.events.isBlocked=()=>true;assert.equal(e.usePhysical(),false);e.events={};e.tabletRead={};assert.equal(e.usePhysical(),false);assert.equal(e.nearbyChair(),null);
});
test('encerrar faz somente a cabeça retornar gradualmente e permite nova conversa',()=>{
 const e=engine(5.65,1.19);e.usePhysical();advance(e,2);e.finishWorkerTalk();advance(e,.25);assert.ok(e.workerTalk.look>0&&e.workerTalk.look<1);advance(e,.4);assert.equal(e.workerTalk,null);
 Object.assign(e.player,{z:1.19});assert.equal(e.usePhysical(),true);
});
test('olhar e falar não movem corpo, braços, mãos, pernas ou tablet do trabalhador',()=>{
 for(const time of [0,.4,1.2,3.1]){
  const idle=people.pose(0,0,time,false,'worker',0,false,0,0,1,0,0),talk=people.pose(0,0,time,false,'worker',0,true,0,0,1,0,1);
  for(const bone of people.bones.filter(n=>!['head','jaw','mouth','lip','teeth','eyelidL','eyelidR'].includes(n)))assert.deepEqual(Array.from(talk[bone]),Array.from(idle[bone]),bone);
  assert.notDeepEqual(Array.from(talk.head),Array.from(idle.head));assert.notDeepEqual(Array.from(talk.jaw),Array.from(talk.head));
 }
});
