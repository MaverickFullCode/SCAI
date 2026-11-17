/* Empilhadeira: geometria móvel, pneus, direção e colisões no mesmo referencial. */
(() => {
 'use strict';
 const TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const initial={x:12.19,z:-1.35,angle:0},shape={minX:-1.16,maxX:2.04,halfZ:.64,height:3.52},seatX=-.245;
 const create=()=>({...initial,speed:0,steer:0,travel:0,wheelAngles:[0,0,0,0]});
 const point=(v,x,z)=>({x:v.x+Math.cos(v.angle)*x-Math.sin(v.angle)*z,z:v.z+Math.sin(v.angle)*x+Math.cos(v.angle)*z});
 const local=(v,x,z)=>({x:Math.cos(v.angle)*(x-v.x)+Math.sin(v.angle)*(z-v.z),z:-Math.sin(v.angle)*(x-v.x)+Math.cos(v.angle)*(z-v.z)});
 const parts=[{minX:-1.16,maxX:1.14,minZ:-.64,maxZ:.64},...[-1,1].map(s=>({minX:1.03,maxX:2.04,minZ:s*.241-.07,maxZ:s*.241+.07}))];
 function blocksPoint(v,x,z,r=.34){const p=local(v,x,z);return parts.some(b=>Math.hypot(Math.max(b.minX-p.x,0,p.x-b.maxX),Math.max(b.minZ-p.z,0,p.z-b.maxZ))<r);}
 function corners(v){return parts.flatMap(b=>[b.minX,b.maxX].flatMap(x=>[b.minZ,b.maxZ].map(z=>point(v,x,z))));}
 function overlapsBox(v,b){
  const c=Math.cos(v.angle),s=Math.sin(v.angle);
  return parts.some(part=>{const center=point(v,(part.minX+part.maxX)/2,(part.minZ+part.maxZ)/2),dx=b.x-center.x,dz=b.z-center.z,h=(part.maxX-part.minX)/2,w=(part.maxZ-part.minZ)/2;
   return Math.abs(dx)<b.hx+Math.abs(c)*h+Math.abs(s)*w&&Math.abs(dz)<b.hz+Math.abs(s)*h+Math.abs(c)*w&&Math.abs(dx*c+dz*s)<h+b.hx*Math.abs(c)+b.hz*Math.abs(s)&&Math.abs(-dx*s+dz*c)<w+b.hx*Math.abs(s)+b.hz*Math.abs(c);
  });
 }
 function canPlace(v,environment){return corners(v).every(p=>environment.inside(p.x,p.z))&&!environment.boxes.some(b=>overlapsBox(v,b))&&!environment.circles.some(b=>blocksPoint(v,b.x,b.z,b.r));}
 const wheels=[{x:-.72,z:-.4765,r:.307},{x:-.72,z:.4765,r:.307},{x:.60,z:-.4765,r:.363},{x:.60,z:.4765,r:.363}];
 const wheelSteer=(v,i)=>i<2||Math.abs(v.steer)<1e-6?0:Math.atan(1.32/(1.32/Math.tan(v.steer)-wheels[i].z));
 function move(v,dt,throttle,steering,environment){
  const goal=throttle*(throttle<0?5.2:10.0),rate=throttle&&v.speed*throttle>=0?5.6:12;
  v.speed+=clamp(goal-v.speed,-rate*dt,rate*dt);v.steer+=clamp(steering*.53-v.steer,-2.5*dt,2.5*dt);
  const distance=v.speed*dt,steps=Math.max(1,Math.ceil(Math.abs(distance)/.055));
  for(let j=0;j<steps;j++){
   const d=distance/steps,angle=v.angle+d*Math.tan(v.steer)/1.32,rear=point(v,-.72,0),mid=(v.angle+angle)/2;
   const next={...v,angle,x:rear.x+Math.cos(mid)*d+Math.cos(angle)*.72,z:rear.z+Math.sin(mid)*d+Math.sin(angle)*.72};
   if(!canPlace(next,environment)){v.speed=0;break;}
   wheels.forEach((w,i)=>{const a=point(v,w.x,w.z),b=point(next,w.x,w.z);v.wheelAngles[i]-=Math.sign(d)*Math.hypot(b.x-a.x,b.z-a.z)/w.r;});
   v.x=next.x;v.z=next.z;v.angle=next.angle;v.travel+=Math.abs(d);
  }
 }
 function boarding(progress,side){
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},phase=(a,b)=>smooth((progress-a)/(b-a));
  const curve=rows=>{let i=0;while(i<rows.length-2&&progress>rows[i+1][0])i++;const [a,x]=rows[i],[b,y]=rows[i+1];return x+(y-x)*phase(a,b);};
  const ground=-.045,deck=.739,step=.37,homeX=seatX-.010;
  const foot=(s)=>({side:s,x:homeX,y:ground,z:side*1.08+s*.166});
  const plant=(a,b,start,end,lift)=>{const u=clamp((progress-start)/(end-start),0,1),t=smooth(u);return {side:a.side,x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:a.y+(b.y-a.y)*t+lift*Math.sin(Math.PI*u)};};
  const leading=-side,trailing=side,ledge={side:leading,x:-.10,y:step,z:side*.54};
  const deckFoot=s=>({side:s,x:.205,y:deck,z:s*.166});
  const first=progress<.73?plant(foot(leading),ledge,.20,.42,.14):plant(ledge,deckFoot(leading),.73,.91,.13);
  const second=plant(foot(trailing),deckFoot(trailing),.48,.72,.18);
  return {progress,blend:phase(.82,1),stepLift:0,grip:phase(.92,1),feetBlend:phase(.12,.20),feet:[first,second],
    rootY:curve([[0,0],[.12,0],[.25,-.50],[.48,-.50],[.58,-.26],[.70,.04],[.90,.04],[1,-.026]]),
    offsetZ:side*curve([[0,1.08],[.28,1.08],[.46,.87],[.62,.58],[.70,.54],[.84,.18],[.96,0],[1,0]]),
    lean:-.32*phase(.12,.25)*(1-phase(.76,.92))};
 }
 function matrix(v){const c=Math.cos(v.angle),s=Math.sin(v.angle);return new Float32Array([c,0,s,0,0,1,0,0,-s,0,c,0,v.x,0,v.z,1]);}
 const color=(hex,material)=>Object.assign([0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255),{material});
 function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
 function rotation(axis,a){const [x,y,z]=axis,c=Math.cos(a),s=Math.sin(a),t=1-c;return new Float32Array([t*x*x+c,t*x*y+s*z,t*x*z-s*y,0,t*x*y-s*z,t*y*y+c,t*y*z+s*x,0,t*x*z+s*y,t*y*z-s*x,t*z*z+c,0,0,0,0,1]);}
 function build(){
  const p={black:color('292d34',3),graphite:color('323a44',3),chrome:color('a5afb5',5),steel:color('506276',5),amber:color('efa925',8),orange:color('e88532',5),ink:color('1c293a',3),leather:color('454c58',3),lamp:color('fff0d2',10)};
  const mesh=new window.SCAIMesh(),sy=1.32,x=0,z=0,point=(a,b,c)=>[a,b*sy,c];
  const R=(a,b,c,w,h,d,col,r)=>mesh.bevelBox(a,b*sy,c,w,h*sy,d,col,r),bx=(a,b,c,w,h,d,col,r=.035)=>R(a,b,c,w,h,d,col,r);
  const T=(a,b,r,col,n)=>mesh.tube(a,b,r,col,n),cyl=(a,b,c,r,h,col,n)=>T([a,b*sy-h*sy/2,c],[a,b*sy+h*sy/2,c],r,col,n),sph=(a,b,c,rx,ry,rz,col,n,k)=>mesh.sphere(a,b*sy,c,rx,ry*sy,rz,col,n,k);
      bx(-.105,.372,0,1.96,.35,.90,p.graphite,.072);
      bx(-.685,.594,0,.851,.63,1.015,p.amber,.13);
      bx(-.662,.884,0,.757,.104,.91,p.graphite,.045);
      bx(-.082,.506,0,.428,.212,1.007,p.amber,.046);
      bx(.49,.465,0,.764,.178,.948,p.amber,.046);
      for(const f of [-1,1]){
        bx(.62,.574,f*.427,.57,.105,.128,p.amber,.045);
        bx(-.73,.585,f*.51,.386,.099,.009,p.graphite,.004);
        for(let i=0;i<3;i++)bx(-.852+i*.086,.614,f*.517,.041,.011,.008,p.chrome,.003);
        T(point(-.765,.893,f*.405),point(-.66,2.443,f*.405),.034,p.graphite,9);
        T(point(.56,.55,f*.405),point(.399,2.443,f*.405),.037,p.graphite,9);
        bx(-.083,2.478,f*.43,1.314,.09,.072,p.graphite,.022);
        bx(.391,2.446,f*.328,.108,.106,.129,p.steel,.022);
        bx(.45,2.446,f*.328,.013,.073,.092,p.lamp,.004);
      }
      bx(-.086,2.502,0,1.41,.09,.977,p.amber,.042);
      for(let i=0;i<4;i++)bx(-.55+i*.265,2.448,0,.061,.039,.85,p.graphite,.01);
      cyl(x-.56,2.598,z+.27,.063,.126,p.orange,12);cyl(x-.56,2.542,z+.27,.07,.032,p.ink,12);
      bx(-.245,.891,0,.48,.163,.511,p.graphite,.067);bx(-.463,1.042,0,.106,.368,.492,p.leather,.045);
      T(point(.42,.624,0),[.239,1.9,0],.039,p.steel,10);
      for(let k=0;k<2;k++){const dx=.19+k*.105;T(point(dx,.594,.292),point(dx-.03,.849,.292),.014,p.chrome,7);sph(x+dx-.03,.855,z+.292,.027,.038,.027,p.black,8,4);}
      for(const f of [-1,1]){
        bx(.913,1.139,f*.315,.114,2.28,.101,p.graphite,.013);
        bx(.989,1.194,f*.315,.032,2.12,.048,p.chrome,.011);
        bx(1.058,.522,f*.241,.075,.799,.102,p.steel,.01);
        bx(1.518,.143,f*.241,.974,.067,.111,p.steel,.012);
      }
      for(const y of [.25,.706,2.19])bx(.909,y,0,.105,.086,.717,p.graphite,.01);
      T(point(.954,.295,0),point(.954,1.37,0),.043,p.chrome,10);

  const tires=wheels.map(w=>{const m=new window.SCAIMesh(),side=Math.sign(w.z);
   m.tube([0,0,-.0815],[0,0,.0815],w.r,p.black,22);
   for(const [offset,rr,col] of [[.0835,.70,p.graphite],[.0915,.52,p.chrome],[.1035,.21,p.steel]])m.tube([0,0,side*offset],[0,0,side*(offset+.008)],w.r*rr,col,20);
   for(let i=0;i<5;i++){const a=i*TAU/5;m.tube([Math.cos(a)*w.r*.34,Math.sin(a)*w.r*.34,side*.098],[Math.cos(a)*w.r*.34,Math.sin(a)*w.r*.34,side*.107],.014,p.graphite,6);}
   for(let i=0;i<22;i++){const a=i*TAU/22,b=a+.08,r=w.r+.001;m.quad([r*Math.cos(a),r*Math.sin(a),-.06],[r*Math.cos(b),r*Math.sin(b),-.06],[r*Math.cos(b),r*Math.sin(b),.06],[r*Math.cos(a),r*Math.sin(a),.06],p.graphite);}
   return m;
  });
  const helm=new window.SCAIMesh();let previous;
  for(let i=0;i<=32;i++){const a=i*TAU/32,q=[.09498567*Math.cos(a),.1160936*Math.cos(a),.15*Math.sin(a)];if(previous)helm.tube(previous,q,.016,p.graphite,7);if(i%8===0)helm.tube([0,0,0],q,.010,p.steel,6);previous=q;}
  helm.sphere(0,0,0,.032,.026,.027,p.graphite,12,6);
  const shadow=new window.SCAIMesh();for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])shadow.vertex([.45+u*1.65,-.041,v*.78],[0,1,0],[.21,0,0],[u,v],16);
  for(const side of [-1,1]){mesh.bevelBox(-.16,.33,side*.54,.85,.08,.19,p.steel,.012);for(const x of [-.47,-.31,-.15,.01,.17])mesh.box(x,.372,side*.54,.018,.006,.16,p.chrome);}
  return {body:mesh,tires,helm,shadow};
 }
 window.SCAIForklift={initial,shape,seatX,create,point,local,corners,blocksPoint,overlapsBox,canPlace,wheels,wheelSteer,move,boarding,matrix,multiply,rotation,build};
})();
