/* Aurora Distribuição • arquitetura, mobiliário e equipamentos da primeira missão.
   As coordenadas de apoio são compartilhadas com as áreas de colisão da fase. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const finishes = {wood:0,stone:1,fabric:2,rubber:3,leather:3,cardboard:4,metal:5,concrete:6,plaster:7,paint:8,ceramic:8,paper:8,earth:6,glass:9,emissive:10,leaf:11};
  const hex = (s, material) => {
    const c = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
    c.material = finishes[material];
    return c;
  };
  function build(mesh, C) {
    // The characters are about 3.1 scene units tall. Furnishings are lifted to
    // their scale without changing the collision footprints or walking routes.
    let sy=1;
    const pt = q => [q[0],q[1]*sy,q[2]];
    const m = {
      tri:(a,b,c,col)=>mesh.tri(pt(a),pt(b),pt(c),col),
      quad:(a,b,c,d,col)=>mesh.quad(pt(a),pt(b),pt(c),pt(d),col),
      box:(x,y,z,w,h,d,...rest)=>mesh.box(x,y*sy,z,w,h*sy,d,...rest),
      bevelBox:(x,y,z,w,h,d,...rest)=>mesh.bevelBox(x,y*sy,z,w,h*sy,d,...rest),
      tube:(a,b,...rest)=>mesh.tube(pt(a),pt(b),...rest),
      sign:(a,u,v,key)=>mesh.sign(pt(a),pt(u),pt(v),key),
      surface:(sample,columns,rows,col)=>mesh.surface((u,v)=>pt(sample(u,v)),columns,rows,col),
      sphere:(x,y,z,a,b,c,...rest)=>mesh.sphere(x,y*sy,z,a,b*sy,c,...rest)
    };
    const pigment = {
      plaster:hex('e6e0d8','plaster'), ivory:hex('eee9df','plaster'), bluewall:hex('243d56','plaster'),
      floor:hex('d1c9be','stone'), joint:hex('b6b1aa','stone'), concrete:hex('aeb1b5','concrete'), seam:hex('989b9e','concrete'),
      ceiling:hex('e6e4dc','plaster'), roof:hex('d6dce1','metal'), sky:hex('b7e2f6','glass'),
      oak:hex('bd8c62','wood'), walnut:hex('925f43','wood'), walnutDark:hex('79513c','wood'), maple:hex('cda17a','wood'),
      rail:hex('354454','metal'), chrome:hex('a5afb5','metal'), steel:hex('506276','metal'), deep:hex('273644','metal'),
      graphite:hex('323a44','rubber'), ink:hex('1c293a','rubber'), leather:hex('454c58','leather'), leatherEdge:hex('515863','leather'),
      fabric:hex('777d89','fabric'), carpet:hex('9294a0','fabric'), silver:hex('bdc3c7','metal'), paper:hex('f0ece3','paper'),
      ivoryMetal:hex('d8d5cb','metal'), whiteCeramic:hex('ece9df','ceramic'),
      orange:hex('e88532','metal'), amber:hex('efa925','metal'), yellow:hex('f8c153','paint'),
      rack:hex('3469a4','metal'), rackDark:hex('295481','metal'), blue:hex('2b5884','metal'),
      blueBook:hex('365b88','fabric'), binder:hex('586d89','fabric'), mint:hex('729b9a','metal'), wine:hex('865e62','fabric'),
      lamp:hex('fff0d2','emissive'), warm:hex('ffcb84','emissive'), frost:hex('a9c3ce','glass'), glass:hex('b3cdd4','glass'),
      soil:hex('514239','earth'), stem:hex('657849','leaf'), green:hex('52743d','leaf'), leaf:hex('6e943c','leaf'),
      leafLight:hex('88a844','leaf'), newLeaf:hex('a3b750','leaf'), coffee:hex('594039','earth'),
      kraft:hex('c99c73','cardboard'), kraft2:hex('d6b48e','cardboard'), kraft3:hex('b98a67','cardboard'),
      tape:hex('ddc7a9','paper'), package:hex('c9c4c0','metal'), wrap:hex('ddd9d0','metal'),
      red:hex('be4d43','metal'), black:hex('292d34','rubber')
    };
    const p = pigment;
    const B = (x,y,z,w,h,d,col,r=0) => m.box(x,y,z,w,h,d,col,r);
    const R = (x,y,z,w,h,d,col,rad=.04,angle=0) => m.bevelBox(x,y,z,w,h,d,col,rad,angle);
    const T = (a,b,r,col,n=10) => m.tube(a,b,r,col,n);
    const S = (a,u,v,key) => m.sign(a,u,v,key);
    const sph = (x,y,z,a,b,c,col,n=14,k=7,rot=0) => m.sphere(x,y,z,a,b,c,col,n,k,rot);
    const cyl = (x,y,z,r,h,col,n=18) => T([x,y-h/2,z],[x,y+h/2,z],r,col,n);
    const scaleColor = (col,f) => Object.assign(col.map(v=>Math.min(1,v*f)), {material:col.material});

    // Routed profiles: the edge radius and corner radius of a tabletop are independent.
    function slab(x,y,z,w,d,h,corner,col,angle=0,bevel=.018) {
      const cs=Math.cos(angle), sn=Math.sin(angle), rim=Math.min(bevel,h*.38), rings=[];
      for(const [inset,dy] of [[rim,-h/2],[0,-h/2+rim],[0,h/2-rim],[rim,h/2]]){
        const hw=w*.5-inset,hd=d*.5-inset,rr=Math.max(.002,Math.min(hw,hd,corner-inset)),ring=[];
        for(const [ix,iz,a0] of [[1,1,0],[-1,1,Math.PI/2],[-1,-1,Math.PI],[1,-1,3*Math.PI/2]]){
          for(let i=0;i<=5;i++){const a=a0+i*Math.PI/10,dx=ix*(hw-rr)+rr*Math.cos(a),dz=iz*(hd-rr)+rr*Math.sin(a);
            ring.push([x+dx*cs-dz*sn,y+dy,z+dx*sn+dz*cs]);}
        }
        rings.push(ring);
      }
      const N=rings[0].length;
      for(let j=1;j<rings.length;j++)for(let i=0;i<N;i++){const k=(i+1)%N;m.quad(rings[j-1][i],rings[j][i],rings[j][k],rings[j-1][k],col);}
      for(let i=0;i<N;i++){const k=(i+1)%N;m.tri([x,y+h/2,z],rings[3][k],rings[3][i],col);m.tri([x,y-h/2,z],rings[0][i],rings[0][k],col);}
    }
    const surface=(x,z,y,rx,rz,base,dark)=>mesh.shadow(x,z,rx,rz,dark,y<0?-.039:y*sy);
    // Turned planters, stems and leaves with arched midribs; each plant has a distinct silhouette.
    function plant(x,y,z,s,seed=0) {
      mesh.object(`plant:${x}:${y}:${z}`,()=>{
      const c=(a,b,d)=>[x+a*s,y+b*s,z+d*s];
      const profile=[[.02,.19],[.045,.225],[.41,.285],[.45,.276],[.455,.247],[.396,.242]];
      for(let j=1;j<profile.length;j++)for(let i=0;i<20;i++){
        const a=i*TAU/20,b=(i+1)*TAU/20,[y0,r0]=profile[j-1],[y1,r1]=profile[j];
        m.quad(c(r0*Math.cos(a),y0,r0*Math.sin(a)),c(r1*Math.cos(a),y1,r1*Math.sin(a)),c(r1*Math.cos(b),y1,r1*Math.sin(b)),c(r0*Math.cos(b),y0,r0*Math.sin(b)),p.whiteCeramic);
      }
      cyl(x,y+.4*s,z,.243*s,.015*s,p.soil,20);
      for(let i=0;i<19;i++) {
        const a=seed+i*2.39996,cs=Math.cos(a),sn=Math.sin(a),k=(Math.sin(i*36.4+seed)*.5+.5);
        const rise=.62+.42*k+(i%4)*.13,reach=.16+.34*(1-k),start=.40;
        const stemEnd=c(reach*.43*cs,rise,reach*.43*sn);
        T(c(.047*cs,start,.047*sn),stemEnd,.011*s,p.stem,6);
        const length=.34+.25*k, width=.155+.055*k;
        const green=[p.leaf,p.green,p.leafLight,p.newLeaf][i%4];
        const leaf=(u,t)=>{
          const side=u*2-1, fullness=Math.pow(Math.max(.0001,Math.sin(Math.PI*t)),.78);
          const radial=reach*.43+t*length, sideways=side*fullness*width;
          const arch=.27*Math.sin(t*Math.PI*.91)-.12*t;
          return c(cs*radial-sn*sideways,rise+arch-.045*side*side*fullness,sn*radial+cs*sideways);
        };
        m.surface(leaf,6,12,green);
        let previous=leaf(.5,.02);
        for(let j=1;j<=8;j++){
          const next=leaf(.5,j*.117);
          T(previous.map((v,k)=>k===1?v+.002:v),next.map((v,k)=>k===1?v+.002:v),.0028*s,p.newLeaf,5);
          previous=next;
        }
      }
      });
    }
    function chair(x,z,facing,base) {
      mesh.object(`chair:${x}:${z}`,()=>{
      // Facing local +Z: office and warehouse chairs use this same reference.
      const f=facing, a=f<0?Math.PI:0, at=(dx,y,dz)=>[x+dx*f,y,z+dz*f];
      surface(x,z,.032,.43,.44,base,.22);
      cyl(x,.26,z,.053,.33,p.chrome,12);cyl(x,.38,z,.072,.17,p.graphite,12);
      for(let i=0;i<5;i++){
        const ang=i*TAU/5+.20,dx=Math.cos(ang),dz=Math.sin(ang),q=[x+dx*.283,.097,z+dz*.283];
        T([x+dx*.03,.177,z+dz*.03],q,.031,p.chrome,7);
        T([q[0]-dz*.032,.061,q[2]+dx*.032],[q[0]+dz*.032,.061,q[2]-dx*.032],.052,p.black,10);
      }
      slab(x,.55,z,.61,.59,.13,.13,p.leather,a,.034);
      slab(x,.475,z,.51,.51,.062,.09,p.graphite,a);
      // The split cushions and reclined back are anchored to the rear of the seat.
      m.bevelBox(...at(0,.91,-.238),.545,.68,.115,p.graphite,.045,a);
      R(...at(0,.755,-.192),.54,.31,.13,p.leather,.055,a);
      R(...at(0,1.023,-.214),.55,.235,.134,p.leather,.055,a);
      R(...at(0,1.208,-.239),.54,.138,.131,p.leatherEdge,.043,a);
      for(const side of [-1,1]){
        const dx=side*.296;T(at(dx,.52,-.185),at(dx,.734,-.236),.025,p.chrome,9);
        T(at(dx,.735,-.236),at(dx,.755,.164),.026,p.chrome,9);
        R(...at(dx,.775,-.009),.062,.042,.377,p.graphite,.018,a);
      }
      });
    }
    function mug(x,y,z,s,col){
      cyl(x,y+.102*s,z,.092*s,.204*s,col,22);cyl(x,y+.205*s,z,.079*s,.004*s,p.coffee,20);
      let prev=[x+.077*s,y+.165*s,z];for(let i=1;i<=7;i++){
        const a=i*Math.PI/7,q=[x+(.077+Math.sin(a)*.073)*s,y+(.110+Math.cos(a)*.055)*s,z];
        T(prev,q,.014*s,col,7);prev=q;}
    }
    function doc(x,y,z,s,a=0){
      slab(x,y,z,.28*s,.37*s,.03*s,.021*s,p.blueBook,a);
      const c=Math.cos(a),n=Math.sin(a);
      // right x up points vertically, so the print sits face-up rather than inverted.
      S([x,y+.016*s,z],[.249*s*c,0,.249*s*n],[.333*s*n,0,-.333*s*c],'document');
      R(x+.146*s*n,y+.026*s,z-.146*s*c,.105*s,.019*s,.022*s,p.chrome,.005,a);
    }
    function glass(x,y,z,s=1){
      cyl(x,y+.018*s,z,.086*s,.022*s,p.chrome,16);
      cyl(x,y+.115*s,z,.071*s,.184*s,p.glass,16);
      cyl(x,y+.212*s,z,.072*s,.011*s,p.silver,16);
      cyl(x,y+.219*s,z,.062*s,.003*s,p.frost,16);
    }
    function book(x,y,z,w,d,h,col,a=0) {
      slab(x,y,z,w,d,h,.015,col,a,.012);
      R(x+.010,y,z,w-.014,h*.61,d-.010,p.paper,.003,a);
    }
    function files(x,y,z,n){
      for(let i=0;i<n;i++){
        const xx=x+i*.103,col=[p.blueBook,p.binder,p.ivoryMetal][i%3],h=.38+(i%2)*.035;
        R(xx,y+h/2,z,.096,h,.245,col,.012);
        B(xx,y+h*.61,z+.125,.049,h*.31,.006,p.paper);
        T([xx,y+h*.25,z+.123],[xx,y+h*.25,z+.13],.022,p.chrome,10);
        T([xx,y+h*.25,z+.13],[xx,y+h*.25,z+.133],.011,p.ink,10);
      }
    }
    function desk(x,z,kind) {
      mesh.object(`desk:${x}:${z}`,()=>{
      surface(x,z,.004,1.17,.47,p.floor,.17);
      slab(x,.796,z,2.35,.92,.095,.072,kind?p.ivory:p.maple);
      slab(x,.733,z,2.28,.87,.036,.056,p.walnutDark);
      R(x+.81,.385,z,.50,.70,.71,p.ivoryMetal,.035);
      for(let k=0;k<3;k++){
        R(x+.81,.179+k*.19,z+.36,.458,.176,.014,p.ivoryMetal,.012);
        R(x+.81,.218+k*.19,z+.375,.118,.019,.018,p.steel,.006);}
      for(const dz of [-.32,.32])T([x-.98,.025,z+dz],[x-.98,.735,z+dz],.033,p.chrome,8);
      T([x-.98,.076,z-.32],[x-.98,.076,z+.32],.03,p.chrome,8);
      B(x-.22,.585,z-.31,1.41,.237,.042,p.fabric);
      // Monitor, cable grommet, articulated neck, keyboard, mouse, paperwork.
      slab(x-.105,.865,z-.195,.45,.245,.035,.035,p.graphite);
      R(x-.105,1.01,z-.19,.099,.27,.065,p.steel,.014);
      R(x-.105,1.274,z-.225,.973,.570/sy,.067,p.graphite,.027);
      S([x-.105,1.279,z-.189],[.924,0,0],[0,.52/sy,0],'workstation');
      R(x-.105,1.288,z-.263,.392,.158,.015,p.steel,.008);
      B(x-.105,1.197,z-.274,.31,.008,.009,p.graphite);
      R(x-.12,.866,z+.112,.465,.024,.168,p.graphite,.01);
      for(let j=0;j<4;j++)for(let i=0;i<11;i++)B(x-.322+i*.0395,.88,z+.057+j*.035,.033,.004,.023,p.steel);
      sph(x+.245,.877,z+.116,.045,.026,.061,p.graphite,12,5);
      doc(x+.658,.866,z+.032,.96,-.12);
      if(kind){mug(x-.89,.848,z+.05,.78,p.blue);files(x+.633,.844,z-.228,3);}
      else{plant(x-.855,.844,z-.191,.43,.4);book(x+.68,.89,z-.195,.416,.265,.076,p.binder,-.07);}
      chair(x,z+1.1,-1,p.floor);
      });
    }
    function pallet(x,y,z,w,d) {
      const beam=.11, timber=p.maple;
      for(let k=-1;k<=1;k++){
        B(x+k*w*.36,y+.033,z,w*.16,.045,d,p.walnut);
        for(let j=-1;j<=1;j++)B(x+k*w*.36,y+.083,z+j*d*.35,beam,.075,d*.16,timber);
      }
      for(let j=0;j<5;j++)B(x,y+.142,z-d*.4+j*d*.2,w,.055,d*.171,timber);
    }
    function carton(x,y,z,w,h,d,variant,f=1) {
      const col=[p.kraft,p.kraft2,p.kraft3,p.package][variant%4];
      R(x,y+h/2,z,w,h,d,col,.012);
      if(variant%4===3){
        for(let i=1;i<4;i++)B(x,y+h*(i*.21),z,w+.002,.012,d+.005,p.wrap);
      }else {
        B(x,y+h+.002,z,.073,.004,d-.015,p.tape);
        B(x,y+h-.071,z+f*(d*.5+.003),.073,.139,.006,p.tape);
      }
      const side=z+f*(d*.5+.008),ww=Math.min(.205,w*.38);
      S([x+f*w*.231,y+h*.57,side],[ww*f,0,0],[0,ww*.5/sy,0],'carton');
    }
    function rack(x,z,index) {
      mesh.object(`rack:${x}:${z}`,()=>{
      const front=z<0?1:-1, floorY=-.045,w=2.99,d=1.17, top=4.47;
      surface(x,z,floorY+.003,1.62,.70,p.concrete,.18);
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const xx=x+sx*w/2,zz=z+sz*d/2;
        B(xx,top/2-.034,zz,.075,top,.102,p.rack);
        B(xx+sx*.043,top/2-.034,zz,.021,top,.137,p.rackDark);
        R(xx,.13,zz,.132,.33,.152,p.amber,.021);
        for(let i=0;i<14;i++)B(xx,.52+i*.27,zz+sz*.052,.022,.046,.005,p.deep);
      }
      for(const sx of [-1,1])for(const by of [.36,1.45,2.54,3.58]){
        const xx=x+sx*(w/2-.029);
        T([xx,by,z-d*.455],[xx,by+.88,z+d*.455],.018,p.rack,6);
        T([xx,by+.88,z-d*.455],[xx,by,z+d*.455],.018,p.rackDark,6);
      }
      for(let j=0;j<4;j++){
        const y=.242+1.035*j, deck=y+.065;
        B(x,y,z,w,.09,d-.065,p.steel);
        for(const f of [-1,1]){B(x,y,z+f*d*.48,w,.124,.07,p.orange);B(x,y-.051,z+f*d*.51,w,.019,.016,p.walnutDark);}
        for(let g=0;g<2;g++){
          const xx=x+(g?1:-1)*.72,v=(index*3+j*5+g*3)%9;
          pallet(xx,deck,z,1.32,.953);
          const h=.334+(v%3)*.045, base=deck+.17;
          if(v===3||v===6){carton(xx,base,z,1.19,.70,.833,3,front);}
          else if(v===5){
            for(const side of [-1,1]){
              const dx=xx+side*.28, h=.66;
              cyl(dx,base+h*.5,z,.224,h,p.blue,24);
              for(const dy of [.07,.33,.59])cyl(dx,base+dy,z,.231,.027,p.silver,24);
              cyl(dx,base+h+.008,z,.192,.018,p.steel,22);
              S([dx,base+.37,z+front*.227],[front*.20,0,0],[0,.12/sy,0],'carton');
            }
          }
          else {
            carton(xx-.303,base,z,.557,h,.813,v%3,front);carton(xx+.295,base,z,.565,h,.813,(v+1)%3,front);
            if(v%2===0||j>=2){carton(xx-.19,base+h+.006,z,.73,.255,.69,(v+2)%3,front);}
          }
        }
      }
      const fx=x-w*.40,fz=z+front*(d*.5+.046);
      B(fx,3.011,fz,.47,.47/sy,.038,p.ivoryMetal);
      S([fx,3.011,fz+front*.021],[front*.423,0,0],[0,.423/sy,0],['aisleA','aisleB','aisleC'][index%3]);
      });
    }
    function forklift(x,z) {
      mesh.object('forklift',()=>{
      const point=(a,b,c)=>[x+a,b,z+c],bx=(a,b,c,w,h,d,co,rad=.035)=>R(...point(a,b,c),w,h,d,co,rad);
      surface(x+.2,z,-.042,1.43,.63,p.concrete,.29);
      for(const [xx,r] of [[-.72,.307],[.60,.363]])for(const f of [-1,1]){
        const cy=(r-.044)/sy,q=(v)=>point(xx,cy,f*v);
        T(q(.395),q(.558),r,p.black,22);T(q(.558),q(.562),r*.70,p.graphite,20);
        T(q(.563),q(.573),r*.52,p.chrome,20);T(q(.574),q(.586),r*.21,p.steel,12);
        for(let i=0;i<5;i++){const a=i*TAU/5,px=xx+Math.cos(a)*r*.34,py=cy+Math.sin(a)*r*.34/sy;
          T(point(px,py,f*.574),point(px,py,f*.581),.014,p.graphite,6);}
      }
      bx(-.105,.372,0,1.96,.35,.90,p.graphite,.072);
      bx(-.685,.594,0,.851,.63,1.015,p.amber,.13);
      bx(-.662,.884,0,.757,.104,.91,p.graphite,.045);
      bx(-.082,.506,0,.428,.212,1.007,p.amber,.046);
      bx(.49,.465,0,.764,.178,.948,p.amber,.046);
      for(const f of [-1,1]){
        bx(.62,.574,f*.427,.57,.105,.128,p.amber,.045);
        bx(-.73,.585,f*.51,.386,.099,.009,p.graphite,.004);
        for(let i=0;i<3;i++)bx(-.852+i*.086,.614,f*.517,.041,.011,.008,p.chrome,.003);
        T(point(-.765,.893,f*.405),point(-.66,1.913,f*.405),.034,p.graphite,9);
        T(point(.56,.55,f*.405),point(.399,1.913,f*.405),.037,p.graphite,9);
        bx(-.083,1.948,f*.43,1.314,.09,.072,p.graphite,.022);
        bx(.391,1.916,f*.328,.108,.106,.129,p.steel,.022);
        bx(.45,1.916,f*.328,.013,.073,.092,p.lamp,.004);
      }
      bx(-.086,1.972,0,1.41,.09,.977,p.amber,.042);
      for(let i=0;i<4;i++)bx(-.55+i*.265,1.918,0,.061,.039,.85,p.graphite,.01);
      cyl(x-.56,2.068,z+.27,.063,.126,p.orange,12);cyl(x-.56,2.012,z+.27,.07,.032,p.ink,12);
      bx(-.245,.891,0,.48,.163,.511,p.graphite,.067);bx(-.463,1.042,0,.106,.368,.492,p.leather,.045);
      T(point(.42,.624,0),point(.241,1.032,0),.039,p.steel,10);
      let prev=null;for(let i=0;i<=16;i++){const a=TAU*i/16,q=point(.239+.073*Math.cos(a),1.039+.051*Math.cos(a),.136*Math.sin(a));
        if(prev)T(prev,q,.016,p.graphite,7);if(i%4===0)T(point(.239,1.039,0),q,.01,p.graphite,6);prev=q;}
      for(let k=0;k<2;k++){const dx=.19+k*.105;T(point(dx,.594,.292),point(dx-.03,.849,.292),.014,p.chrome,7);sph(x+dx-.03,.855,z+.292,.027,.038,.027,p.black,8,4);}
      for(const f of [-1,1]){
        bx(.913,1.139,f*.315,.114,2.28,.101,p.graphite,.013);
        bx(.989,1.194,f*.315,.032,2.12,.048,p.chrome,.011);
        bx(1.058,.522,f*.241,.075,.799,.102,p.steel,.01);
        bx(1.518,.143,f*.241,.974,.067,.111,p.steel,.012);
      }
      for(const y of [.25,.706,2.19])bx(.909,y,0,.105,.086,.717,p.graphite,.01);
      T(point(.954,.295,0),point(.954,1.37,0),.043,p.chrome,10);
      });
    }

    // Architecture — shell and finished floor at the original marker elevations.
    B(-6.4,-.121,0,12.8,.232,15.60,p.floor);B(8.4,-.165,0,16.8,.24,15.60,p.concrete);
    for(let x=-12.38;x<0;x+=1.63)B(x,-.003,0,.009,.003,15.54,p.joint);
    for(let z=-7.12;z<=7.6;z+=1.63)B(-6.4,-.003,z,12.8,.003,.009,p.joint);
    for(let x=2.10;x<16.75;x+=4.27)B(x,-.043,0,.014,.003,15.54,p.seam);
    for(let z=-6.81;z<=7.6;z+=3.95)B(8.4,-.043,z,16.6,.003,.012,p.seam);
    for(const z of [-7.67,7.67]){
      B(-6.4,3.11,z,12.8,6.24,.16,p.plaster);B(8.4,3.11,z,16.8,6.24,.16,p.roof);
      B(-6.4,.086,z-Math.sign(z)*.099,12.64,.177,.044,p.walnutDark);
      B(8.4,.196,z-Math.sign(z)*.097,16.6,.402,.047,p.steel);}
    B(-12.72,3.11,0,.17,6.24,15.48,p.ivory);B(16.75,3.11,0,.20,6.24,15.48,p.roof);
    B(16.623,.197,0,.036,.408,15.29,p.steel);

    // Broad city views: one panorama per façade, divided by genuine frame profiles.
    S([-12.618,2.47,-.15],[0,0,-13.58],[0,3.64,0],'window');
    for(const h of [.636,3.31,4.304])B(-12.572,h,-.15,.093,.079,13.71,p.rail);
    for(let z=-6.96;z<6.80;z+=2.27)B(-12.568,2.467,z,.098,3.68,.073,p.rail);
    B(-12.544,.59,-.15,.18,.078,13.76,p.maple);
    S([-6.52,2.44,7.572],[-11.70,0,0],[0,3.55,0],'window');
    for(const h of [.65,3.32,4.234])B(-6.52,h,7.53,11.79,.066,.073,p.rail);
    for(let x=-12.38;x<-.5;x+=2.343)B(x,2.443,7.527,.065,3.61,.08,p.rail);
    B(-6.52,.60,7.52,11.84,.066,.16,p.maple);
    // Interior glazing: open air occupies the clear portions; the sills keep the collision legible.
    for(const z of [-5.15,5.15]){
      B(0,.315,z,.17,.64,5.10,p.plaster);B(0,5.295,z,.17,1.88,5.10,p.plaster);
      for(const dz of [-2.51,-.85,.85,2.51])B(0,2.49,z+dz,.131,3.83,.064,p.rail);
      for(const h of [.64,3.55,4.383])B(0,h,z,.14,.073,5.10,p.rail);
      for(const h of [1.077,1.26])B(0,h,z,.021,.104,5.04,p.frost);
    }
    B(0,5.70,0,.18,1.09,5.29,p.plaster);B(0,5.13,0,.19,.075,5.28,p.rail);
    // Rear wall: bookmatched oak panels, pin lighting, inset digital presentation board.
    B(-8.85,2.77,-7.53,7.20,5.56,.098,p.walnutDark);
    for(let i=0;i<11;i++){B(-12.09+i*.649,2.76,-7.462,.638,5.51,.067,[p.walnut,p.walnut,p.walnutDark,p.walnut][i%4]);}
    B(-8.85,5.51,-7.413,7.19,.042,.031,p.warm);
    R(-7.77,2.69,-7.359,3.78,2.18,.127,p.deep,.054);
    R(-7.77,2.69,-7.281,3.64,2.05,.046,p.graphite,.021);
    S([-7.77,2.69,-7.255],[3.516,0,0],[0,1.979,0],'dashboard');
    B(-7.77,1.64,-7.252,.292,.017,.012,p.steel);
    // The audit office identifier is mounted beside the presentation wall.
    R(-2.67,2.57,-7.49,4.80,1.54,.095,p.ivory,.03);
    S([-2.67,2.57,-7.436],[4.57,0,0],[0,1.325,0],'office');
    B(-5.11,2.55,-7.411,.036,2.11,.034,p.warm);
    function furnishOffice() {
    sy=1.52;
    // Carpet island and executive table, writing pads, water and fresh foliage.
    slab(-8.85,.021,-3.25,5.67,3.87,.013,.25,p.carpet,0,.003);
    mesh.object('meeting-table',()=>{
    surface(-8.85,-3.25,.030,2.16,.84,p.carpet,.23);
    for(const sx of [-1,1]){
      R(-8.85+sx*1.27,.352,-3.25,.255,.602,.91,p.walnutDark,.046);
      R(-8.85+sx*1.27,.068,-3.25,.391,.105,1.02,p.rail,.032);}
    slab(-8.85,.752,-3.25,4.35,1.61,.033,.218,p.walnutDark);
    slab(-8.85,.801,-3.25,4.45,1.72,.066,.246,p.oak,0,.019);
    slab(-8.85,.839,-3.25,3.71,.379,.011,.095,p.leather,0,.003);
    for(const xx of [-10.12,-8.85,-7.58]){
      chair(xx,-4.62,1,p.carpet);chair(xx,-1.92,-1,p.carpet);
      for(const f of [-1,1]){doc(xx,.859,-3.25+f*.544,.96,f>0?.045:Math.PI-.04);
        glass(xx+.321,.84,-3.25+f*.488,.81);}
    }
    plant(-8.85,.846,-3.25,.51,.68);
    });
    // Two workstations, file storage and layered accessories.
    desk(-8.8,3.8,0);desk(-4.3,3.8,1);
    mesh.object('office-cabinet',()=>{
    surface(-3.4,-5.55,.001,.98,.37,p.floor,.16);
    R(-3.4,.452,-5.55,1.99,.812,.555,p.walnut,.028);
    B(-3.4,.095,-5.55,1.89,.128,.492,p.rail);
    slab(-3.4,.886,-5.55,2.0,.56,.076,.043,p.maple);
    for(let i=0;i<3;i++){const xx=-4.056+i*.656;R(xx,.475,-5.263,.635,.708,.03,p.oak,.009);R(xx+.193,.693,-5.237,.102,.021,.024,p.chrome,.008);}
    files(-4.20,.924,-5.58,4);book(-3.45,.96,-5.52,.372,.239,.068,p.blueBook,.03);book(-3.44,1.026,-5.52,.354,.222,.058,p.binder,-.04);
    plant(-2.82,.925,-5.58,.56,2.8);
    });
    for(const [x,z,s,seed] of [[-11.6,5.9,1.32,1.8],[-6.55,-6.25,.98,.1],[-1.4,-6.2,1.22,2.7]]){surface(x,z,.001,.35*s,.34*s,p.floor,.23);plant(x,0,z,s,seed);}
    sy=1;
    }

    // Warehouse shell, signage, fixed dock door, numbered racking and painted floor.
    for(const z of [-7.545,7.545]){
      for(let x=.65;x<16.72;x+=1.115)B(x,3.07,z,.014,6.04,.026,p.silver);
      for(const h of [.49,4.56])B(8.34,h,z-Math.sign(z)*.025,16.5,.065,.031,p.steel);
      for(const x of [2.3,7.05,11.8,16.05]){
        const front=z-Math.sign(z)*.064;
        R(x,5.48,front,2.3,.72,.04,p.rail,.018);
        R(x,5.48,front-Math.sign(z)*.027,2.16,.60,.018,p.sky,.01);
        for(const dx of [-.54,0,.54])B(x+dx,5.48,front-Math.sign(z)*.045,.023,.61,.022,p.steel);
      }
    }
    B(2.08,2.76,-7.492,3.73,1.43,.065,p.deep);
    S([2.08,2.76,-7.454],[3.62,0,0],[0,1.34,0],'distribution');
    // An identifier on the entrance's high fascia can be seen when approaching from the office.
    B(-.104,5.66,0,.045,.94,2.61,p.deep);
    S([-.132,5.66,0],[0,0,2.42],[0,.896,0],'distribution');
    R(16.602,1.82,.00,.075,3.72,3.43,p.steel,.029);
    for(let k=0;k<13;k++)B(16.553,.185+k*.256,.00,.033,.238,3.18,k%2?p.roof:p.silver);
    for(const z of [-1.67,1.67])B(16.514,1.849,z,.111,3.69,.111,p.deep);
    R(16.488,3.695,0,.15,.215,3.49,p.blue,.03);
    for(const z of [-2.04,2.04]){
      R(16.47,.66,z,.25,1.35,.21,p.amber,.035);
      for(const h of [.21,.52,.83,1.14])B(16.325,h,z,.012,.123,.213,p.graphite);
    }
    for(const z of [-6.85,6.85]){
      T([.25,5.29,z],[16.48,5.29,z],.041,p.red,10);
      for(const x of [2.2,6.1,10.1,14.4]){
        T([x,5.29,z],[x,5.08,z],.022,p.red,8);
        cyl(x,5.055,z,.062,.024,p.chrome,12);
      }
    }
    R(16.54,1.98,3.07,.13,.83,.56,p.ivoryMetal,.025);
    B(16.461,1.99,3.07,.025,.61,.43,p.paper);
    for(const h of [1.77,1.91,2.05]){
      sph(16.439,h,3.14,.014,.038,.038,h<2?p.green:p.red,10,6);
    }
    for(const x of [1.78,7.05,11.82,16.12])for(const z of [-4.49,4.49])B(x,-.04,z,.053,.007,4.69,p.yellow);
    for(const z of [-2.82,2.82])B(8.94,-.04,z,14.41,.008,.057,p.yellow);
    for(let i=0;i<6;i++)B(1.82+i*.228,-.039,.51,.106,.008,1.61,p.paper);
    function furnishWarehouse() {
    sy=1.16;
    for(let i=0;i<3;i++)for(const f of [-1,1])rack([4.5,9.3,14.1][i],f*5.75,i+(f>0?3:0));
    for(const f of [-1,1])for(const x of [6.9,11.7]){
      mesh.object(`rack-link:${x}:${f}`,()=>{
      B(x,4.40,f*5.75,1.84,.12,.09,p.rack);
      B(x,4.36,f*5.75,.024,.20,.13,p.silver);
      });
    }
    sy=1.32;
    for(let i=0;i<3;i++){
      const x=4.04+i*1.057;surface(x,-1.4,-.042,.498,.449,p.concrete,.23);
      mesh.object(`pallet:${i}`,()=>{
      pallet(x,-.034,-1.4,.931,.837);
      carton(x,.145,-1.4,.81,.598+(i%2)*.092,.699,[2,1,0][i]);
      });
    }
    forklift(12.19,-1.35);
    sy=1.52;
    // Inspection work bench and supplier kiosk inside their existing collision volumes.
    surface(5.65,2.05,-.042,1.0,.495,p.concrete,.18);
    mesh.object('inspection-bench',()=>{
    slab(5.65,.755,2.05,2.0,.96,.10,.055,p.maple);
    for(const dx of [-.877,.877])for(const dz of [-.342,.342])B(5.65+dx,.341,2.05+dz,.047,.741,.047,p.steel);
    B(5.65,.576,2.424,1.82,.168,.052,p.steel);B(5.65,.234,2.05,1.8,.061,.65,p.silver);
    doc(5.55,.824,2.1,1.2,-.15);files(5.00,.806,2.25,3);
    R(6.23,.866,2.10,.322,.127,.22,p.graphite,.044,-.26);R(6.23,.949,2.10,.184,.073,.159,p.orange,.02,-.26);
    });
    chair(5.65,3.15,-1,p.concrete);
    surface(15,1.4,-.042,.399,.344,p.concrete,.21);
    mesh.object('supplier-kiosk',()=>{
    R(15,.12,1.4,.619,.268,.604,p.deep,.039);
    R(15.02,.796,1.4,.49,1.191,.52,p.ivoryMetal,.044);
    R(14.918,1.436,1.4,.294,.249,.607,p.rail,.04);
    S([14.769,1.444,1.4],[0,0,.525],[0,.295/sy,0],'workstation');
    R(14.724,1.138,1.4,.179,.055,.53,p.silver,.018);
    B(14.765,.861,1.4,.012,.044,.235,p.blue);
    });
    sy=1;
    }

    // High ceilings complete both interiors; the structural members never enter the walking volume.
    B(-6.4,6.31,0,12.76,.25,15.29,p.ceiling);B(8.4,6.34,0,16.7,.26,15.31,p.roof);
    for(const z of [-7.28,7.28]){
      B(-6.4,5.85,z,12.68,.46,.50,p.ivory);B(-6.4,6.064,z-Math.sign(z)*.269,12.68,.029,.024,p.warm);}
    B(-12.29,5.85,0,.51,.46,14.32,p.ivory);B(-12.024,6.064,0,.025,.028,14.34,p.warm);
    for(const x of [-10.58,-6.35,-2.14])for(const z of [1.05,5.48,-5.64]){
      R(x,6.152,z,1.36,.058,.58,p.chrome,.022);R(x,6.115,z,1.283,.019,.506,p.lamp,.008);}
    for(let z=-7.3;z<=7.4;z+=.77)B(8.38,6.192,z,16.55,.035,.018,p.silver);
    // Light wells and square metal glazing bars under the continuous insulated roof.
    for(const z of [-3.49,3.49]){
      B(8.39,6.171,z,16.35,.041,1.54,p.sky);
      for(const f of [-1,1])B(8.39,6.12,z+f*.772,16.46,.074,.066,p.steel);
      for(let x=.58;x<16.65;x+=1.62)B(x,6.122,z,.039,.069,1.54,p.silver);}
    for(const x of [.44,4.52,8.62,12.72,16.45]){
      B(x,5.993,0,.109,.284,15.16,p.rail);B(x,5.86,0,.202,.035,15.16,p.steel);
      for(const z of [-7.41,7.41]){B(x,3.0,z,.15,5.99,.154,p.steel);
        T([x,4.99,z],[x,5.879,z-Math.sign(z)*1.29],.055,p.steel,8);}
    }
    for(const x of [2.52,6.57,10.64,14.63])for(const z of [-2.07,2.07]){
      T([x,5.593,z],[x,6.174,z],.014,p.steel,6);
      R(x,5.557,z,.92,.081,.408,p.graphite,.024);R(x,5.508,z,.858,.02,.344,p.lamp,.007);}
    // Pendant stays high above Marcos' face and the interview sight line.
    for(const x of [-10.13,-7.57])T([x,4.91,-3.25],[x,6.096,-3.25],.012,p.graphite,7);
    R(-8.85,4.85,-3.25,3.22,.135,.259,p.rail,.04);
    R(-8.85,4.778,-3.25,3.091,.015,.188,p.lamp,.005);
    mesh.beginProps();
    furnishOffice();furnishWarehouse();
    return mesh;
  }
  global.SCAIWorld = {build};
})(window);
