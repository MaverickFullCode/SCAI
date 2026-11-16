/* SCAI • Elenco da Aurora. Modelos autorais em coordenadas locais; frente = -Z.
   Os moldes e o acabamento são calculados uma vez. Somente o esqueleto anima. */
(function (global) {
  'use strict';
  const TAU=Math.PI*2, sin=Math.sin, cos=Math.cos, clamp=(v,l=0,h=1)=>Math.min(h,Math.max(l,v)), lerp=(a,b,t)=>a+(b-a)*t;
  const sub=(a,b)=>a.map((x,i)=>x-b[i]), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], unit=a=>{const f=1/(Math.hypot(...a)||1);return a.map(n=>n*f);};
  const col=s=>[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255), tint=(a,k)=>a.map(v=>clamp(v*k)), blend=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],clamp(t)));
  const profiles={
    auditor:{coat:'293f69',lapel:'344e7a',shirt:'abc9e8',pants:'353a49',skin:'e6ad87',lip:'bc7a6e',hair:'3e2a26',strand:'56392d',iris:'614834',leather:'343139'},
    manager:{coat:'343d58',lapel:'414c69',shirt:'90b4da',pants:'383f4b',skin:'d7a182',lip:'ad756b',hair:'4b403b',strand:'887a71',iris:'60513c',leather:'3a302e'},
    worker:{coat:'e67d36',lapel:'f29242',shirt:'375077',pants:'2f435e',skin:'b37b58',lip:'945e51',hair:'332722',strand:'46312b',iris:'503928',leather:'55483c'}
  };
  const fabric=0, skin=1, hair=2, leather=3, metal=4, enamel=5, rubber=6;
  // Profiles are interpolated with limited Hermite tangents, keeping the silhouette smooth
  // while preserving the edges of shoe soles, shirt cuffs and the brim of the hard hat.
  function sample(table,y) {
    let i=0;while(i<table.length-2&&y>table[i+1][0])i++;
    const a=table[i],b=table[i+1],pre=table[Math.max(0,i-1)],next=table[Math.min(i+2,table.length-1)],h=b[0]-a[0],t=clamp((y-a[0])/h),t2=t*t,t3=t2*t;
    return a.slice(1).map((v,k)=>{const j=k+1,d=(b[j]-v)/h;
      const slope=(r,s)=>r*s<=0?0:2*r*s/(r+s);
      const m0=i===0?d:slope((v-pre[j])/(a[0]-pre[0]),d),m1=i+2>=table.length?d:slope(d,(next[j]-b[j])/(next[0]-b[0]));
      return (2*t3-3*t2+1)*v+(t3-2*t2+t)*h*m0+(-2*t3+3*t2)*b[j]+(t3-t2)*h*m1;
    });
  }
  class Pattern {
    constructor(){this.chunks=new Map();this.bone('body');}
    bone(name){if(!this.chunks.has(name))this.chunks.set(name,[]);this.out=this.chunks.get(name);}
    surface(fn,nu,nv,c,mat,flip=false){
      const grid=[],ep=.00012;
      for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
        const u=i/nu,v=j/nv,p=fn(u,v),du=sub(fn(clamp(u+ep),v),fn(clamp(u-ep),v)),dv=sub(fn(u,clamp(v+ep)),fn(u,clamp(v-ep)));
        let n=unit(flip?cross(du,dv):cross(dv,du));if(Math.hypot(...n)<.5)n=[0,v>.5?1:-1,0];
        const color=typeof c==='function'?c(u,v,p):c;grid.push([...p,...n,...color,mat,0]);
      }
      const w=nu+1;
      for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
        const a=i+w*j,b=a+1,d=a+w,e=d+1;
        for(const k of (flip?[a,b,e,a,e,d]:[a,e,b,a,d,e]))this.out.push(...grid[k]);
      }
    }
    ell(x,y,z,rx,ry,rz,c,mat,n=14,m=8) {
      this.surface((u,v)=>{const a=u*TAU,b=(v-.5)*Math.PI;return[x+rx*sin(a)*cos(b),y+ry*sin(b),z-rz*cos(a)*cos(b)];},n,m,c,mat);
    }
    tube(path,radius,c,mat,n=12,sides=7){
      this.surface((u,v)=>{
        const a=u*TAU,p=path(v),t=unit(sub(path(clamp(v+.003)),path(clamp(v-.003)))),ref=Math.abs(t[2])>.9?[1,0,0]:[0,0,1],a1=unit(cross(t,ref)),a2=cross(t,a1),r=typeof radius==='function'?radius(v):radius;
        return p.map((n,i)=>n+r*(a1[i]*cos(a)+a2[i]*sin(a)));
      },sides,n,c,mat,true);
    }
    // Rows: [height, half width, half depth, center x, center z].
    loft(rows,c,mat,n=22,m=Math.max(10,rows.length*2)) {
      this.surface((u,v)=>{const y=lerp(rows[0][0],rows.at(-1)[0],v),[rx,rz,x,z]=sample(rows,y);return[x+sin(u*TAU)*rx,y,z-cos(u*TAU)*rz];},n,m,c,mat);
    }
    finish(){
      let count=0;for(const a of this.chunks.values())count+=a.length;
      const data=new Float32Array(count),parts=[];let offset=0;
      for(const [bone,a] of this.chunks){parts.push({bone,first:offset/11,count:a.length/11});data.set(a,offset);offset+=a.length;}
      return {data,parts};
    }
  }
  const arch=(a,b,h,t)=>lerp(a,b,t)+sin(Math.PI*t)*h;
  const gauss=(x,y,cx,cy,wx,wy)=>Math.exp(-(((x-cx)/wx)**2+((y-cy)/wy)**2));
  function makeHead(m,P,role) {
    const manager=role==='manager',worker=role==='worker';
    // Asymmetric cranium, wide cheekbones, narrow chin and the brow, eye sockets, muzzle,
    // nose bridge/alae and chin sculpted into the face itself (no separate nose sphere).
    const rows=[[2.619,.018,.041,-.054],[2.65,.101,.112,-.039],[2.70,.153,.143,-.02],[2.77,.182,.157,-.004],[2.86,.197,.171,.005],[2.96,.191,.169,.010],[3.028,.158,.144,.019],[3.071,.086,.097,.023],[3.086,.008,.012,.025]];
    function shape(y){const [w,d,z]=sample(rows,y);return[w*(manager?1.065:worker?1.035:1),d,z];}
    const sc=(x,y)=>-.055*gauss(x,y,0,2.836,.028,.083)-.077*gauss(x,y,0,2.792,.037,.026)
      -.042*(gauss(x,y,.032,2.781,.018,.014)+gauss(x,y,-.032,2.781,.018,.014))
      -.016*gauss(x,y,0,2.726,.10,.041)-.019*gauss(x,y,0,2.666,.079,.037)
      -.020*gauss(Math.abs(x),y,.113,2.807,.055,.044)+.016*gauss(Math.abs(x),y,.082,2.869,.044,.028)
      -.012*gauss(Math.abs(x),y,.080,2.902,.07,.023);
    function faceZ(x,y){const [w,d,z]=shape(y),q=Math.sqrt(clamp(1-(x/w)**2));return z-d*q+sc(x,y)*q*q;}
    function scalp(a,y){const [w,d,z]=shape(y),h=cos(a),x=w*sin(a);return[x,y,z-d*h+sc(x,y)*Math.max(0,h)**2];}
    m.bone('head');
    const blush=blend(P.skin,P.lip,.55),shadow=blend(P.lip,P.skin,.46);
    m.surface((u,v)=>scalp(u*TAU,lerp(rows[0][0],rows.at(-1)[0],v)),manager?84:68,manager?68:55,(u,v,p)=>{
      const f=Math.max(0,cos(u*TAU)),x=Math.abs(p[0]),y=p[1];
      let c=blend(P.skin,blush,f*(.78*gauss(x,y,.126,2.805,.049,.051)+.57*gauss(p[0],y,0,2.79,.043,.027)));
      c=blend(c,shadow,f*(.40*gauss(x,y,.083,2.887,.048,.012)+.28*gauss(x,y,.082,2.843,.045,.012)+.24*gauss(x,y,.038,2.777,.012,.010)));
      if(manager&&y<2.763){
        const bars=gauss(x,y,.076,2.705,.014,.029),chin=clamp((2.693-y)/.018)*clamp((.111-x)/.019);
        let g=clamp(Math.max(bars*1.48,chin))*clamp(f*2),mix=clamp((2.695-y)*8+.20+.32*sin(u*560+v*136)**2);
        const stubble=blend(col('68564a'),col('c5b7a6'),mix);
        c=blend(c,stubble,g);c=blend(c,stubble,.18*clamp((2.72-y)/.063)*(1-g));
      }
      return c;
    },skin);
    for(const s of [-1,1]){
      const ex=s*(manager?.197:.186);
      m.ell(ex,2.815,.006,.037,.062,.034,P.skin,skin,18,12);
      m.ell(ex+s*.025,2.816,-.005,.013,.041,.022,blend(P.skin,P.lip,.5),skin,14,10);
      m.tube(t=>[ex+s*(.030+.004*sin(t*Math.PI)),2.798+.043*t,-.008+.012*sin(Math.PI*t)],t=>.004+.002*sin(Math.PI*t),P.skin,skin);
    }
    const eyeY=manager?2.865:2.87,eyeX=manager?.082:.079,ew=manager?.048:.050,top=manager?.019:.021,bot=manager?.014:.016;
    for(const s of [-1,1]){
      const X=s*eyeX,mid=k=>eyeY+.004*s*k,rad=k=>Math.max(0,1-k*k)**.77;
      function ez(x,y){const k=clamp((x-X)/ew,-1,1),r=rad(k),off=y-mid(k);return faceZ(x,y)-.003-.017*Math.max(0,1-k*k-(off/(off>=0?top:bot))**2);}
      m.surface((u,v)=>{const k=2*u-1,r=rad(k),x=X+ew*k,y=mid(k)+lerp(-bot,top,v)*r;return[x,y,ez(x,y)];},20,8,col('eee8da'),enamel);
      const irisX=X-s*.002,irisY=eyeY+.003;
      function disk(cx,cy,rx,ry,color,lift){m.surface((u,v)=>{const a=u*TAU,r=.0001+v*.9999,x=cx+rx*sin(a)*r,y=cy+ry*cos(a)*r;
        const k=(x-X)/ew,yy=clamp(y,mid(k)-bot*rad(k)+.0002,mid(k)+top*rad(k)-.0002);return[x,yy,ez(x,yy)-lift];},20,3,color,enamel);}
      disk(irisX,irisY,.019,.020,col('47372c'),.0009);disk(irisX,irisY,.016,.017,P.iris,.0015);disk(irisX,irisY,.009,.011,col('221e21'),.0022);
      disk(irisX-.005,irisY+.006,.004,.004,col('fffbee'),.0029);
      function lid(t,upper,shift=0){const k=t*2-1,x=X+k*ew,y=mid(k)+(upper?top:-bot)*rad(k)+shift;return[x,y,faceZ(x,y)-.004];}
      m.tube(t=>lid(t,true),t=>.0012+.0033*sin(Math.PI*t),tint(P.hair,.84),hair,19,6);
      m.tube(t=>lid(t,false),t=>.001+.0023*sin(Math.PI*t),blend(P.skin,P.lip,.7),skin,18,6);
      m.tube(t=>lid(t,true,.008),t=>.0004+.0017*sin(Math.PI*t),blend(P.skin,P.lip,.62),skin,16,5);
      const brow=t=>{const x=s*(.027+t*.117),y=arch(2.907,2.896,manager?.009:.014,t)+(manager?.007*(1-t):.004*t);return[x,y,faceZ(x,y)-.006];};
      m.surface((u,v)=>{const p=brow(u),th=(.002+.010*sin(Math.PI*(.12+.86*u)))*(1.05-.35*u),y=p[1]+(v-.48)*2*th;return[p[0],y,faceZ(p[0],y)-.003-.008*sin(Math.PI*v)];},18,5,P.hair,hair,s<0);
      // Shallow, naturally dark nostrils just under the wings of the nose.
      m.surface((u,v)=>{const a=TAU*u,r=v*.999+.001,x=s*.025+r*.008*sin(a),y=2.777+.0035*r*cos(a);
        return[x,y,faceZ(x,y)-.001];},12,2,tint(P.lip,.76),skin);
      if(manager){
        for(const [y,w,bend] of [[2.839,.086,-.005],[2.918,.086,.009],[2.756,.035,-.008]]){
          const p=t=>{const x=s*((y<2.8?.044:.042)+w*t),yy=y+bend*sin(Math.PI*t)+(y<2.8?-.026*t:0);return[x,yy,faceZ(x,yy)-.0009];};
          m.tube(p,t=>.0002+.0009*sin(Math.PI*t),blend(shadow,P.skin,.48),skin,14,5);
        }
      }
    }
    if(manager){
      // Marcos is recognizable in the interview by his greying boxed beard and
      // moustache. Follow the jaw/nasolabial curves so the beard reads in profile.
      const salt=col('b1a196'),pepper=col('67564d');
      for(const s of [-1,1])m.surface((u,v)=>{
        const x=s*(.001+.087*u),y=arch(2.751,2.724,.006,u)-v*(.010+.007*sin(Math.PI*u));
        return[x,y,faceZ(x,y)-.002-.005*sin(v*Math.PI)];},18,5,(u,v)=>blend(pepper,salt,.11+.15*sin(u*51+v*4)**2),hair,s>0);
      m.surface((u,v)=>{const x=(u-.5)*.054,y=2.694+.009*v-.009*(Math.abs(u-.5)*2)**2;return[x,y,faceZ(x,y)-.0015];},12,3,pepper,hair);
    }
    const lipW=manager?.070:.071,smile=x=>2.724+.005*(x/lipW)**2;
    function lips(part){m.bone(part==='bottom'?'lip':part==='inside'?'mouth':'head');m.surface((u,v)=>{
      const k=u*2-1,x=k*lipW,r=Math.max(0,1-k*k),base=smile(x);
      let y;if(part==='inside')y=2.725+(.0015*v-.005*(1-v))*r+.004*(1-r);
      else if(part==='bottom')y=base-r*(.003+.012*(1-v));
      else y=base+r*v*(.009+.004*Math.exp(-((Math.abs(k)-.27)**2)/.033));
      const z=faceZ(x,y)-(part==='inside'?.007:.009+(part==='bottom'?.005:.003)*sin(Math.PI*v))*r;
      return[x,y,z];},24,5,part==='inside'?col('583637'):part==='bottom'?blend(P.skin,P.lip,.82):P.lip,skin);}
    lips('upper');lips('inside');lips('bottom');
    m.bone('teeth');m.surface((u,v)=>{const k=u*2-1,x=k*lipW*.83,r=1-k*k,y=2.724-(1-v)*.004*r;return[x,y,faceZ(x,y)-.008*r-.001];},16,4,col('e4d4be'),enamel);
    m.bone('head');
    // Interpolate the hand-cut hairline around temples and ears. A crescent of
    // forehead is exposed at the part, while the fringe sweeps down the other side.
    const cut=[[-3.142,2.784],[-2.38,2.804],[-1.83,2.853],[-1.57,2.872],[-1.38,2.837],[-1.19,2.91],[-.90,2.943],[-.61,2.931],[-.30,2.956],[.12,2.965],[.47,2.980],[.64,2.958],[.78,2.95],[1.11,2.932],[1.36,2.842],[1.55,2.874],[1.90,2.851],[2.4,2.805],[3.142,2.784]];
    function hairline(a){return sample(cut,Math.atan2(sin(a),cos(a)))[0]+(manager?.009:0);}
    function cap(a,v,raised=0){
      const f=cos(a),low=hairline(a),ang=v*Math.PI*.5,ys=lerp(low,3.084,sin(ang)),p=scalp(a,ys);
      const sweep=Math.max(0,f)*(.55-.32*sin(a)),bulge=sin(Math.PI*v),th=.011*(1-v)+.019*bulge+(manager?.014:.035)*bulge*sweep;
      return[p[0]+sin(a)*(th+raised)-.021*v,p[1]+(.017+(manager?.003:.039)*sweep)*sin(ang)+raised*(.15+.85*v),p[2]-f*(th+raised)-.012*bulge*sweep];
    }
    if(worker){
      m.surface((u,v)=>{const a=u*TAU,y=lerp(Math.min(2.927,hairline(a)),2.937,v),p=scalp(a,y);return[p[0]+.006*sin(a),y,p[2]-.006*cos(a)];},44,8,P.hair,hair);
    }else{
      m.surface((u,v)=>cap(u*TAU,v),54,21,(u,v)=>blend(P.hair,P.strand,(manager?.58:.18)*(1-cos(u*TAU))*.5+.09*v),hair);
    }
    // The side part and broad swept locks follow the scalp in 3D; tapered relief
    // reads in the crown and the nape, without a flat painted-on hair silhouette.
    if(!worker){
      for(let i=0;i<22;i++){const start=-Math.PI+TAU*i/22,front=Math.max(0,cos(start)),sweep=start<.65?1:-1,amp=(.15+front*.47)*(manager?.85:1);
        m.surface((u,v)=>{const taper=sin(Math.PI*v)**.65,t=.008+.95*v,a=start+sweep*amp*sin(Math.PI*v*.84)+.027*sin(v*TAU+start)+(u-.5)*(.15+.24*front)*taper;
          return cap(a,t,.0007+sin(Math.PI*u)*taper*(.005+.014*front));},6,17,(u,v)=>blend(P.hair,P.strand,(.05+.48*sin(Math.PI*u)*sin(Math.PI*v))*(manager?1:.78)),hair);
      }
    } else {
      const gold=col('f4ab30'),goldHi=col('ffd25b');
      m.loft([[2.927,.211,.187,0,0],[2.938,.219,.195,0,.002],[2.96,.218,.194,0,.003],[3.026,.207,.187,0,.008],[3.082,.172,.161,0,.011],[3.12,.109,.113,0,.014],[3.14,.006,.006,0,.015]],gold,metal,36,18);
      m.loft([[2.918,.223,.225,0,-.016],[2.923,.244,.251,0,-.028],[2.935,.246,.251,0,-.028],[2.948,.209,.202,0,0]],goldHi,metal,40,9);
      for(const s of [-1,1])m.tube(t=>[s*(.048+.006*sin(Math.PI*t)),2.972+.163*sin(Math.PI*t),lerp(-.18,.187,t)],t=>.002+.008*sin(Math.PI*t),goldHi,metal,22);
    }
  }
  function tailoring(m,P,role){
    const worker=role==='worker',manager=role==='manager', silver=col('acb7c4'),boneButton=col('757d87');
    m.bone('body');
    const neckRows=[[2.34,.155,.138,0,.012],[2.42,.135,.126,0,.012],[2.52,.112,.118,0,.012],[2.62,.094,.098,0,.006],[2.69,.098,.098,0,-.004]];
    m.loft(neckRows,tint(P.skin,.96),skin,24);
    function neckPoint(angle,y,clearance) {
      const [width,depth,x,z]=sample(neckRows,y);
      return [x+(width+clearance)*sin(angle),y,z-(depth+clearance)*cos(angle)];
    }
    const body=[[1.425,.280,.172,.018],[1.458,.327,.193,.018],[1.56,.348,.206,.012],[1.71,.317,.195,.007],[1.87,.296,.176,.012],[2.04,.316,.187,.013],[2.20,.354,.210,.006],[2.335,.374,.198,.010],[2.40,.388,.166,.018],[2.444,.347,.139,.02],[2.484,.191,.111,.014],[2.513,.113,.108,.007]];
    function cloth(a,y,off=0){
      const [w,d,z]=sample(body,y),h=cos(a);
      return[(w+off)*sin(a),y,z-(d+off)*h-.008*Math.max(0,h)*Math.exp(-((y-2.245)**2)/.019)*sin(a)**2];
    }
    function front(x,y,off=0){const [w]=sample(body,y);return cloth(Math.asin(clamp(x/(w+off),-.995,.995)),y,off);}
    function sticker(bound,c,mat,lift=.005,n=10){
      m.surface((u,v)=>{const [x,y]=bound(u,v);return front(x,y,lift);},n,n,c,mat);
    }
    function quad(points,c,mat,off=.005){
      sticker((u,v)=>[0,1].map(j=>lerp(lerp(points[0][j],points[1][j],u),lerp(points[3][j],points[2][j],u),v)),c,mat,off,8);
    }
    function crease(path,r,c,mat,off=.009){m.tube(t=>{const [x,y]=path(t);return front(x,y,off);},r,c,mat,16,6);}
    function rivet(x,y,r,c,off=.009){const q=front(x,y,off);m.ell(q[0],q[1],q[2],r,r,.004,c,metal,10,5);}
    const edges=worker?[[1.56,.15],[1.72,.14],[2.26,.14],[2.40,.36],[2.51,.50]]:[[1.425,.46],[1.47,.37],[1.70,.18],[1.87,.015],[2,.13],[2.18,.32],[2.34,.45],[2.44,.66],[2.51,.66]];
    const ylo=edges[0][0],yhi=edges.at(-1)[0],gap=y=>sample(edges,y)[0];
    const collarOpening=.50;
    const neckline=angle=>2.49-.020*Math.max(0,cos(angle))**6;
    const collarBase=angle=>neckPoint(angle,neckline(angle),.007);
    const collarTop=angle=>neckPoint(angle,2.515-.007*Math.max(0,cos(angle))**4,.009);
    // The shirt, collar stand and folded collar share their joining edges.
    for(const side of [-1,1]) {
      m.surface((u,v)=>{
        const height=lerp(1.74,2.49,v);
        const opening=collarOpening*clamp((height-2.414)/.076);
        const angle=side*lerp(opening,gap(height)+.04,u);
        const y=height+(neckline(angle)-2.49)*v**10;
        const chest=cloth(angle,y,-.014),neck=neckPoint(angle,y,.007);
        const blend=clamp((v-.90)/.10),weight=blend*blend*(3-2*blend);
        return chest.map((value,i)=>lerp(value,neck[i],weight));
      },24,40,P.shirt,fabric,side<0);
    }
    m.surface((u,v)=>{
      const angle=lerp(collarOpening,TAU-collarOpening,u);
      const base=collarBase(angle),top=collarTop(angle);
      return base.map((value,i)=>lerp(value,top[i],v));
    },48,8,tint(P.shirt,.96),fabric);
    const collarSide=1.60;
    const backHem=angle=>neckPoint(angle,2.478,.026);
    // The back fold continues around the neck into the two front collar leaves.
    m.surface((u,v)=>{
      const angle=lerp(collarSide,TAU-collarSide,u);
      const top=collarTop(angle),hem=backHem(angle);
      const fold=.006*sin(Math.PI*v);
      return [
        lerp(top[0],hem[0],v)+fold*sin(angle),
        lerp(top[1],hem[1],v),
        lerp(top[2],hem[2],v)-fold*cos(angle)
      ];
    },36,10,tint(P.shirt,.98),fabric,true);
    for(const side of [-1,1]) {
      const angleAt=u=>side>0?lerp(collarOpening,collarSide,u):TAU-lerp(collarOpening,collarSide,u);
      const frontHem=u=>{
        const x=side*lerp(.090,.162,u);
        const y=lerp(2.390,2.478,u);
        const hem=front(x,y,.010);
        const seam=backHem(angleAt(1));
        const join=u**8;
        return hem.map((value,i)=>lerp(value,seam[i],join));
      };
      m.surface((u,v)=>{
        const angle=angleAt(u),top=collarTop(angle),hem=frontHem(u);
        const bulge=.012*sin(Math.PI*v);
        return [lerp(top[0],hem[0],v),lerp(top[1],hem[1],v),lerp(top[2],hem[2],v)-bulge];
      },20,14,tint(P.shirt,.98),fabric,side>0);
      m.tube(frontHem,.0014,tint(P.shirt,.80),fabric,24,5);
    }
    m.loft([[1.451,.243,.164,0,.004],[1.49,.306,.181,0,.003],[1.57,.318,.184,0,.003],[1.665,.295,.177,0,0],[1.733,.284,.170,0,0]],P.pants,fabric,30);
    m.loft([[1.69,.29,.177,0,.001],[1.696,.298,.182,0,0],[1.744,.294,.179,0,0],[1.75,.287,.172,0,0]],P.leather,leather,30,8);
    m.ell(0,1.719,-.179,.052,.027,.009,silver,metal,16,8);m.ell(0,1.719,-.186,.04,.016,.006,P.leather,leather,14,8);
    const jacketSurface=(u,y)=>{
      const opening=gap(y),angle=lerp(opening,TAU-opening,u);
      return cloth(angle,y,.008);
    };
    m.surface((u,v)=>jacketSurface(u,lerp(ylo,2.34,v)),48,28,P.coat,fabric);
    m.surface((u,v)=>jacketSurface(u,lerp(2.34,yhi,v)),48,32,P.coat,fabric);
    for(const s of [-1,1]){
      if(!worker){
        const lapel=[[1.875,.009,.018],[1.938,.029,.066],[2.13,.086,.155],[2.292,.135,.235],[2.359,.148,.246],[2.372,.148,.202],[2.411,.142,.226],[2.469,.115,.176],[2.493,.101,.124]];
        sticker((u,v)=>{const y=lerp(lapel[0][0],lapel.at(-1)[0],v),[a,b]=sample(lapel,y);return[s*lerp(a,b,u),y];},P.lapel,fabric,.015,24);
        crease(t=>[s*lerp(.18,.29,t),1.733+.009*t],.005,tint(P.coat,.69),fabric,.013);
        quad([[s*.174,1.741],[s*.292,1.751],[s*.288,1.708],[s*.174,1.70]],tint(P.coat,1.10),fabric,.014);
      } else {
        // Reflective bands wrap around the back and both edges of the hi-vis vest.
        const refl=col('dcd9b1');
        if(s===1)for(const y of [1.74,1.99]){
          m.surface((u,v)=>{const g=gap(y)+.008;return cloth(lerp(g,TAU-g,u),y+.048*v,.012);},36,3,refl,fabric);
        }
        m.surface((u,v)=>{const y=1.74+.73*v,a=s*(.66+(u-.5)*.20+.10*sin(Math.PI*v));return cloth(a,y,.013);},5,17,refl,fabric,s<0);
        m.surface((u,v)=>{const y=1.74+.73*v,a=Math.PI+s*(.64+(u-.5)*.20+.10*sin(Math.PI*v));return cloth(a,y,.013);},5,17,refl,fabric,s<0);
      }
    }
    if(!worker){
      quad([[.195,2.27],[.299,2.276],[.296,2.259],[.194,2.253]],tint(P.lapel,1.13),fabric,.015);
      for(const y of [1.831,1.932])rivet(.054,y,.012,boneButton,.016);
    }
    if(manager){
      crease(t=>[0,lerp(1.96,2.392,t)],.003,tint(P.shirt,.87),fabric,-.008);
      for(const y of [2.035,2.17,2.308,2.390])rivet(0,y,.008,col('d9e0e9'),-.002);
    } else if(!worker){
      for(const s of [-1,1]){
        crease(t=>[s*lerp(.127,.037,t),lerp(2.468,2.102,t)],.009,col('263c56'),fabric,.021);
      }
      const plate=col('e0e7eb');
      quad([[-.052,2.107],[.057,2.103],[.053,1.97],[-.056,1.974]],plate,enamel,.032);
      quad([[-.049,2.097],[.052,2.094],[.051,2.075],[-.049,2.079]],col('487da9'),fabric,.037);
      quad([[-.037,2.067],[-.004,2.067],[-.005,2.014],[-.038,2.015]],col('92adc2'),enamel,.037);
      for(const y of [2.055,2.041,2.026])crease(t=>[.006+t*.033,y],.002,col('647e94'),enamel,.038);
      for(const y of [2.286,2.18])rivet(.005,y,.007,col('e4e4dc'),.0);
    } else {
      quad([[.162,2.24],[.263,2.24],[.262,2.11],[.16,2.11]],tint(P.coat,.91),fabric,.021);
      quad([[.172,2.227],[.253,2.227],[.253,2.166],[.171,2.165]],col('ede8d8'),enamel,.025);
      for(const y of [2.21,2.193])crease(t=>[.18+t*.058,y],.0025,col('517184'),enamel,.029);
    }
  }
  function limbs(m,P,role) {
    const worker=role==='worker',silver=col('a4aeb9'),skinC=P.skin;
    for(const s of [-1,1]){
      const side=s<0?'L':'R';
      function loft(rows,c,material,n=22,v){m.loft(rows.map(([y,w,d,x,z])=>[y,w,d,s*x,z]),c,material,n,v);}
      m.bone('thigh'+side);
      loft([[.765,.105,.110,.166,-.010],[.80,.114,.123,.167,-.011],[.87,.121,.135,.167,-.016],[1.04,.126,.147,.164,-.005],[1.25,.148,.164,.155,0],[1.44,.162,.175,.151,.011],[1.54,.156,.168,.152,.011],[1.59,.115,.12,.15,.008]],P.pants,fabric,28);
      m.bone('shin'+side);
      loft([[.158,.099,.102,.169,.018],[.185,.109,.125,.168,.012],[.225,.109,.128,.166,.006],[.261,.098,.108,.164,.013],[.32,.099,.123,.164,.014],[.50,.103,.130,.165,.022],[.66,.121,.139,.164,.019],[.784,.110,.126,.166,-.003],[.842,.110,.121,.166,-.012],[.878,.095,.106,.165,-.016]],P.pants,fabric,28);
      m.bone('foot'+side);
      const sole=worker?col('403e39'):col('272930');
      loft([[.012,.102,.179,.165,-.044],[.020,.114,.195,.165,-.054],[.050,.116,.20,.165,-.055],[.072,.111,.192,.165,-.05]],sole,rubber,28,8);
      loft([[.055,.107,.190,.165,-.053],[.066,.115,.196,.165,-.054],[.082,.115,.195,.165,-.055],[.108,.108,.182,.165,-.051],[.138,.103,.155,.165,-.036],[.17,.091,.128,.166,-.014],[.200,.087,.104,.166,.011],[.223,.078,.088,.166,.014]],P.leather,leather,28,18);
      for(let i=0;i<3;i++){
        const y=.119+i*.017,z=-.197+i*.034;
        m.tube(t=>[s*.165+lerp(-.047,.047,t),y+.013*sin(Math.PI*t),z-.003*sin(Math.PI*t)],.0038,tint(P.leather,1.26),leather,9,5);
      }
      m.bone('arm'+side);
      const sleeve=worker?P.shirt:P.coat;
      loft([[1.98,.092,.094,.429,.006],[2.015,.102,.106,.431,.009],[2.105,.105,.111,.422,.011],[2.258,.119,.128,.403,.014],[2.377,.126,.14,.369,.016],[2.431,.099,.11,.359,.016],[2.466,.051,.058,.348,.017],[2.473,.006,.007,.345,.017]],sleeve,fabric,24);
      m.bone('fore'+side);
      if(worker){
        loft([[1.596,.069,.068,.457,-.051],[1.74,.083,.086,.455,-.020],[1.88,.095,.102,.445,.002],[1.985,.087,.10,.432,.005],[2.042,.086,.096,.429,.005]],skinC,skin,20);
      }else{
        loft([[1.607,.08,.083,.454,-.054],[1.628,.088,.09,.453,-.052],[1.73,.087,.095,.452,-.038],[1.895,.099,.105,.44,-.003],[1.993,.1,.108,.43,.005],[2.052,.092,.095,.427,.007]],sleeve,fabric,24);
        loft([[1.582,.075,.077,.456,-.055],[1.594,.078,.079,.456,-.055],[1.626,.080,.081,.454,-.051]],P.shirt,fabric,20,6);
        for(let k=0;k<3;k++)m.ell(s*(.535-k*.002),1.652+k*.022,-.042,.005,.007,.007,tint(P.coat,.73),metal,8,5);
      }
      loft([[1.42,.040,.054,.457,-.053],[1.447,.055,.067,.462,-.057],[1.51,.067,.082,.458,-.062],[1.575,.055,.067,.456,-.058],[1.637,.051,.06,.453,-.049]],skinC,skin,20,13);
      for(let k=0;k<4;k++){
        const z=.005-k*.031,y=1.406-.026*sin(Math.PI*(k+.3)/4),xx=.459+.007*sin(k);
        loft([[y,.007,.008,xx-.009,z-.051],[y+.012,.019,.017,xx-.002,z-.055],[y+.04,.022,.018,xx+.003,z-.056],[1.464,.024,.019,xx,z-.06]],skinC,skin,12,9);
      }
      m.tube(t=>[s*(.43-.018*sin(Math.PI*t)+.010*t),1.532-.086*t,-.114-.027*sin(Math.PI*t*.9)],t=>.007+.019*sin(Math.PI*(.12+.79*t)),skinC,skin,10,10);
      if(!worker&&s<0){
        loft([[1.576,.062,.069,.456,-.058],[1.59,.064,.07,.456,-.058],[1.607,.064,.07,.455,-.056]],P.leather,leather,18,5);
        m.ell(s*.514,1.595,-.062,.015,.027,.027,silver,metal,12,8);
        m.ell(s*.525,1.596,-.062,.009,.021,.021,col('394957'),metal,12,8);
      }
      if(role==='auditor'&&s>0){
        // A slim folio is carried against the palm, moving with the grasping forearm.
        const tx=.420,ty=1.418,tz=-.065;
        const shapes=[[0,.962],[.10,.989],[.24,1],[.76,1],[.91,.988],[1,.963]];
        const point=(a,r,x)=>{const yy=sin(a),zz=cos(a);return[x,ty+r*.218*Math.sign(yy)*Math.abs(yy)**.22,tz+r*.144*Math.sign(zz)*Math.abs(zz)**.22];};
        m.surface((u,v)=>point(u*TAU,sample(shapes,v)[0],tx+lerp(-.012,.012,v)),48,6,col('586372'),metal);
        for(const r of [-1,1])m.surface((u,v)=>point(u*TAU,.0001+v*.966,tx+r*.012),48,4,r>0?col('3b4656'):col('354054'),leather,r<0);
        m.ell(tx+.013,ty+.180,tz+.098,.004,.013,.013,col('202736'),metal,12,8);
        for(let i=0;i<3;i++)m.ell(tx+.013,ty-.055+.005*i,tz-.032+.010*i,.0018,.010+.006*i,.003,col('8195a8'),metal,8,5);
      }
    }
  }
  const baked=new Map();
  function build(role='auditor'){
    if(!Object.hasOwn(profiles,role))role='auditor';
    if(!baked.has(role)){
      const m=new Pattern(),P=Object.fromEntries(Object.entries(profiles[role]).map(([k,v])=>[k,col(v)]));
      tailoring(m,P,role);limbs(m,P,role);makeHead(m,P,role);baked.set(role,m.finish());
    }
    return baked.get(role);
  }
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function multiply(a,b){
    const o=new Float32Array(16);
    for(let j=0;j<4;j++)for(let i=0;i<4;i++)o[j*4+i]=a[i]*b[j*4]+a[i+4]*b[j*4+1]+a[i+8]*b[j*4+2]+a[i+12]*b[j*4+3];
    return o;
  }
  function transform(x=0,y=0,z=0,rx=0,ry=0,rz=0){
    const cx=cos(rx),sx=sin(rx),cy=cos(ry),sy=sin(ry),cz=cos(rz),sz=sin(rz);
    // yaw sign is the game's convention: local -Z advances along (sin(dir), -cos(dir)).
    return new Float32Array([cy*cz,-sz,sy*cz,0,cy*sz*cx-sy*sx,cz*cx,sy*sz*cx+cy*sx,0,-cy*sz*sx-sy*cx,-cz*sx,-sy*sz*sx+cy*cx,0,x,y,z,1]);
  }
  function joint(parent,p,rx=0,ry=0,rz=0){
    const r=transform(0,0,0,rx,ry,rz);
    for(let i=0;i<3;i++)r[i+12]=p[i]-(r[i]*p[0]+r[i+4]*p[1]+r[i+8]*p[2]);
    return multiply(parent,r);
  }
  const strideDistance = 2.2;
  const stanceFraction = .54;
  const hipHeight = 1.52;
  const kneeHeight = .821;
  const ankleHeight = .195;
  const thighLength = Math.hypot(hipHeight-kneeHeight,.017);
  const shinLength = Math.hypot(kneeHeight-ankleHeight,.020);
  const restThighAngle = Math.atan2(.017,hipHeight-kneeHeight);
  const restShinAngle = Math.atan2(-.020,kneeHeight-ankleHeight);

  function pose(x,z,time=0,walking=false,role='auditor',dir=0,mouth=false,walkDistance){
    const t=time+(role==='manager'?1.3:role==='worker'?2.7:0);
    const w=walking?1:0, breath=sin(t*1.65), answer=mouth?1:0;
    const cycle=(walkDistance ?? time*3.6)/strideDistance;
    const phase=cycle*TAU;
    const root=transform(x,0,z,0,dir),rig={};
    rig.body=joint(multiply(root,transform(0,.003*breath,0)),[0,1.66,0],0,-sin(phase)*.055*w,cos(phase)*.013*w);
    rig.head=joint(rig.body,[0,2.58,0],-.013*breath+.018*sin(t*5)*answer,.029*sin(t*.66)+.033*sin(t*2.5)*answer,.006*sin(t*.94));
    const headShape=identity();
    headShape[0]=role==='auditor'?.90:.94;
    headShape[5]=role==='manager'?1.08:1.04;
    headShape[13]=2.84*(1-headShape[5]);
    rig.head=multiply(rig.head,headShape);
    const vis=answer*(.4+.33*sin(t*19)+.20*sin(t*29+1)+.07*sin(t*42)),op=Math.max(0,vis);
    const open=identity();open[5]=1+3.7*op;open[13]=2.732*(1-open[5]);
    rig.mouth=multiply(rig.head,open);rig.lip=multiply(rig.head,transform(0,-.022*op,.001*op));
    rig.teeth = rig.head;
    for(const s of [-1,1]){
      const side=s<0?'L':'R',swing=-s*cos(phase);
      if (walking) {
        const progress=(cycle+(s<0?0:.5))%1;
        const halfStep=strideDistance*stanceFraction*.5;
        let footZ, lift=0, footRoll;
        if (progress < stanceFraction) {
          // A planted foot moves rearward relative to the body at the exact travel speed.
          footZ=-halfStep+strideDistance*progress;
          const heel=1-clamp(progress/.12);
          const toe=clamp((progress-(stanceFraction-.13))/.13);
          footRoll=.22*heel-.32*toe*toe*(3-2*toe);
        } else {
          // Advance the lifted foot, matching the stance velocity at both ends.
          const swingProgress=(progress-stanceFraction)/(1-stanceFraction);
          const v=swingProgress, smooth=v*v*(3-2*v);
          const tangent=strideDistance*(1-stanceFraction);
          footZ=halfStep-2*halfStep*smooth+tangent*(2*v*v*v-3*v*v+v);
          lift=.18*sin(Math.PI*v);
          footRoll=lerp(-.32,.22,v)+.12*sin(Math.PI*v);
        }
        const footBottom=Math.min(...[
          [.012,-.223],[.012,.135],[.020,-.249],
          [.020,.141],[.050,-.255],[.050,.145]
        ].map(([y,z])=>cos(footRoll)*(y-ankleHeight)-sin(footRoll)*(z-.010)));
        const targetY=-footBottom+.009+lift;
        const deltaY=targetY-hipHeight;
        const deltaZ=footZ+.010-.007;
        const distanceSquared=deltaY*deltaY+deltaZ*deltaZ;
        // Let the leg reach its planted foot while keeping the pelvis at standing height.
        const legScale=Math.max(1,(Math.sqrt(distanceSquared)+.001)/(thighLength+shinLength));
        const scaledThigh=thighLength*legScale, scaledShin=shinLength*legScale;
        const kneeFlex=Math.acos(clamp(
          (distanceSquared-scaledThigh*scaledThigh-scaledShin*scaledShin)/(2*scaledThigh*scaledShin),-1,1));
        const hipAngle=Math.atan2(-deltaZ,-deltaY)+
          Math.atan2(scaledShin*sin(kneeFlex),scaledThigh+scaledShin*cos(kneeFlex))-restThighAngle;
        const kneeAngle=restThighAngle-restShinAngle-kneeFlex;
        const stretch=identity();
        stretch[5]=stretch[10]=legScale;
        stretch[13]=hipHeight*(1-legScale);
        stretch[14]=.007*(1-legScale);
        const legRoot=multiply(root,stretch);
        rig['thigh'+side]=joint(legRoot,[s*.151,hipHeight,.007],hipAngle);
        rig['shin'+side]=joint(rig['thigh'+side],[s*.165,kneeHeight,-.010],kneeAngle);
        const shoeScale=identity();
        shoeScale[5]=shoeScale[10]=1/legScale;
        shoeScale[13]=ankleHeight*(1-1/legScale);
        shoeScale[14]=.010*(1-1/legScale);
        rig['foot'+side]=multiply(
          joint(rig['shin'+side],[s*.166,ankleHeight,.010],footRoll-hipAngle-kneeAngle),shoeScale);
      } else {
        rig['thigh'+side]=root;
        rig['shin'+side]=root;
        rig['foot'+side]=root;
      }
      const gesture=answer*(.50+.50*sin(t*2.4+s*.8));
      const carry=role==='auditor'&&s===1;
      rig['arm'+side]=joint(rig.body,[s*.356,2.411,.016],-.017-w*swing*(carry?.19:.39)+.07*gesture,.007*breath,-s*(.015+.019*gesture));
      rig['fore'+side]=joint(rig['arm'+side],[s*.429,2.011,.005],(carry?.30:.08)+w*(.12+.10*Math.max(0,-swing))+.35*gesture+s*.018*breath);
    }
    return rig;
  }
  global.SCAIPeople={build,pose};
})(window);
