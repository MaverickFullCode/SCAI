const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{runInNewContext}=require('node:vm');
const context={window:{}};
for(const file of ['engine3d.js','assets/personagens.js'])runInNewContext(readFileSync(join(__dirname,'..',file),'utf8'),context);
const {Engine}=context.window.SCAI3D,people=context.window.SCAIPeople;
function engine(){return Object.assign(Object.create(Engine.prototype),{player:{x:-5.2,z:-.25,dir:0},canvas:{width:1365,height:864},events:{},keys:{},t:0,walkDistance:0,yaw:0,cameraScale:1,cameraNear:.12,cameraPadding:.22,hidePlayer:false,seating:null,tabletRead:null});}
const point=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('consulta levanta, mostra informações por três segundos e retorna apagada',()=>{
 const e=engine();assert.ok(e.consultTablet());assert.equal(e.consultTablet(),false);
 e.update(.275);assert.ok(e.tabletRead.blend>0&&e.tabletRead.blend<1);assert.equal(e.tabletRead.screen,false);
 e.update(.275);assert.equal(e.tabletRead.blend,1);assert.equal(e.tabletRead.screen,true);
 e.update(2.999);assert.equal(e.tabletRead.screen,true);
 e.update(.002);assert.equal(e.tabletRead.screen,false);
 e.update(.55);assert.equal(e.tabletRead,null);
});
test('o período da consulta usa tempo real mesmo em FPS baixo e não move nem usa a missão',()=>{
 const e=engine(),before={...e.player};e.keys.w=true;e.consultTablet();
 for(let i=0;i<55;i++)e.update(.038,.1);
 assert.equal(e.tabletRead,null);assert.notDeepEqual(e.player,before);
 const f=engine();f.keys.w=true;f.consultTablet();for(let i=0;i<40;i++)f.update(.038,.1);
 assert.deepEqual(f.player,before);assert.equal(f.walkDistance,0);assert.equal(f.usePhysical(),false);
});
test('diálogo, transição de cadeira e repetição não iniciam consultas conflitantes',()=>{
 const e=engine();e.events.isBlocked=()=>true;assert.equal(e.consultTablet(),false);
 e.events={};e.seating={phase:'aligning'};assert.equal(e.consultTablet(),false);
 e.seating={phase:'seated'};assert.equal(e.consultTablet(),true);
});
test('tablet levantado acompanha a mão direita e o olhar acompanha a tela',()=>{
 for(const seat of [0,1])for(const dir of [0,.7,Math.PI]){
  const rig=people.pose(0,0,.5,false,'auditor',dir,false,0,.5,seat,1);
  assert.ok(dist(point(rig.handR,[.456,1.595,-.055]),point(rig.tablet,[.456,1.595,-.055]))<1e-7);
  const screen=point(rig.tablet,[.4,1.294,-.065]),eye=point(rig.head,[0,2.87,-.17]);
  assert.ok(screen[1]>2.05&&screen[1]<2.8);
  const front=point(rig.head,[0,2.87,-1.17]).map((v,i)=>v-eye[i]),toScreen=screen.map((v,i)=>v-eye[i]);
  const cosine=front.reduce((s,v,i)=>s+v*toScreen[i],0)/(Math.hypot(...front)*Math.hypot(...toScreen));
  assert.ok(cosine>.97,'o rosto deve olhar para a tela');
  for(const bone of people.bones)assert.ok(Array.from(rig[bone]).every(Number.isFinite));
 }
});
test('sem consulta e nos outros personagens as poses permanecem idênticas',()=>{
 for(const role of ['auditor','manager','worker']){
  const a=people.pose(0,0,.5,false,role,0,false,0,.5,1),b=people.pose(0,0,.5,false,role,0,false,0,.5,1,role==='auditor'?0:1);
  for(const bone of people.bones)assert.deepEqual(Array.from(a[bone]),Array.from(b[bone]));
 }
});

test('a face da tela aponta para os olhos e seu topo fica alinhado, em pé ou sentado',()=>{
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),unit=a=>{const d=Math.hypot(...a);return a.map(v=>v/d)};
 for(const seated of [0,1])for(const dir of [0,.7,Math.PI,-1.3])for(const time of [0,.5,1.7,4,8,12]){
  const rig=people.pose(0,0,time,false,'auditor',dir,false,0,time,seated,1);
  const screen=point(rig.tablet,[.3872,1.294,-.065]),eye=point(rig.head,[0,2.87,-.17]);
  const normal=unit([-rig.tablet[0],-rig.tablet[1],-rig.tablet[2]]),toEye=unit(eye.map((v,i)=>v-screen[i]));
  assert.ok(dot(normal,toEye)>.995,'a tela deve ficar de frente para o rosto, e não apenas o rosto olhar para ela');
  const up=unit([-rig.tablet[4],-rig.tablet[5],-rig.tablet[6]]);
  const vertical=unit(normal.map((v,i)=>(i===1?1:0)-v*normal[1]));
  assert.ok(dot(up,vertical)>.995,'o tablet não deve ficar tombado lateralmente');
 }
});
