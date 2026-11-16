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
  const WALK_BOXES=[
    {x:0,z:-5.15,hx:.085,hz:2.55,top:5.42},{x:0,z:5.15,hx:.085,hz:2.55,top:5.42},
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
    {x:5.65,z:2.05,hx:1,hz:.48,top:1.58},
    {x:15,z:1.4,hx:.38,hz:.31,top:2.45}
  ];
  const WALK_CIRCLES=[
    {x:-11.6,z:5.9,r:.68,cameraRadius:.85,top:3.25},
    {x:-6.55,z:-6.25,r:.55,cameraRadius:.70,top:2.50},
    {x:-1.4,z:-6.2,r:.65,cameraRadius:.80,top:3.10},
    {x:-10.7,z:-5.2,r:.42,cameraRadius:.49,top:3.30},
    {x:3.3,z:-2.25,r:.42,cameraRadius:.49,top:3.30}
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
      this.bind();this.resize();this.loop=this.loop.bind(this);requestAnimationFrame(this.loop);
    }
    bind() {
      const canvas = this.canvas;
      let cameraPointer = null, lastX = 0;
      document.addEventListener('keydown', event => {
        const key = event.key.toLowerCase();
        if (['w','s','a','d','arrowup','arrowdown','arrowleft','arrowright','e',' '].includes(key)) {
          if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
          event.preventDefault();
        }
        this.keys[key] = true;
        if (key === 'e') this.events.onInteract?.();
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
    canMove(x,z){
      if(x < -12.05||x>16.2||z < -7.08||z>7.04)return false;
      const radiusSq=PLAYER_RADIUS*PLAYER_RADIUS;
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
      if(x < -12.53||x > 16.53||z < -7.46||z > 7.44||y < .12||y > 6.02)return true;
      // Reuse the furniture footprints with clearance for the camera's near plane.
      for (const box of WALK_BOXES) {
        if (y < box.top + .12 && Math.abs(x-box.x) < box.hx + .16 && Math.abs(z-box.z) < box.hz + .16) return true;
      }
      for (const circle of WALK_CIRCLES) {
        if (y < circle.top + .12 && Math.hypot(x-circle.x,z-circle.z) < circle.cameraRadius + .16) return true;
      }
      return false;
    }
    cameraArmClear(from,to){const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2],length=Math.hypot(dx,dy,dz),steps=Math.max(2,Math.ceil(length/.18));
      for(let i=1;i<=steps;i++){const t=i/steps;if(this.cameraPointBlocked(from[0]+dx*t,from[1]+dy*t,from[2]+dz*t))return false;}return true;}
    update(dt){this.t+=dt;let yaw=this.yaw;let speed=dt*3.6,dx=0,dz=0; if(this.keys.w||this.keys.arrowup){dx-=Math.sin(yaw);dz-=Math.cos(yaw)}if(this.keys.s||this.keys.arrowdown){dx+=Math.sin(yaw);dz+=Math.cos(yaw)}if(this.keys.a){dx-=Math.cos(yaw);dz+=Math.sin(yaw)}if(this.keys.d){dx+=Math.cos(yaw);dz-=Math.sin(yaw)}if(this.keys.arrowleft)this.yaw+=dt*1.65;if(this.keys.arrowright)this.yaw-=dt*1.65;
      const moving=Math.hypot(dx,dz)>.01,controlAllowed=!this.paused&&!this.events.isBlocked?.();this.walking=false;
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
        this.eye=[-10.16,2.84,-2.55];center=[-10.7,2.35,-5.20];fov=39;this.cameraScale=1;
      } else {
        center=[x,1.59,z];fov=55;const cameraAt=scale=>[x+Math.sin(this.yaw)*6.2*scale,center[1]+1.67*scale,z+Math.cos(this.yaw)*6.2*scale];
        let scale=1,candidate=cameraAt(scale);
        if(!this.cameraArmClear(center,candidate)){
          // Find the furthest unobstructed point; binary refinement keeps zoom changes smooth near walls.
          let low=.015,high=1;const close=cameraAt(low);
          if(this.cameraArmClear(center,close)){for(let i=0;i<9;i++){const mid=(low+high)*.5;if(this.cameraArmClear(center,cameraAt(mid)))low=mid;else high=mid;}scale=low;candidate=cameraAt(scale);}
          else {scale=0;candidate=[x,center[1]+.65,z];}
        }
        if (scale > this.cameraScale) {
          scale = Math.min(scale, this.cameraScale + dt * 2.5);
          candidate = cameraAt(scale);
        }
        this.cameraScale=scale;this.eye=candidate;
      }
      const nearClip=focused || this.cameraScale>.45 ? .30 : .065;
      this.vp=m4.mul(m4.perspective(fov*Math.PI/180,this.canvas.width/this.canvas.height,nearClip,44),m4.lookAt(this.eye,center,[0,1,0]));}
    render(){
      this.resize();
      this.renderer.draw(this);
    }
    loop(ts){requestAnimationFrame(this.loop);if(this.paused){this.last=ts;return;}let dt=Math.min(.038,Math.max(.008,(ts-this.last)/1000||.016));this.last=ts;this.update(dt);if(this.low){this.acc+=dt;if(this.acc<1/30)return;this.acc=0;}this.render();this.events.onFrame?.(this);}
    distance(x,z){return Math.hypot(this.player.x-x,this.player.z-z)}
  }
  global.SCAI3D={Engine,colors:C};
})(window);
