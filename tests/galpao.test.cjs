const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{join}=require('node:path'),{runInNewContext}=require('node:vm');
const ctx={window:{SCAIGraphics:{uv:()=>[0,0,1,1]}}};
for(const file of ['assets/galpao.js','engine3d.js','assets/malha.js','assets/iluminacao.js','assets/cenario.js','assets/renderizador.js'])runInNewContext(readFileSync(join(__dirname,'..',file),'utf8'),ctx);
const {SCAIWarehouse:hall,SCAI3D:{Engine},SCAIMesh:Mesh,SCAIRenderer:Renderer}=ctx.window;
function engine(){return Object.assign(Object.create(Engine.prototype),{player:{x:15.9,z:3.07,dir:0},canvas:{width:1365,height:864},events:{},keys:{},t:0,walkDistance:0,yaw:0,cameraScale:1,cameraNear:.12,cameraPadding:.22,shutter:{open:0,target:0,blocked:false},door:{open:0,target:0}});}
function advance(e,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)e.update(1/60);}
test('dois painéis comandam o mesmo estado, sem acionamento por proximidade',()=>{
 const e=engine();advance(e,4);assert.equal(e.shutter.open,0);assert.equal(e.physicalAction().kind,'shutter');e.usePhysical();advance(e,3);assert.equal(e.shutter.open,1);
 Object.assign(e.player,{x:17.5,z:3.07});assert.equal(e.physicalAction().label,'Fechar porta');e.usePhysical();advance(e,3);assert.equal(e.shutter.open,0);e.usePhysical();advance(e,3);assert.equal(e.shutter.open,1);
 Object.assign(e.player,{x:40,z:0});assert.equal(e.physicalAction(),null);assert.equal(e.usePhysical(),false);advance(e,3);assert.equal(e.shutter.open,1);
});
test('porta fechada bloqueia, aberta libera e fechamento ocupado pausa sem reabrir',()=>{
 const e=engine();assert.equal(e.canMove(16.6,0),false);e.shutter.target=1;advance(e,3);assert.equal(e.canMove(16.6,0),true);
 Object.assign(e.player,{x:16.6,z:0});e.shutter.target=0;advance(e,3);assert.equal(e.shutter.blocked,true);assert.equal(e.shutter.target,0);assert.ok(hall.canPass(e.shutter.open));assert.ok(e.shutter.open<1);
 Object.assign(e.player,{x:18,z:0});advance(e,3);assert.equal(e.shutter.open,0);assert.equal(e.canMove(16.6,0),false);
});
test('lâminas sobem e recolhem na caixa, sem atravessar o teto ou desaparecer antes da abertura',()=>{
 for(let step=0;step<=20;step++){
  const open=step/20,slats=hall.slatPositions(open);assert.equal(slats.length===0,open===1);
  for(const slat of slats){assert.ok(slat.y-slat.height/2>=hall.layout.floor+open*hall.layout.gateHeight-1e-8);assert.ok(slat.y+slat.height/2<=hall.layout.floor+hall.layout.gateHeight+1e-8);}
 }
});
test('galpão tem piso amplo livre, paredes e teto fechados; passagem é a única abertura',()=>{
 const e=engine();e.shutter.open=1;
 for(let x=18;x<96;x+=3)for(let z=-46;z<7;z+=3)assert.equal(e.canMove(x,z),true,`${x},${z}`);
 for(const [x,z] of [[97,0],[40,28],[40,-48],[16.75,4],[16.75,-4],[14,10],[-13,0]])assert.equal(e.canMove(x,z),false);
 const mesh=new Mesh();hall.build(mesh)();assert.equal(mesh.cameraObjects.length,2,'apenas controles na parede, sem móveis no piso');
 // Confirm shell surfaces exist at the far wall and roof, beyond the old backdrop.
 assert.ok(mesh.v.some((v,i)=>i%12===0&&v>96.7));assert.ok(mesh.v.some((v,i)=>i%12===1&&v>10.8));
});
test('câmera respeita paredes novas e antigas, inclusive quinas e o vão',()=>{
 const e=engine();e.shutter.open=1;
 for(const [x,z] of [[-5,0],[16.3,0],[18,0],[17.3,-44],[40,6.9],[95.9,0],[95.9,-46.9]])for(let i=0;i<72;i++){
  Object.assign(e.player,{x,z});e.yaw=i*Math.PI/36;e.cameraScale=1;e.update(.016);assert.equal(e.cameraPointBlocked(...e.eye),false,`${x},${z},${i}`);assert.ok(e.cameraArmClear([x,1.59,z],e.eye));
 }
});
test('cortina oculta só ao atravessar a câmera e restaura sua matriz após desenhar',()=>{
 const calls=[],gl={uniformMatrix4fv:(key,transpose,matrix)=>calls.push(Array.from(matrix))};
 const r=Object.assign(Object.create(Renderer.prototype),{shutter:{},gl,uniform:{Model:0},drawGeometry(){}}),e=engine();ctx.SCAIWarehouse=hall;
 e.eye=[16.6,2,0];r.drawShutter(e);assert.equal(r.shutterHidden,true);assert.equal(calls.length,0);
 e.eye=[14,3,0];r.drawShutter(e);assert.equal(r.shutterHidden,false);assert.equal(calls.length,15);assert.equal(calls.at(-1)[13],0);
});
