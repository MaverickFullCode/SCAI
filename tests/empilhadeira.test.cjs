const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c={window:{}};for(const f of ['assets/galpao.js','assets/empilhadeira.js','engine3d.js','assets/personagens.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);
const {SCAIForklift:car,SCAI3D:{Engine},SCAIPeople:people}=c.window;
function engine(){return Object.assign(Object.create(Engine.prototype),{canvas:{width:1365,height:864},player:{x:11.945,z:-.3,dir:0},events:{},keys:{},t:0,walkDistance:0,yaw:0,cameraScale:1,cameraNear:.12,cameraPadding:.22,forklift:car.create(),shutter:{open:1,target:1},door:{open:0,target:0}});}
function tick(e,n){for(let i=0;i<n;i++)e.update(1/60);}
test('E entra pelo lado mais próximo, senta e sai, preservando o estacionamento e sem colisão fantasma',()=>{
 for(const side of [-1,1]){const e=engine();e.player.z=-1.35+side*1.05;assert.equal(e.physicalAction().kind,'vehicle');assert.ok(e.usePhysical());assert.equal(e.vehicleSeat.side,side);tick(e,180);assert.equal(e.vehicleSeat.phase,'driving');assert.equal(e.vehicleSeat.blend,1);
  Object.assign(e.forklift,{x:40,z:-20,angle:.4});tick(e,1);const parked={...e.forklift};assert.ok(e.usePhysical());tick(e,180);assert.equal(e.vehicleSeat,null);assert.ok(e.canMove(e.player.x,e.player.z));assert.equal(e.canMove(12.615,-1.35),true);assert.equal(e.forklift.x,parked.x);assert.equal(e.forklift.angle,parked.angle);assert.equal(e.canMove(40,-20),false);}
});
test('movimento usa aceleração, direção de carro, ré e pneus proporcionais à distância',()=>{
 const v=car.create(),env={inside:()=>true,boxes:[],circles:[]};v.x=30;v.z=-20;
 car.move(v,1,1,0,env);assert.ok(v.x>30);for(let i=0;i<4;i++)assert.ok(Math.abs(v.wheelAngles[i]+(v.x-30)/car.wheels[i].r)<1e-6);
 const a=v.angle;car.move(v,.5,1,-1,env);assert.ok(v.angle<a);assert.ok(v.steer<0);car.move(v,1,1,0,env);assert.equal(v.steer,0);
 for(let i=0;i<180;i++)car.move(v,1/60,-1,0,env);assert.ok(v.speed<0);const phases=[...v.wheelAngles];car.move(v,.2,-1,0,env);for(let i=0;i<4;i++)assert.ok(v.wheelAngles[i]>phases[i]);
});
test('paredes e móveis param o veículo e os pneus sem atravessar ou girar no lugar',()=>{
 const v=car.create(),env={inside:()=>true,boxes:[{x:16.75,z:-1.35,hx:.1,hz:5}],circles:[]};for(let i=0;i<240;i++)car.move(v,1/60,1,0,env);const stopped={x:v.x,angles:[...v.wheelAngles]};for(let i=0;i<60;i++)car.move(v,1/60,1,0,env);assert.equal(v.x,stopped.x);assert.deepEqual([...v.wheelAngles],stopped.angles);
});
test('porta de ferro ocupada pelo veículo pausa o fechamento',()=>{
 const e=engine();Object.assign(e.forklift,{x:17,z:0});e.shutter.target=0;tick(e,150);assert.ok(e.shutter.blocked);assert.ok(e.shutter.open*3.6>=car.shape.height+.04);
});
test('mão esquerda acompanha o aro, e tablet permanece ancorado à mão direita',()=>{
 const point=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
 for(const steer of [-.53,0,.53]){const rig=people.pose(0,0,.3,false,'auditor',0,false,0,0,1,0,0,{blend:1,stepLift:0,grip:1,offsetZ:0,steer});const palm=point(rig.handL,[-.456,1.520,-.055]),phi=-Math.PI/2+steer*1.65;
  const expected=[.15*Math.sin(phi),1.9+.1160936*Math.cos(phi),-.484-.09498567*Math.cos(phi)];assert.ok(Math.hypot(...palm.map((x,i)=>x-expected[i]))<.0002);const a=point(rig.foreL,[-.456,1.595,-.055]),b=point(rig.handL,[-.456,1.595,-.055]);assert.ok(Math.hypot(...a.map((x,i)=>x-b[i]))<.0002,'punho deve permanecer ligado ao antebraço');if(steer===0){const thumb=point(rig.handL,[-.418,1.490,-.131]);assert.ok(thumb[1]>palm[1],'polegar deve ficar voltado para cima no volante centralizado');}assert.deepEqual(Array.from(rig.tablet),Array.from(rig.handR));for(const m of Object.values(rig))assert.ok([...m].every(Number.isFinite));}
});

test('contatos na frente e atrás também encaminham para uma lateral livre',()=>{
 for(const dx of [-1.51,2.39]){const e=engine();e.player.x=e.forklift.x+dx;e.player.z=e.forklift.z;assert.ok(e.canMove(e.player.x,e.player.z));assert.ok(e.vehicleContact());assert.ok(e.usePhysical());tick(e,350);assert.equal(e.vehicleSeat.phase,'driving');}
});

test('velocidade máxima dobrou nos dois sentidos e F continua disponível durante a direção',()=>{
 const e=engine();e.usePhysical();tick(e,200);Object.assign(e.forklift,{x:40,z:-20,angle:0});e.keys.w=true;tick(e,120);assert.equal(e.forklift.speed,10);assert.equal(e.consultTablet(),true);
 const before=e.forklift.x;tick(e,60);assert.ok(e.forklift.x>before);assert.ok(e.tabletRead.screen);e.usePhysical();assert.equal(e.vehicleSeat.phase,'alighting');tick(e,180);assert.equal(e.vehicleSeat,null);
 const v=car.create(),env={inside:()=>true,boxes:[],circles:[]};for(let i=0;i<120;i++)car.move(v,1/60,-1,0,env);assert.equal(v.speed,-5.2);
});
test('embarque e desembarque mantêm apoio nos pés e a cabeça abaixo do teto',()=>{
 const point=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
 for(const side of [-1,1])for(let i=20;i<=100;i++){
  const d=car.boarding(i/100,side);d.steer=0;const rig=people.pose(0,0,0,false,'auditor',0,false,0,0,d.blend,0,0,d);
  assert.ok(point(rig.head,[0,3.155,0])[1]<3.24,'cabeça não pode tocar o teto');if(i>=70&&i<=90)assert.ok(d.rootY>=0,'quadril deve passar acima da almofada antes de sentar');
  assert.ok(d.feet.some(f=>Math.min(...[-.045,.37,.739].map(y=>Math.abs(f.y-y)))<1e-7),'um pé deve permanecer apoiado');
  for(const f of d.feet){const n=f.side<0?'L':'R',bind=[f.side*.166,.195,.010],a=point(rig['shin'+n],bind),b=point(rig['foot'+n],bind);assert.ok(Math.hypot(...a.map((v,j)=>v-b[j]))<.001,'canela deve permanecer ligada ao pé');const sole=point(rig['foot'+n],[f.side*.166,.012,.010]);assert.ok(Math.abs(sole[1]-f.y)<.00001,'sola deve tocar o apoio previsto');}
 }
});
