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
  const WALL_BOXES=[
    {x:0,z:-5.15,hx:.085,hz:2.55,top:5.42},{x:0,z:5.15,hx:.085,hz:2.55,top:5.42}
  ];
  const CAMERA_ROOM={min:[-12.54,.12,-7.43],max:[16.61,6.02,7.49]};
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
    {x:5.65,z:2.05,hx:1,hz:.48,top:1.58},
    {x:15,z:1.4,hx:.38,hz:.31,top:2.45}
  ];
  const WALK_CIRCLES=[
    {x:-11.6,z:5.9,r:.68},
    {x:-6.55,z:-6.25,r:.55},
    {x:-1.4,z:-6.2,r:.65},
    {x:-10.7,z:-5.2,r:.42},
    {x:3.3,z:-2.25,r:.42}
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
      const padding=this.cameraPadding;
      if([x,y,z].some((v,i)=>v<CAMERA_ROOM.min[i]+padding||v>CAMERA_ROOM.max[i]-padding))return true;
      for(const box of WALL_BOXES){
        if(y<box.top+padding&&Math.abs(x-box.x)<box.hx+padding&&Math.abs(z-box.z)<box.hz+padding)return true;
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
      for(const wall of WALL_BOXES){
        const min=[wall.x-wall.hx-padding,-padding,wall.z-wall.hz-padding];
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
    update(dt){this.t+=dt;let yaw=this.yaw;let speed=dt*3.6,dx=0,dz=0; if(this.keys.w||this.keys.arrowup){dx-=Math.sin(yaw);dz-=Math.cos(yaw)}if(this.keys.s||this.keys.arrowdown){dx+=Math.sin(yaw);dz+=Math.cos(yaw)}if(this.keys.a){dx-=Math.cos(yaw);dz+=Math.sin(yaw)}if(this.keys.d){dx+=Math.cos(yaw);dz-=Math.sin(yaw)}if(this.keys.arrowleft)this.yaw+=dt*1.65;if(this.keys.arrowright)this.yaw-=dt*1.65;
      const moving=Math.hypot(dx,dz)>.01,controlAllowed=!this.paused&&!this.events.isBlocked?.();this.walking=false;
      if(moving&&controlAllowed){let n=Math.hypot(dx,dz);dx=dx/n*speed;dz=dz/n*speed;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12)),stepX=dx/steps,stepZ=dz/steps,startX=this.player.x,startZ=this.player.z;
        for(let i=0;i<steps;i++){
          const nextX=this.player.x+stepX,nextZ=this.player.z+stepZ;
          // Test the requested direction as a whole. Splitting X/Z produced tiny
          // sideways steps against obstacles, keeping the walking animation alive.
          if(!this.canMove(nextX,nextZ))break;
          this.player.x=nextX;this.player.z=nextZ;
        }
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
