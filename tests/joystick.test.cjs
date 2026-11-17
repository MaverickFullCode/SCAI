const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c={window:{}};for(const file of ['assets/galpao.js','assets/empilhadeira.js','engine3d.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
const {SCAI3D:{Engine},SCAIForklift:car}=c.window;
function engine(){return Object.assign(Object.create(Engine.prototype),{canvas:{width:1365,height:864},player:{x:40,z:-20,dir:.7},events:{},keys:{},t:0,walkDistance:0,yaw:-1.4,cameraScale:1,cameraNear:.12,cameraPadding:.22,forklift:car.create(),shutter:{open:1,target:1},door:{open:0,target:0}});}
function tick(e,n){for(let i=0;i<n;i++)e.update(1/60);}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} deve ser próximo de ${b}`);

test('oito direções seguem a câmera, independentemente da orientação inicial do corpo',()=>{
 for(let sector=0;sector<8;sector++){
  const e=engine(),angle=sector*Math.PI/4,expected=angle-e.yaw,x=Math.sin(angle),y=-Math.cos(angle);
  for(let i=0;i<60;i++){e.setJoystick(x,y);e.update(1/60);}
  near(e.walkDistance,3.6);near(e.player.x-40,Math.sin(expected)*3.6);near(e.player.z+20,-Math.cos(expected)*3.6);
  near(Math.sin(e.player.dir),Math.sin(expected));near(Math.cos(e.player.dir),Math.cos(expected));
  const before={...e.player};e.yaw+=2;tick(e,30);const heading=angle-e.yaw;near(Math.sin(e.player.dir),Math.sin(heading));near(Math.cos(e.player.dir),Math.cos(heading));
  near(e.player.x-before.x,Math.sin(heading)*1.8);near(e.player.z-before.z,-Math.cos(heading)*1.8);
 }
});

test('distância do centro controla velocidade, com zona neutra, limite e corrida por C',()=>{
 for(const [radius,power] of [[0,0],[.08,0],[.34,.25],[.56,.5],[1,1],[4,1]])for(const running of [false,true]){
  const e=engine();e.keys.c=running;e.setJoystick(0,-radius);tick(e,60);near(e.walkDistance,(running?7.2:3.6)*power);
  assert.equal(e.walking,power>0);if(power>0)assert.equal(e.running,running);
 }
 const slow=engine();slow.setJoystick(0,-.125);tick(slow,60);assert.ok(slow.walking&&slow.walkDistance>0&&slow.walkDistance<.1,'pequenos movimentos também animam os passos');
});

test('voltar ao centro para; puxar para cima novamente segue a câmera, sem usar o corpo virado para trás',()=>{
 const e=engine();e.setJoystick(0,1);tick(e,30);const heading=-e.yaw,position={...e.player};
 e.setJoystick(0,0);tick(e,30);assert.equal(e.joystick,null);assert.equal(e.walking,false);assert.equal(e.player.x,position.x);assert.equal(e.player.z,position.z);
 e.setJoystick(0,-1);tick(e,30);near(e.player.dir,heading);near(e.player.x-position.x,Math.sin(heading)*1.8);near(e.player.z-position.z,-Math.cos(heading)*1.8);
});

test('girar a câmera enquanto segura o controle atualiza o rumo a cada quadro',()=>{
 for(const key of ['arrowleft','arrowright']){
  const e=engine();e.setJoystick(1,-1);e.keys[key]=true;
  for(let i=0;i<60;i++){e.update(1/60);near(e.player.dir,Math.PI/4-e.yaw);}
 }
});

test('colisões limitam o movimento e bloquear o controle cancela a entrada pendente',()=>{
 const e=engine();Object.assign(e.player,{x:95,dir:0});e.yaw=-Math.PI/2;e.setJoystick(0,-1);tick(e,120);assert.ok(e.player.x<96.2);const x=e.player.x;tick(e,30);assert.equal(e.player.x,x);
 for(const block of ['paused','dialogue','tablet']){
  const e=engine();e.setJoystick(0,-1);if(block==='paused')e.paused=true;else if(block==='dialogue')e.events.isBlocked=()=>true;else e.consultTablet();
  tick(e,6);assert.equal(e.joystick,null);near(e.walkDistance,0);assert.equal(e.walking,false);
 }
});

test('controle circular também permite acelerar, virar e dar ré na empilhadeira',()=>{
 const e=engine();Object.assign(e.player,{x:11.945,z:-.3});e.usePhysical();tick(e,200);assert.equal(e.vehicleSeat.phase,'driving');
 Object.assign(e.forklift,{x:40,z:-20,angle:0});e.setJoystick(0,-1);tick(e,120);assert.equal(e.forklift.speed,10);
 e.setJoystick(1,-1);tick(e,30);assert.ok(e.forklift.angle>0);assert.ok(e.forklift.steer>0);
 e.setJoystick(0,1);tick(e,180);assert.equal(e.forklift.speed,-5.2);e.setJoystick(0,0);tick(e,60);assert.equal(e.forklift.speed,0);
});
