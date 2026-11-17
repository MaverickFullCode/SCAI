const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c={window:{}};
for(const f of ['assets/galpao.js','assets/empilhadeira.js','engine3d.js','assets/personagens.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);
const {SCAI3D:{Engine},SCAIForklift:car,SCAIPeople:people}=c.window;
function engine(){return Object.assign(Object.create(Engine.prototype),{canvas:{width:1365,height:864},player:{x:40,z:-20,dir:0},events:{},keys:{},t:0,walkDistance:0,yaw:0,cameraScale:1,cameraNear:.12,cameraPadding:.22,forklift:car.create(),shutter:{open:1,target:1},door:{open:0,target:0}});}
function tick(e,n){for(let i=0;i<n;i++)e.update(1/60);}
const point=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);

test('segurar C dobra o deslocamento, inclusive diagonal; soltar C volta a andar sem parar',()=>{
 for(const diagonal of [false,true]){
  const walk=engine(),run=engine();walk.keys={w:true,d:diagonal};run.keys={...walk.keys,c:true};tick(walk,60);tick(run,60);
  assert.ok(Math.abs(walk.walkDistance-3.6)<1e-7);assert.ok(Math.abs(run.walkDistance-2*walk.walkDistance)<1e-7);assert.equal(run.running,true);
  const before=run.walkDistance;run.setInput('c',false);tick(run,60);assert.equal(run.running,false);assert.equal(run.walking,true);assert.ok(Math.abs(run.walkDistance-before-3.6)<1e-7);
  run.keys={c:true};tick(run,1);assert.equal(run.running,false);assert.equal(run.walking,false);assert.equal(run.gait,null);
 }
});

test('corrida alonga e acelera as passadas sem deslocar o pé apoiado ao trocar C',()=>{
 const e=engine();e.keys.w=true;const anchors=new Map();let walkStride,runStride,walkRate,runRate,maxLift=0;
 for(let i=0;i<240;i++){
  e.keys.c=i>=55&&i<165;const previousCycle=e.gait?.cycle;e.update(1/60);
  const g=e.gait,rig=people.pose(e.player.x,e.player.z,e.t,true,'auditor',0,false,e.walkDistance,e.t,0,0,0,null,g);
  if(i===35){walkStride=g.stride;walkRate=g.cycle-previousCycle;}
  if(i===100){runStride=g.stride;runRate=g.cycle-previousCycle;}
  for(let j=0;j<2;j++){
   const step=g.cycle+j*.5,phase=step-Math.floor(step),key=j+':'+Math.floor(step),ankle=point(rig[j?'footR':'footL'],[j?.166:-.166,.195,.010]);
   if(phase>.08&&phase<.44){if(anchors.has(key))assert.ok(Math.abs(ankle[2]-anchors.get(key))<.00002,'pé apoiado deve conservar sua posição no cenário');else anchors.set(key,ankle[2]);}
   if(i>80&&i<160)maxLift=Math.max(maxLift,ankle[1]);
  }
  assert.deepEqual(Array.from(rig.tablet),Array.from(rig.handR));
  assert.ok(Math.abs(point(rig.body,[0,1.52,.007])[1]-1.52)<.004,'corrida não deve abaixar o quadril');
  for(const m of Object.values(rig))assert.ok([...m].every(Number.isFinite));
 }
 assert.ok(runStride>walkStride);assert.ok(runRate>walkRate);assert.ok(maxLift>.45);assert.ok(anchors.size>12);
});

test('correr respeita a parede e não avança durante pausa ou consulta do tablet',()=>{
 const e=engine();e.player.x=95;e.yaw=-Math.PI/2;e.keys={w:true,c:true};tick(e,60);assert.ok(e.player.x<96.2);const x=e.player.x;tick(e,60);assert.equal(e.player.x,x);assert.equal(e.walking,false);
 for(const mode of ['paused','tablet']){const e=engine();e.keys={w:true,c:true};if(mode==='paused')e.paused=true;else e.consultTablet();tick(e,30);assert.equal(e.walkDistance,0);assert.equal(e.running,false);}
});

test('C não altera a velocidade nem a pose de direção da empilhadeira',()=>{
 const engines=[engine(),engine()];
 for(const [i,e] of engines.entries()){
  Object.assign(e.player,{x:11.945,z:-.3});assert.ok(e.usePhysical());tick(e,200);assert.equal(e.vehicleSeat.phase,'driving');
  Object.assign(e.forklift,{x:40,z:-20,angle:0});e.keys={w:true,c:!!i};tick(e,90);assert.equal(e.running,false);assert.equal(e.gait,null);
 }
 assert.equal(engines[0].forklift.x,engines[1].forklift.x);assert.equal(engines[0].forklift.speed,engines[1].forklift.speed);
});
