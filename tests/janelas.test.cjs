const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const context={window:{SCAIGraphics:{uv:()=>[0,0,1,1]}}};
for(const file of ['assets/galpao.js','assets/malha.js','assets/iluminacao.js','assets/cenario.js','engine3d.js','assets/renderizador.js','assets/porta.js']){
  runInNewContext(readFileSync(join(__dirname,'..',file),'utf8'),context);
}
context.SCAIMesh=context.window.SCAIMesh;
const {SCAIMesh:Mesh,SCAIWorld:World,SCAIDoor:Door,SCAIRenderer:Renderer,SCAI3D:{Engine},SCAILighting:Lighting}=context.window;
const world=World.build(new Mesh(),{}),door=Door.build(),exteriorFaces=[];
for(let i=0;i<world.length;i+=36)if(world.v[i+11]===14)exteriorFaces.push(i);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
function firstHit(origin,direction,exteriorOnly=false){
  let nearest=Infinity;
  const faces=exteriorOnly?exteriorFaces:Array.from({length:world.length/36},(_,i)=>i*36);
  for(const i of faces){
    const a=Array.from(world.v.slice(i,i+3)),b=Array.from(world.v.slice(i+12,i+15)),c=Array.from(world.v.slice(i+24,i+27));
    const edge1=sub(b,a),edge2=sub(c,a),p=cross(direction,edge2),det=dot(edge1,p);
    if(Math.abs(det)<1e-8)continue;
    const t=sub(origin,a),u=dot(t,p)/det;if(u<0||u>1)continue;
    const q=cross(t,edge1),v=dot(direction,q)/det;if(v<0||u+v>1)continue;
    const distance=dot(edge2,q)/det;if(distance>1e-6)nearest=Math.min(nearest,distance);
  }
  return nearest;
}
function fixture(){
  const calls=[],states={depth:true,blend:false,opacity:1,actor:1,model:null};
  const geometry=(id,mesh)=>({id,count:mesh.length/12});
  const r=Object.assign(Object.create(Renderer.prototype),{
    windows:world.windows.map(p=>({...p,geometry:geometry(p.id,p.mesh)})),hiddenWindows:new Set(),hiddenDoorParts:new Set(),
    door:{leaves:door.leaves.map(p=>({...p,glass:geometry(p.id,p.glass)}))},
    uniform:{Model:'model',Actor:'actor',Opacity:'opacity'},
    drawGeometry:g=>calls.push({id:g.id,...states,model:Array.from(states.model)}),
    gl:{BLEND:1,SRC_ALPHA:2,ONE_MINUS_SRC_ALPHA:3,
      uniform1i:(key,value)=>states[key]=value,uniform1f:(key,value)=>states[key]=value,
      uniformMatrix4fv:(key,transpose,value)=>states[key]=value,blendFunc(){},
      enable:()=>states.blend=true,disable:()=>states.blend=false,depthMask:value=>states.depth=value}
  });
  const e=Object.assign(Object.create(Engine.prototype),{eye:[-6,2,0],cameraPadding:.22,cameraScale:1,hidePlayer:false,door:{open:0}});
  return{r,e,calls,states};
}

test('janelas e porta compartilham vidro real em malhas transparentes separadas',()=>{
  assert.equal(world.windows.length,4);
  assert.equal(Lighting.glass.opacity,.16);
  for(const pane of [...world.windows.map(p=>p.mesh),...door.leaves.map(p=>p.glass)]){
    assert.equal(pane.length/12,6,'um plano de dois triângulos, visível dos dois lados');
    for(let i=0;i<pane.length;i+=12){
      assert.equal(pane.v[i+11],Lighting.glass.material);
      for(let axis=0;axis<3;axis++)assert.ok(Math.abs(pane.v[i+6+axis]-door.leaves[0].glass.v[6+axis])<1e-7);
    }
  }
});

test('as duas fachadas têm vãos livres e o panorama fica longe do vidro',()=>{
  const west=firstHit([-12,2,1],[-1,0,0]),north=firstHit([-6.5,2,7],[0,0,1]);
  assert.ok(west>125&&west<127);assert.ok(north>129&&north<131);
  assert.ok(firstHit([-12,.35,1],[-1,0,0])<1,'o peitoril continua sólido');
  assert.ok(firstHit([-6.5,5,7],[0,0,1])<1,'a parede acima da janela continua sólida');
  const views=[];
  for(let i=0;i<world.length;i+=12)if(world.v[i+11]===14)views.push(Array.from(world.v.slice(i,i+3)));
  assert.ok(views.length>1000);
  for(const point of views)assert.ok(Math.abs(Math.hypot(...sub(point,world.exterior.center))-world.exterior.radius)<1e-4,'o fundo forma uma cobertura distante contínua');
});

test('fundo fechado cobre vistas rasantes e para baixo nos dois lados e cantos das janelas',()=>{
  const edges=new Map(),key=point=>point.map(n=>Math.round(n*10000)).join(',');
  for(const i of exteriorFaces){
    const triangle=[0,12,24].map(offset=>key(Array.from(world.v.slice(i+offset,i+offset+3))));
    if(new Set(triangle).size<3)continue;
    for(let side=0;side<3;side++){
      const edge=[triangle[side],triangle[(side+1)%3]].sort().join('/');edges.set(edge,(edges.get(edge)||0)+1);
    }
  }
  for(const count of edges.values())assert.equal(count,2,'a cobertura não pode ter uma borda aberta');
  for(const side of ['west','north'])for(const along of [-6.5,0,6.5])for(const angle of [-80,-40,0,40,80])for(const pitch of [-42,-25,0,12]){
    const a=angle*Math.PI/180,p=pitch*Math.PI/180,c=Math.cos(p);
    const origin=side==='west'?[-12.3,1.8,along]:[-6.5+along*.8,1.8,7.25];
    const direction=side==='west'?[-Math.cos(a)*c,Math.sin(p),Math.sin(a)*c]:[Math.sin(a)*c,Math.sin(p),Math.cos(a)*c];
    const hit=firstHit(origin,direction,true);
    assert.ok(Number.isFinite(hit)&&hit<260,`${side}, ${along}, ${angle}, ${pitch}: ${hit}`);
  }
});

test('movimento lateral produz paralaxe diferente no caixilho e na cidade',()=>{
  const pane=world.windows.find(p=>p.id==='window:west');
  const frameDistance=Math.abs(pane.center[0]-(-8)),cityDistance=firstHit([-8,2,0],[-1,0,0],true);
  const frameShift=1/frameDistance,cityShift=1/cityDistance;
  assert.ok(frameShift>cityShift*4,'o caixilho próximo deve se deslocar muito mais que o cenário distante');
});

test('transparências são desenhadas do fundo para a frente e restauram o estado de profundidade',()=>{
  const {r,e,calls,states}=fixture();r.drawTransparent(e);
  assert.equal(calls.length,6);
  const centers=new Map([...world.windows.map(p=>[p.id,p.center]),...door.leaves.map(p=>[p.id,[.13,2.5,p.side*1.3]])]);
  let previous=Infinity;
  for(const call of calls){
    assert.equal(call.depth,false);assert.equal(call.blend,true);assert.equal(call.opacity,.16);assert.equal(call.actor,0);
    const distance=centers.get(call.id).reduce((sum,v,i)=>sum+(v-e.eye[i])**2,0);
    assert.ok(distance<=previous);previous=distance;
  }
  assert.equal(states.depth,true);assert.equal(states.blend,false);assert.equal(states.opacity,1);assert.equal(states.actor,1);
  e.door.open=1;calls.length=0;r.drawTransparent(e);
  for(const call of calls.filter(c=>c.id.startsWith('leaf:')))assert.ok(Math.abs(call.model[14]-door.leaves.find(p=>p.id===call.id).side*2.55)<1e-6);
});

test('atravessar um vidro oculta só aquele plano e não altera o zoom',()=>{
  const {r,e,calls}=fixture();e.eye=[-12.65,2.47,-.15];r.drawTransparent(e);
  assert.ok(r.hiddenWindows.has('window:west'));assert.ok(!calls.some(c=>c.id==='window:west'));
  assert.ok(calls.some(c=>c.id==='window:north'));assert.equal(e.cameraScale,1);assert.equal(e.hidePlayer,false);
  e.eye=[-6,2,0];calls.length=0;r.drawTransparent(e);
  assert.equal(r.hiddenWindows.size,0);assert.ok(calls.some(c=>c.id==='window:west'));
});

test('o exterior distante permanece no alcance da câmera sem liberar a saída do jogador',()=>{
  const e=Object.assign(Object.create(Engine.prototype),{canvas:{width:1365,height:864},player:{x:15.6,z:0,dir:0},
    events:{},keys:{},t:0,walkDistance:0,yaw:Math.PI/2,cameraScale:1,cameraNear:.12,cameraPadding:.22,hidePlayer:false});
  e.update(.016);
  const point=[-138,2,-2],m=e.vp,w=m[3]*point[0]+m[7]*point[1]+m[11]*point[2]+m[15];
  const depth=(m[2]*point[0]+m[6]*point[1]+m[10]*point[2]+m[14])/w;
  assert.ok(w>0&&depth>-1&&depth<1,'o horizonte não pode ser cortado pelo plano distante');
  assert.equal(e.canMove(-12.4,1),false);assert.equal(e.canMove(-6,7.3),false);
});
