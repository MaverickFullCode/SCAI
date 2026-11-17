/* SCAI Engine 3D Alpha — geometria WebGL real, sem bibliotecas externas. */
(function (global) {
  'use strict';
  const V = (x,y,z) => [x,y,z];
  const HEX = (h) => { h=h.replace('#',''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); };
  const C = {
    sky:HEX('#e8eff6'), white:HEX('#f4f6f8'), wall:HEX('#c9d7e1'), wallAlt:HEX('#d7e1e8'),
    floor:HEX('#d7dfe4'), tile:HEX('#e5e8ea'), ceiling:HEX('#edf2f4'), ceilingSeam:HEX('#d3dde2'), lightPanel:HEX('#fff8df'), steel:HEX('#416387'), navy:HEX('#223e62'),
    blue:HEX('#376fa1'), blueLight:HEX('#7eb0d3'), orange:HEX('#ff962f'), yellow:HEX('#f0c15f'),
    wood:HEX('#b88b68'), woodLight:HEX('#d3a47d'), woodDark:HEX('#8c674e'),
    dark:HEX('#334558'), gray:HEX('#647685'), grayLight:HEX('#b4c2cd'), contactShadow:HEX('#bec9d1'),
    glass:HEX('#a5c9da'), green:HEX('#35a761'), teal:HEX('#38a995'), leaves:HEX('#4b956f'), brown:HEX('#90664f'),
    card:HEX('#f1f0ea'), skin:HEX('#e9b590'), hair:HEX('#47352e'), shadow:HEX('#b3bec8'),
    pallet:HEX('#a47b55'), box:HEX('#c89d72'), boxLight:HEX('#ddb88e'), red:HEX('#d26a5b'),
  };
  const PLAYER_RADIUS=.34;
  const CHAIRS=[
    ...[-10.12,-8.85,-7.58].flatMap(x=>[{x,z:-4.62,facing:1},{x,z:-1.92,facing:-1}]),
    {x:-8.8,z:4.9,facing:-1},{x:-4.3,z:4.9,facing:-1},
    {x:5.65,z:3.15,facing:-1,occupant:'worker'}
  ].map((chair,index)=>({...chair,id:'chair-'+index,dir:chair.facing>0?Math.PI:0}));
  const WORKER_DESK={x:5.65,z:2.05,hx:1,hz:.48,top:1.58};
  const WORKER=CHAIRS.find(chair=>chair.occupant==='worker');
  const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  const turn=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*t;
  const warehouse=global.SCAIWarehouse;
  const WALL_BOXES=[
    ...(warehouse?.walls||[]),
    {x:0,z:-5.15,hx:.085,hz:2.55,top:5.42},{x:0,z:5.15,hx:.085,hz:2.55,top:5.42}
  ];
  const CAMERA_WALLS=[...WALL_BOXES,...(warehouse?.cameraWalls.slice(warehouse.walls.length)||[])];
  const CAMERA_ROOM=warehouse?.layout.cameraRoom||{min:[-12.54,.12,-7.43],max:[16.61,6.02,7.49]};
  const WALK_BOXES=[
    ...WALL_BOXES,
    {x:-8.85,z:-3.25,hx:2.225,hz:.86,top:1.40},
    ...[-10.12,-8.85,-7.58].flatMap(x=>[
      {x,z:-4.62,hx:.325,hz:.37,top:1.97},{x,z:-1.92,hx:.325,hz:.37,top:1.97}
    ]),
    {x:-4.3,z:3.8,hx:1.175,hz:.46,top:2.25},{x:-8.8,z:3.8,hx:1.175,hz:.46,top:2.25},
    {x:-4.3,z:4.9,hx:.325,hz:.37,top:1.97},{x:-8.8,z:4.9,hx:.325,hz:.37,top:1.97},
    {x:-3.4,z:-5.55,hx:1,hz:.28,top:2.30},
    ...[4.5,9.3,14.1].flatMap(x=>[-5.75,5.75].map(z=>({x,z,hx:1.55,hz:.68,top:5.25}))),
    {x:5.1,z:-1.4,hx:1.55,hz:.425,top:1.16},
    {x:12.615,z:-1.35,hx:1.64,hz:.57,top:3.12},
    WORKER_DESK,
    {x:5.65,z:3.15,hx:.325,hz:.37,top:1.97},
    {x:15,z:1.4,hx:.38,hz:.31,top:2.45}
  ];
  const WALK_CIRCLES=[
    {x:-11.6,z:5.9,r:.68},
    {x:-6.55,z:-6.25,r:.55},
    {x:-1.4,z:-6.2,r:.65},
    {x:-10.7,z:-5.2,r:.42}
  ];
  const m4 = {
    perspective(fov,asp,n,f){const t=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;},
    lookAt(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2]; let d=Math.hypot(zx,zy,zz)||1;zx/=d;zy/=d;zz/=d;
      let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx; d=Math.hypot(xx,xy,xz)||1;xx/=d;xy/=d;xz/=d;
      const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
      return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1]);},
    mul(a,b){const out=new Float32Array(16); for(let c=0;c<4;c++)for(let r=0;r<4;r++) {let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];out[c*4+r]=s;}return out;},
    project(p,m){let x=p[0],y=p[1],z=p[2];let w=m[3]*x+m[7]*y+m[11]*z+m[15]; if(w<=.01)return null; return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,(m[2]*x+m[6]*y+m[10]*z+m[14])/w];}
  };
  class Engine {
    constructor(canvas,options={}){
      this.canvas = canvas;
      this.events = options;
      this.gl = canvas.getContext('webgl', {alpha:false, antialias:true, depth:true, powerPreference:'default'});
      if (!this.gl) throw Error('WebGL indisponível neste navegador.');
      this.renderer = new SCAIRenderer(this.gl, C);
      // The auditor arrives in the central aisle in view of the meeting room.
      this.player = {x:-5.2, z:-.25, dir:2.75};
      this.yaw = .78;
      this.keys = {};
      this.t = 0;
      this.walkDistance = 0;
      this.eye = [0, 3, 0];
      this.vp = null;
      this.paused = false;
      this.low = false;
      this.last = 0;
      this.acc = 0;
      this.cameraScale = 1;
      this.cameraNear = .12;
      this.cameraPadding = .22;
      this.hidePlayer = false;
      this.door = {open:0,target:0};
      this.shutter = {open:0,target:0,blocked:false};
      this.seating = null;
      this.tabletRead = null;
      this.workerTalk = null;
      this.bind();this.resize();this.loop=this.loop.bind(this);requestAnimationFrame(this.loop);
    }
    bind() {
      const canvas = this.canvas;
      let cameraPointer = null, lastX = 0;
      document.addEventListener('keydown', event => {
        const key = event.key.toLowerCase();
        if (['w','s','a','d','arrowup','arrowdown','arrowleft','arrowright','e','q','f',' '].includes(key)) {
          if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
          event.preventDefault();
        }
        this.keys[key] = true;
        if(!event.repeat&&!this.events.isBlocked?.()){
          if(key==='q'&&!this.seating&&!this.tabletRead)this.events.onInteract?.();
          if(key==='e')this.usePhysical();
          if(key==='f')this.consultTablet();
        }
      });
      document.addEventListener('keyup', event => {
        this.keys[event.key.toLowerCase()] = false;
      });
      canvas.addEventListener('pointerdown', event => {
        if (cameraPointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        cameraPointer = event.pointerId;
        lastX = event.clientX;
        canvas.setPointerCapture?.(event.pointerId);
      });
      canvas.addEventListener('pointermove', event => {
        if (event.pointerId !== cameraPointer) return;
        this.yaw -= (event.clientX-lastX)*.006;
        lastX = event.clientX;
      });
      const endCameraDrag = event => {
        if (event.pointerId === cameraPointer) cameraPointer = null;
      };
      for (const type of ['pointerup','pointercancel','lostpointercapture']) {
        canvas.addEventListener(type, endCameraDrag);
      }
      const resetInput = () => {
        this.keys = {};
        cameraPointer = null;
      };
      window.addEventListener('blur', resetInput);
      window.addEventListener('pagehide', resetInput);
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => {
        this.paused = document.hidden;
        if (this.paused) resetInput();
      });
    }
    resize(){const scale=this.low?.68:1;const dpr=Math.min(devicePixelRatio||1,1.3)*scale;const w=Math.max(2,Math.floor(this.canvas.clientWidth*dpr)),h=Math.max(2,Math.floor(this.canvas.clientHeight*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h)}}
    setEco(val){this.low=!!val;this.resize()}
    setInput(key,val){this.keys[key]=val}
    consultTablet(){
      if(this.paused||this.events.isBlocked?.()||this.tabletRead||this.workerTalk||(this.seating&&this.seating.phase!=='seated'))return false;
      this.tabletRead={elapsed:0,blend:0,screen:false};this.walking=false;return true;
    }
    updateTablet(dt){
      const read=this.tabletRead;if(!read)return;
      read.elapsed+=dt;
      read.blend=read.elapsed<.55?ease(read.elapsed/.55):read.elapsed<3.55?1:1-ease((read.elapsed-3.55)/.55);
      read.screen=read.elapsed>=.55&&read.elapsed<3.55;
      if(read.elapsed>=4.1)this.tabletRead=null;
    }
    doorBoxes(open=this.door?.open??1){
      return [-1,1].map(side=>({x:.12,z:side*(1.3+2.55*open),hx:.065,hz:1.3,top:5.05}));
    }
    nearbyChair(){
      const p=this.player;
      return CHAIRS.filter(chair=>{
        if(chair.occupant)return false;
        const dx=chair.x-p.x,dz=chair.z-p.z;
        const gap=Math.hypot(Math.max(Math.abs(dx)-.325,0),Math.max(Math.abs(dz)-.37,0));
        return gap<=PLAYER_RADIUS+.09;
      }).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]||null;
    }
    workerContact(){
      const p=this.player,gap=box=>Math.hypot(Math.max(Math.abs(p.x-box.x)-box.hx,0),Math.max(Math.abs(p.z-box.z)-box.hz,0));
      return Math.min(gap(WORKER_DESK),gap({x:WORKER.x,z:WORKER.z-.035,hx:.42,hz:.48}))<=PLAYER_RADIUS+.075;
    }
    workerApproach(){
      const start={x:this.player.x,z:this.player.z},front={x:WORKER_DESK.x,z:WORKER_DESK.z-WORKER_DESK.hz-PLAYER_RADIUS-.12};
      const left=WORKER_DESK.x-WORKER_DESK.hx-PLAYER_RADIUS-.15,right=WORKER_DESK.x+WORKER_DESK.hx+PLAYER_RADIUS+.15,back=WORKER.z+.37+PLAYER_RADIUS+.18;
      const points=[start,front,{x:left,z:front.z},{x:right,z:front.z},{x:left,z:back},{x:right,z:back}];
      const clear=(a,b)=>{const steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.075);for(let i=1;i<=steps;i++)if(!this.canMove(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps))return false;return true;};
      const distance=points.map(()=>Infinity),previous=[],visited=new Set();distance[0]=0;
      for(let step=0;step<points.length;step++){
        let current=-1;for(let i=0;i<points.length;i++)if(!visited.has(i)&&(current<0||distance[i]<distance[current]))current=i;
        if(current<0||!Number.isFinite(distance[current]))break;if(current===1){const path=[];for(let i=1;i!==0;i=previous[i])path.unshift(points[i]);return path;}
        visited.add(current);
        for(let i=1;i<points.length;i++)if(!visited.has(i)&&clear(points[current],points[i])){const d=distance[current]+Math.hypot(points[i].x-points[current].x,points[i].z-points[current].z);if(d<distance[i]){distance[i]=d;previous[i]=current;}}
      }
      return null;
    }
    finishWorkerTalk(){
      if(this.workerTalk){Object.assign(this.workerTalk,{phase:'returning',elapsed:0,returnLook:this.workerTalk.look,moving:false});this.keys={};}
    }
    updateWorkerTalk(dt){
      const talk=this.workerTalk;if(!talk)return;
      if(talk.phase==='approaching'){
        if(this.followSeatPath(talk,dt)){talk.moving=false;talk.phase='facing';talk.elapsed=0;talk.turnStart=this.player.dir;}
      }else if(talk.phase==='facing'){
        talk.elapsed+=dt;this.player.dir=turn(talk.turnStart,Math.PI,ease(talk.elapsed/.28));
        if(talk.elapsed>=.28){talk.phase='looking';talk.elapsed=0;}
      }else if(talk.phase==='looking'){
        talk.elapsed+=dt;talk.look=ease(talk.elapsed/.45);
        if(talk.elapsed>=.45){talk.phase='speaking';this.keys={};this.events.onWorkerTalk?.();}
      }else if(talk.phase==='returning'){
        talk.elapsed+=dt;talk.look=talk.returnLook*(1-ease(talk.elapsed/.55));
        if(talk.elapsed>=.55)this.workerTalk=null;
      }
    }
    physicalAction(){
      if(this.workerTalk)return{kind:'worker-busy',title:'Trabalhador do galpão',label:this.workerTalk.phase==='returning'?'Voltando ao trabalho…':'Aguarde…',hint:'A conversa começa quando o auditor estiver de frente à mesa.',disabled:true};
      const seat=this.seating;
      if(seat)return{kind:'stand',title:'Cadeira',label:seat.phase==='seated'?'Levantar':seat.phase==='aligning'?'Posicionando…':seat.phase==='sitting'?'Sentando…':seat.phase==='leaving'?'Saindo…':'Levantando…',hint:seat.phase==='seated'?'E para levantar da cadeira':'Aguarde a animação terminar.',disabled:seat.phase!=='seated'};
      if(this.workerContact())return{kind:'worker',title:'Trabalhador do galpão',label:'Conversar',hint:'E ou botão: aproximar-se da frente da mesa e conversar',disabled:false};
      if(this.nearbyChair())return{kind:'chair',title:'Cadeira de escritório',label:'Sentar',hint:'E para sentar nesta cadeira',disabled:false};
      const p=this.player;
      const panel=warehouse?.layout.panels.find(panel=>(p.x-warehouse.layout.wallX)*panel.side>=0&&Math.hypot(p.x-panel.x,p.z-panel.z)<1.3);
      if(panel)return{kind:'shutter',title:'Porta de enrolar · galpão maior',label:this.shutter?.target?'Fechar porta':'Abrir porta',hint:'E ou botão: abrir / fechar pelo painel',disabled:false};
      if(Math.abs(p.x)<1.65&&Math.abs(p.z)<2.35){
        const d=Math.abs(p.x),dot=(p.x>0?-1:1)*Math.sin(p.dir);
        if(d<.25||dot>.55)return{kind:'door',title:'Porta de vidro · escritório / galpão',label:this.door?.target?'Fechar porta':'Abrir porta',hint:'E para abrir ou fechar a passagem',disabled:false};
      }
      return null;
    }
    seatExit(seat){
      const c=seat.chair,f=c.facing;
      const candidates=[seat.start,{x:c.x,z:c.z+f*.85},...[1,-1].flatMap(s=>[
        {x:c.x+s*.85,z:c.z},{x:c.x+s*.75,z:c.z+f*.76},{x:c.x+s*.75,z:c.z-f*.76}
      ]),{x:c.x,z:c.z-f*.85}];
      return candidates.find(p=>this.canMove(p.x,p.z))||null;
    }
    seatApproach(chair,start){
      const f=chair.facing,front={x:chair.x,z:chair.z+f*.44},path=[];
      // Reach the front of the cushion before bending. Side/back contacts route
      // around the backrest instead of sliding the standing body through it.
      if((start.z-chair.z)*f<.30){
        const side=start.x<chair.x?-1:1;
        if((start.z-chair.z)*f<-.25)path.push({x:chair.x+side*.66,z:chair.z-f*.56});
        path.push({x:chair.x+side*.66,z:front.z});
      }
      path.push(front);return path;
    }
    followSeatPath(seat,dt){
      const point=seat.path[seat.pathIndex];
      if(!point){seat.moving=false;return true;}
      const dx=point.x-this.player.x,dz=point.z-this.player.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*2.0);
      if(d>.00001){
        this.player.x+=dx/d*step;this.player.z+=dz/d*step;
        this.player.dir=turn(this.player.dir,Math.atan2(dx,-dz),Math.min(1,dt*12));
        this.walkDistance+=step;
      }
      seat.moving=step>.0001;
      if(d<=step+.00001)seat.pathIndex++;
      return seat.pathIndex>=seat.path.length;
    }
    usePhysical(){
      if(this.paused||this.events.isBlocked?.()||this.tabletRead)return false;
      const action=this.physicalAction();if(!action||action.disabled)return false;
      if(action.kind==='worker'){
        const path=this.workerApproach();if(!path){this.events.onNotice?.('O caminho até a frente da mesa está bloqueado. Tente pelo outro lado.');return false;}
        this.workerTalk={phase:'approaching',path,pathIndex:0,moving:false,look:0};this.keys={};return true;
      }
      if(action.kind==='shutter'){
        this.shutter.target=this.shutter.target?0:1;return true;
      }
      if(action.kind==='door'){
        this.door.target=this.door.target?0:1;return true;
      }
      if(action.kind==='stand'){
        const exit=this.seatExit(this.seating);
        if(!exit){this.events.onNotice?.('A saída da cadeira está bloqueada. Tente novamente quando houver espaço.');return false;}
        Object.assign(this.seating,{phase:'standing',elapsed:0,exit});return true;
      }
      const chair=this.nearbyChair();if(!chair)return false;
      const start={...this.player},path=this.seatApproach(chair,start);
      this.seating={chair,phase:'aligning',elapsed:0,blend:0,start,path,pathIndex:0,approach:path.map(p=>({...p}))};
      this.walking=false;return true;
    }
    updateFurniture(dt){
      if(warehouse&&this.shutter){
        const gate=this.shutter,p=this.player,layout=warehouse.layout;
        const next=gate.open+Math.sign(gate.target-gate.open)*Math.min(Math.abs(gate.target-gate.open),dt*.40);
        const occupied=Math.abs(p.x-layout.gateX)<.09+PLAYER_RADIUS+.16&&Math.abs(p.z)<layout.gateHalfWidth+PLAYER_RADIUS+.12;
        const unsafe=next<gate.open&&occupied&&!warehouse.canPass(next);
        if(unsafe){if(!gate.blocked)this.events.onNotice?.('Passagem ocupada: fechamento pausado. Saia do vão para a porta fechar.');}
        else gate.open=next;
        gate.blocked=unsafe;
      }
      const door=this.door;
      if(door){
        const next=door.open+Math.sign(door.target-door.open)*Math.min(Math.abs(door.target-door.open),dt*1.05);
        const p=this.player;
        // An obstruction pauses a previously requested close; proximity never
        // starts an opening or closing operation or reverses the chosen target.
        const unsafe=next<door.open&&Math.abs(p.x-.12)<.065+PLAYER_RADIUS+.10&&this.doorBoxes(next).some(b=>Math.abs(p.z-b.z)<b.hz+PLAYER_RADIUS+.16);
        if(unsafe){if(!door.blocked)this.events.onNotice?.('Passagem ocupada: fechamento pausado.');}
        else door.open=next;
        door.blocked=unsafe;
      }
      const seat=this.seating;if(!seat)return;
      seat.elapsed+=dt;
      const c=seat.chair,anchor={x:c.x,z:c.z+c.facing*.035};
      if(seat.phase==='aligning'){
        if(this.followSeatPath(seat,dt)){
          if(seat.turnStart===undefined){seat.turnStart=this.player.dir;seat.turnTime=0;}
          seat.moving=false;seat.turnTime+=dt;
          this.player.dir=turn(seat.turnStart,c.dir,ease(seat.turnTime/.26));
          if(seat.turnTime>=.26){seat.phase='sitting';seat.elapsed=0;seat.front={x:this.player.x,z:this.player.z};}
        }
      }else if(seat.phase==='sitting'){
        seat.moving=false;
        const t=Math.min(1,seat.elapsed/.9),move=ease(t);
        this.player.x=seat.front.x+(anchor.x-seat.front.x)*move;
        this.player.z=seat.front.z+(anchor.z-seat.front.z)*move;
        this.player.dir=c.dir;
        seat.blend=move;
        if(t===1)seat.phase='seated';
      }else if(seat.phase==='standing'){
        const t=Math.min(1,seat.elapsed/.95),move=ease(t);
        this.player.x=anchor.x+(seat.front.x-anchor.x)*move;
        this.player.z=anchor.z+(seat.front.z-anchor.z)*move;
        seat.blend=1-ease(t);
        if(t===1){
          seat.phase='leaving';seat.path=[...seat.approach.slice(0,-1).reverse(),seat.exit];seat.pathIndex=0;
        }
      }else if(seat.phase==='leaving'){
        if(this.followSeatPath(seat,dt)){this.player.x=seat.exit.x;this.player.z=seat.exit.z;this.seating=null;}
      }
    }
    canMove(x,z){
      if(warehouse){
        if(!warehouse.walkInside(x,z))return false;
        const layout=warehouse.layout;
        if(!warehouse.canPass(this.shutter?.open||0)&&Math.abs(x-layout.gateX)<.04+PLAYER_RADIUS&&Math.abs(z)<layout.gateHalfWidth+PLAYER_RADIUS)return false;
      }else if(x < -12.05||x>16.2||z < -7.08||z>7.04)return false;
      const radiusSq=PLAYER_RADIUS*PLAYER_RADIUS;
      for(const box of this.doorBoxes()){
        if(Math.hypot(Math.max(Math.abs(x-box.x)-box.hx,0),Math.max(Math.abs(z-box.z)-box.hz,0))<PLAYER_RADIUS)return false;
      }
      for(const box of WALK_BOXES){
        const nearX=Math.max(box.x-box.hx,Math.min(x,box.x+box.hx));
        const nearZ=Math.max(box.z-box.hz,Math.min(z,box.z+box.hz));
        if((x-nearX)**2+(z-nearZ)**2<radiusSq)return false;
      }
      for(const circle of WALK_CIRCLES){const r=PLAYER_RADIUS+circle.r;if((x-circle.x)**2+(z-circle.z)**2<r*r)return false;}
      return true;
    }
    faceTarget(pos){const dx=pos[0]-this.player.x,dz=pos[1]-this.player.z;if(Math.hypot(dx,dz)<.001)return;this.player.dir=Math.atan2(dx,-dz);this.yaw=-this.player.dir;}
    cameraPointBlocked(x,y,z){
      const padding=this.cameraPadding;
      if(warehouse&&x<warehouse.layout.wallX&&(Math.abs(z)>7.49||y>6.02))return true;
      if([x,y,z].some((v,i)=>v<CAMERA_ROOM.min[i]+padding||v>CAMERA_ROOM.max[i]-padding))return true;
      for(const box of CAMERA_WALLS){
        if(y>(box.bottom||0)-padding&&y<box.top+padding&&Math.abs(x-box.x)<box.hx+padding&&Math.abs(z-box.z)<box.hz+padding)return true;
      }
      return false;
    }
    cameraWallScale(from,to){
      // Continuous segment/box intersection protects thin walls, even during fast turns.
      const delta=to.map((v,i)=>v-from[i]),padding=this.cameraPadding;
      let limit=1;
      for(let axis=0;axis<3;axis++){
        const d=delta[axis];
        if(d>0)limit=Math.min(limit,(CAMERA_ROOM.max[axis]-padding-from[axis])/d);
        else if(d<0)limit=Math.min(limit,(CAMERA_ROOM.min[axis]+padding-from[axis])/d);
      }
      for(const wall of CAMERA_WALLS){
        const min=[wall.x-wall.hx-padding,(wall.bottom||0)-padding,wall.z-wall.hz-padding];
        const max=[wall.x+wall.hx+padding,wall.top+padding,wall.z+wall.hz+padding];
        let enter=0,leave=1;
        for(let axis=0;axis<3;axis++){
          const d=delta[axis];
          if(Math.abs(d)<1e-9){if(from[axis]<min[axis]||from[axis]>max[axis]){leave=-1;break;}}
          else{
            const a=(min[axis]-from[axis])/d,b=(max[axis]-from[axis])/d;
            enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
          }
        }
        if(enter<=leave&&leave>=0)limit=Math.min(limit,enter);
      }
      return limit<1?Math.max(0,limit-.0001):1;
    }
    cameraArmClear(from,to){return this.cameraWallScale(from,to)===1;}
    cameraOverlaps(bounds,extra=0){
      // Hide only objects touching the eye/near plane, not the entire sight line.
      const radius=this.cameraPadding+extra;
      let distanceSq=0;
      for(let axis=0;axis<3;axis++){
        const d=Math.max(bounds.min[axis]-this.eye[axis],0,this.eye[axis]-bounds.max[axis]);
        distanceSq+=d*d;
      }
      return distanceSq<radius*radius;
    }
    update(dt,realDt=dt){this.t+=dt;if(!this.paused)this.updateWorkerTalk(dt);if(!this.paused&&!this.events.isBlocked?.()){this.updateFurniture(dt);this.updateTablet(realDt);}let yaw=this.yaw;let speed=dt*3.6,dx=0,dz=0; if(this.keys.w||this.keys.arrowup){dx-=Math.sin(yaw);dz-=Math.cos(yaw)}if(this.keys.s||this.keys.arrowdown){dx+=Math.sin(yaw);dz+=Math.cos(yaw)}if(this.keys.a){dx-=Math.cos(yaw);dz+=Math.sin(yaw)}if(this.keys.d){dx+=Math.cos(yaw);dz-=Math.sin(yaw)}if(this.keys.arrowleft)this.yaw+=dt*1.65;if(this.keys.arrowright)this.yaw-=dt*1.65;
      const moving=Math.hypot(dx,dz)>.01,controlAllowed=!this.paused&&!this.events.isBlocked?.()&&!this.seating&&!this.tabletRead&&!this.workerTalk;this.walking=!!(this.seating?.moving||this.workerTalk?.moving);
      if(moving&&controlAllowed){let n=Math.hypot(dx,dz);dx=dx/n*speed;dz=dz/n*speed;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12)),stepX=dx/steps,stepZ=dz/steps,startX=this.player.x,startZ=this.player.z;
        for(let i=0;i<steps;i++){if(this.canMove(this.player.x+stepX,this.player.z))this.player.x+=stepX;if(this.canMove(this.player.x,this.player.z+stepZ))this.player.z+=stepZ;}
        const movedX=this.player.x-startX,movedZ=this.player.z-startZ;
        const distanceMoved = Math.hypot(movedX,movedZ);
        if(distanceMoved>.001){
          this.walking=true;
          this.walkDistance+=distanceMoved;
          this.player.dir=Math.atan2(movedX,-movedZ);
        }}
      let x=this.player.x,z=this.player.z,focused=!!this.events.isDialogueOpen?.(),center,fov;
      if(focused){
        // Interview close-up sits in front of Marcos; hide the auditor so he cannot block the speaker.
        if(this.workerTalk){this.eye=[5.15,2.75,.35];center=[5.65,1.90,3.115];fov=39;}
        else{this.eye=[-10.16,2.84,-2.55];center=[-10.7,2.35,-5.20];fov=39;}this.cameraScale=1;
      } else {
        center=[x,1.59,z];fov=55;const cameraAt=scale=>[x+Math.sin(this.yaw)*6.2*scale,center[1]+1.67*scale,z+Math.cos(this.yaw)*6.2*scale];
        const aspect=this.canvas.width/this.canvas.height,tan=Math.tan(fov*Math.PI/360);
        this.cameraPadding=this.cameraNear*Math.sqrt(1+tan*tan*(1+aspect*aspect))+.045;
        let scale=Math.max(.005,this.cameraWallScale(center,cameraAt(1))),candidate=cameraAt(scale);
        if (scale > this.cameraScale) {
          scale = Math.min(scale, this.cameraScale + dt * 2.5);
          candidate = cameraAt(scale);
        }
        this.cameraScale=scale;this.eye=candidate;
      }
      // This distance can shrink only because of a wall. Furniture never hides the player.
      this.hidePlayer=!focused&&this.cameraScale<(this.hidePlayer ? .24 : .20);
      const nearClip=focused ? .30 : this.cameraNear;
      this.vp=m4.mul(m4.perspective(fov*Math.PI/180,this.canvas.width/this.canvas.height,nearClip,warehouse?.layout.farClip||90),m4.lookAt(this.eye,center,[0,1,0]));}
    render(){
      this.resize();
      this.renderer.draw(this);
    }
    loop(ts){requestAnimationFrame(this.loop);if(this.paused){this.last=ts;return;}let dt=Math.min(.038,Math.max(.008,(ts-this.last)/1000||.016));const realDt=Math.max(0,(ts-this.last)/1000||.016);this.last=ts;this.update(dt,realDt);if(this.low){this.acc+=dt;if(this.acc<1/30)return;this.acc=0;}this.render();this.events.onFrame?.(this);}
    distance(x,z){return Math.hypot(this.player.x-x,this.player.z-z)}
  }
  global.SCAI3D={Engine,colors:C,chairs:CHAIRS};
})(window);
