/* SCAI • Elenco da Aurora. Modelos autorais em coordenadas locais; frente = -Z.
   Escultura e alfaiataria são calculadas uma vez; a GPU deforma as junções do rig. */
(function (global) {
  'use strict';
  const TAU=Math.PI*2, sin=Math.sin, cos=Math.cos, clamp=(v,l=0,h=1)=>Math.min(h,Math.max(l,v)), lerp=(a,b,t)=>a+(b-a)*t;
  const sub=(a,b)=>a.map((x,i)=>x-b[i]), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], unit=a=>{const f=1/(Math.hypot(...a)||1);return a.map(n=>n*f);};
  const col=s=>[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255), tint=(a,k)=>a.map(v=>clamp(v*k)), blend=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],clamp(t)));
  const profiles={
    auditor:{coat:'263b64',lapel:'2c436e',shirt:'aac7e8',pants:'373b46',skin:'e6ad87',lip:'bc7a6e',hair:'3e2a26',strand:'56392d',iris:'6c4a30',leather:'22262d'},
    manager:{coat:'343d58',lapel:'414c69',shirt:'90b4da',pants:'383f4b',skin:'d7a182',lip:'ad756b',hair:'4b403b',strand:'887a71',iris:'60513c',leather:'3a302e'},
    worker:{coat:'e67d36',lapel:'f29242',shirt:'375077',pants:'2f435e',skin:'b37b58',lip:'945e51',hair:'332722',strand:'46312b',iris:'503928',leather:'55483c'}
  };
  const fabric=0, skin=1, hair=2, leather=3, metal=4, enamel=5, rubber=6, iris=7;
  const bones=['body','head','jaw','mouth','lip','teeth','thighL','shinL','footL','thighR','shinR','footR','armL','foreL','handL','armR','foreR','handR','tablet','eyelidL','eyelidR'];
  const boneIndex=Object.fromEntries(bones.map((name,index)=>[name,index]));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const headHeight=(y,role)=>2.84+(y-2.84)*(role==='manager'?1.08:1.04);
  const mouthHeight=2.724;
  function weights(name,p,u,v) {
    const y=p[1],side=name.at(-1);
    if(name.startsWith('eyelid'))return[boneIndex.head,boneIndex[name],(1-v)*Math.max(0,sin(Math.PI*u))**.48];
    if(name==='head')return[boneIndex.head,boneIndex.jaw,1-smooth(2.695,2.742,y)];
    if(name==='body')return[boneIndex.body,boneIndex.head,.92*smooth(2.55,2.66,y)];
    if(name.startsWith('thigh')){
      if(y>1.39)return[boneIndex[name],boneIndex.body,smooth(1.40,1.61,y)];
      return[boneIndex['shin'+side],boneIndex[name],smooth(.73,.92,y)];
    }
    if(name.startsWith('arm')){
      if(y>2.35)return[boneIndex[name],boneIndex.body,.65*smooth(2.35,2.49,y)];
      return[boneIndex['fore'+side],boneIndex[name],smooth(1.92,2.10,y)];
    }
    if(name.startsWith('hand'))return[boneIndex[name],boneIndex['fore'+side],smooth(1.565,1.626,y)];
    return[boneIndex[name],boneIndex[name],0];
  }
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
    bone(name){
      if(!this.chunks.has(name))this.chunks.set(name,{vertices:[],indices:[]});
      const chunk=this.chunks.get(name);this.out=chunk.vertices;this.indices=chunk.indices;this.name=name;
    }
    surface(fn,nu,nv,c,mat,flip=false,influence){
      const grid=[],ep=.00012;
      for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
        const u=i/nu,v=j/nv,p=fn(u,v),du=sub(fn(clamp(u+ep),v),fn(clamp(u-ep),v)),dv=sub(fn(u,clamp(v+ep)),fn(u,clamp(v-ep)));
        let n=unit(flip?cross(du,dv):cross(dv,du));if(Math.hypot(...n)<.5)n=[0,v>.5?1:-1,0];
        const color=typeof c==='function'?c(u,v,p):c;
        grid.push([...p,...n,...color,mat,0,...(influence?influence(p,u,v):weights(this.name,p,u,v)),u,v]);
      }
      const w=nu+1,offset=this.out.length/16;
      for(const vertex of grid)this.out.push(...vertex);
      for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
        const a=i+w*j,b=a+1,d=a+w,e=d+1;
        for(const k of (flip?[a,b,e,a,e,d]:[a,e,b,a,d,e]))this.indices.push(offset+k);
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
    loft(rows,c,mat,n=22,m=Math.max(10,rows.length*2),folds) {
      this.surface((u,v)=>{const a=u*TAU,y=lerp(rows[0][0],rows.at(-1)[0],v),[rx,rz,x,z]=sample(rows,y),r=folds?folds(a,y):0;return[x+sin(a)*(rx+r),y,z-cos(a)*(rz+r)];},n,m,c,mat);
    }
    implicit(bounds,step,field,color,material,side=1){
      const size=bounds.map(([a,b])=>Math.ceil((b-a)/step)+1),[nx,ny,nz]=size;
      const positions=[],values=new Float32Array(nx*ny*nz);
      const index=(x,y,z)=>x+nx*(y+ny*z);
      for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
        const p=[x,y,z].map((n,i)=>lerp(bounds[i][0],bounds[i][1],n/(size[i]-1)));
        const id=index(x,y,z);positions[id]=p;values[id]=field(p)+.000017;
      }
      const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
      const tetrahedra=[[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]];
      const cache=new Map(),epsilon=.00025;
      const edge=(a,b)=>{
        const key=Math.min(a,b)*values.length+Math.max(a,b);
        if(cache.has(key))return cache.get(key);
        const t=values[a]/(values[a]-values[b]),p=positions[a].map((v,i)=>lerp(v,positions[b][i],t));
        const n=unit([0,1,2].map(i=>{
          const hi=[...p],lo=[...p];hi[i]+=epsilon;lo[i]-=epsilon;
          return field(hi)-field(lo);
        }));
        p[0]*=side;n[0]*=side;
        const id=this.out.length/16,c=typeof color==='function'?color(p):color;
        this.out.push(...p,...n,...c,material,0,...weights(this.name,p,0,0),0,0);
        cache.set(key,id);return id;
      };
      const triangle=(a,b,c)=>{
        const p=id=>this.out.slice(id*16,id*16+3),n=id=>this.out.slice(id*16+3,id*16+6);
        const normal=cross(sub(p(b),p(a)),sub(p(c),p(a))),average=n(a).map((v,i)=>v+n(b)[i]+n(c)[i]);
        if(normal.reduce((sum,v,i)=>sum+v*average[i],0)<0)[b,c]=[c,b];
        this.indices.push(a,b,c);
      };
      for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
        const ids=corners.map(([dx,dy,dz])=>index(x+dx,y+dy,z+dz));
        for(const tetrahedron of tetrahedra){
          const inside=[],outside=[];
          for(const corner of tetrahedron)(values[ids[corner]]<0?inside:outside).push(ids[corner]);
          if(inside.length===0||inside.length===4)continue;
          if(inside.length===1||inside.length===3){
            const one=inside.length===1?inside:outside,many=inside.length===1?outside:inside;
            triangle(...many.map(id=>edge(one[0],id)));
          }else{
            const [a,b]=inside,[c,d]=outside,ac=edge(a,c),ad=edge(a,d),bc=edge(b,c),bd=edge(b,d);
            triangle(ac,ad,bd);triangle(ac,bd,bc);
          }
        }
      }
    }
    finish(role){
      let count=0,indexCount=0;
      for(const chunk of this.chunks.values()){count+=chunk.vertices.length;indexCount+=chunk.indices.length;}
      const data=new Float32Array(count),indices=count/16<65536?new Uint16Array(indexCount):new Uint32Array(indexCount),parts=[];
      let offset=0,indexOffset=0;
      for(const [bone,chunk] of this.chunks){
        const a=chunk.vertices;
        if(['head','mouth','lip','teeth','eyelidL','eyelidR'].includes(bone)){
          // Match the approved face length and aspect ratio from the original rig.
          const sx=role==='auditor'?.90:.94,sy=role==='manager'?1.08:1.04;
          for(let i=0;i<a.length;i+=16){
            a[i]*=sx;a[i+1]=headHeight(a[i+1],role);
            a[i+3]/=sx;a[i+4]/=sy;
          }
        }
        parts.push({bone,first:indexOffset,count:chunk.indices.length});data.set(a,offset);
        for(const index of chunk.indices)indices[indexOffset++]=index+offset/16;
        offset+=a.length;
      }
      return {data,indices,parts,stride:16,bones};
    }
  }
  const arch=(a,b,h,t)=>lerp(a,b,t)+sin(Math.PI*t)*h;
  const gauss=(x,y,cx,cy,wx,wy)=>Math.exp(-(((x-cx)/wx)**2+((y-cy)/wy)**2));
  function makeHead(m,P,role) {
    const manager=role==='manager',worker=role==='worker';
    // Asymmetric cranium, wide cheekbones, narrow chin and the brow, eye sockets, muzzle,
    // nose bridge/alae and chin sculpted into the face itself (no separate nose sphere).
    const rows=[[2.619,.027,.047,-.049],[2.65,.111,.115,-.036],[2.70,.159,.146,-.018],[2.77,.185,.159,-.002],[2.86,.194,.169,.005],[2.96,.187,.164,.010],[3.028,.151,.139,.019],[3.071,.082,.094,.023],[3.086,.004,.006,.025]];
    function shape(y){const [w,d,z]=sample(rows,y);return[w*(manager?1.065:worker?1.035:1),d,z];}
    const sc=(x,y)=>-.032*gauss(x,y,0,2.837,.024,.076)-.043*gauss(x,y,0,2.796,.029,.024)
      -.020*(gauss(x,y,.029,2.783,.015,.012)+gauss(x,y,-.029,2.783,.015,.012))
      -.015*gauss(x,y,0,2.732,.086,.034)-.018*gauss(x,y,0,2.670,.079,.027)
      -.025*gauss(Math.abs(x),y,.123,2.826,.048,.031)+.009*gauss(Math.abs(x),y,.139,2.768,.038,.028)+.012*gauss(Math.abs(x),y,.079,2.873,.044,.025)
      -.011*gauss(Math.abs(x),y,.080,2.902,.07,.019)
      +.005*gauss(Math.abs(x),y,.045+(2.78-y)*.52,2.755,.008,.033)
      -.0028*gauss(Math.abs(x),y,.010,2.756,.004,.013);
    function faceZ(x,y){const [w,d,z]=shape(y),q=Math.sqrt(clamp(1-(x/w)**2));return z-d*q+sc(x,y)*q*q;}
    function scalp(a,y){const [w,d,z]=shape(y),h=cos(a),x=w*sin(a);return[x,y,z-d*h+sc(x,y)*Math.max(0,h)**2];}
    m.bone('head');
    const blush=blend(P.skin,P.lip,.55),shadow=blend(P.lip,P.skin,.46);
    const faceAngle=u=>Math.atan2(.48*sin(u*TAU),cos(u*TAU));
    m.surface((u,v)=>scalp(faceAngle(u),lerp(rows[0][0],rows.at(-1)[0],v)),128,104,(u,v,p)=>{
      const f=Math.max(0,cos(faceAngle(u))),x=Math.abs(p[0]),y=p[1];
      let c=blend(P.skin,blush,f*(.27*gauss(x,y,.126,2.805,.049,.051)+.34*gauss(p[0],y,0,2.79,.043,.027)));
      c=blend(c,shadow,f*(.23*gauss(x,y,.080,2.887,.048,.012)+.15*gauss(x,y,.079,2.847,.045,.010)+.18*gauss(x,y,.033,2.777,.012,.007)));
      c=blend(c,tint(P.skin,.86),f*.20*gauss(p[0],y,0,2.697,.070,.009));
      if(manager&&y<2.763){
        const jaw=clamp((2.738-y)/.048),cheeks=smooth(.095,.15,x)*clamp((2.79-y)/.050);
        const g=clamp(Math.max(jaw,cheeks))*.77*clamp(f*2);
        const stubble=blend(col('786b60'),col('b7aa9b'),.34+.12*sin(u*620+v*831)**2);
        c=blend(c,stubble,g);
      }
      return c;
    },skin);
    for(const s of [-1,1]){
      const ex=s*(manager?.197:.186);
      m.ell(ex,2.815,.006,.030,.059,.028,P.skin,skin,22,15);
      m.ell(ex+s*.022,2.818,-.011,.009,.032,.018,blend(P.skin,P.lip,.38),skin,18,12);
      m.tube(t=>[ex+s*(.023+.006*sin(t*Math.PI)),2.785+.066*t,-.015+.013*sin(Math.PI*t)],t=>.003+.002*sin(Math.PI*t),P.skin,skin,20,7);
      m.ell(ex+s*.019,2.798,-.018,.008,.011,.009,tint(P.skin,.91),skin,14,8);
    }
    const eyeY=manager?2.865:2.87,eyeX=manager?.080:.077,ew=manager?.044:.043,top=manager?.018:.020,bot=manager?.011:.012;
    for(const s of [-1,1]){
      const X=s*eyeX,mid=k=>eyeY+.004*s*k,rad=k=>Math.max(0,1-k*k)**.77;
      function ez(x,y){const k=clamp((x-X)/ew,-1,1),r=rad(k),off=y-mid(k);return faceZ(x,y)-.003-.017*Math.max(0,1-k*k-(off/(off>=0?top:bot))**2);}
      m.surface((u,v)=>{const k=2*u-1,r=rad(k),x=X+ew*k,y=mid(k)+lerp(-bot,top,v)*r;return[x,y,ez(x,y)];},28,12,(u,v)=>blend(col('eee8dd'),col('d9b6a7'),.22*Math.abs(2*u-1)**4),enamel);
      const irisX=X-s*.002,irisY=eyeY+.003;
      function disk(cx,cy,rx,ry,color,lift,material=enamel){m.surface((u,v)=>{const a=u*TAU,r=.0001+v*.9999,x=cx+rx*sin(a)*r,y=cy+ry*cos(a)*r;
        const k=(x-X)/ew,yy=clamp(y,mid(k)-bot*rad(k)+.0002,mid(k)+top*rad(k)-.0002);return[x,yy,ez(x,yy)-lift];},material===iris?32:24,material===iris?8:4,color,material);}
      disk(irisX,irisY,.0192,.0198,col('3a3027'),.0009);
      disk(irisX,irisY,.0179,.0186,(u,v)=>blend(P.iris,col('a17b43'),.27+.19*sin(u*TAU*29+v*9)**2),.0015,iris);
      disk(irisX,irisY,.0080,.0090,col('191b20'),.0022);
      disk(irisX-.004,irisY+.0045,.0032,.0031,col('fff9e9'),.0029);
      disk(irisX+.005,irisY-.004,.0013,.0015,col('b8d2e3'),.0028);
      function lid(t,upper,shift=0){const k=t*2-1,x=X+k*ew,y=mid(k)+(upper?top:-bot)*rad(k)+shift;return[x,y,faceZ(x,y)-.004];}
      m.tube(t=>lid(t,true),t=>.0007+.0017*sin(Math.PI*t),blend(P.lip,P.hair,.65),skin,24,6);
      m.tube(t=>lid(t,false),t=>.0008+.0017*sin(Math.PI*t),blend(P.skin,P.lip,.41),skin,22,6);
      m.tube(t=>lid(t,true,.008),t=>.0003+.0010*sin(Math.PI*t),blend(P.skin,P.lip,.33),skin,22,5);
      m.bone('eyelid'+(s<0?'L':'R'));
      m.surface((u,v)=>{
        const k=2*u-1,x=X+ew*k,r=rad(k),y=mid(k)+top*r+v*.028*r;
        return[x,y,faceZ(x,y)-.004-.001*sin(Math.PI*v)];
      },26,9,P.skin,skin);
      m.bone('head');
      const brow=t=>{const x=s*(.027+t*.112),y=arch(2.907,2.897,manager?.008:.011,t)+(manager?.005*(1-t):.003*t);return[x,y,faceZ(x,y)-.004];};
      m.surface((u,v)=>{const p=brow(u),th=(.001+.0068*sin(Math.PI*(.12+.86*u)))*(1.05-.35*u),y=p[1]+(v-.48)*2*th;return[p[0],y,faceZ(p[0],y)-.002-.003*sin(Math.PI*v)];},24,6,P.hair,hair,s<0);
      for(let i=0;i<20;i++){
        const t=(i+.5)/20,q=brow(t),height=.002+.006*sin(Math.PI*t);
        m.tube(v=>{const x=q[0]+s*(v-.5)*.004,y=q[1]+(v-.5)*height;return[x,y,faceZ(x,y)-.0035];},.00025,blend(P.hair,P.strand,.16+.12*(i%3)/3),hair,3,4);
      }
      // Shallow, naturally dark nostrils just under the wings of the nose.
      m.surface((u,v)=>{const a=TAU*u,r=v*.999+.001,x=s*.025+r*.006*sin(a),y=2.778+.0017*r*cos(a)-s*(x-s*.025)*.16;
        return[x,y,faceZ(x,y)-.0006];},16,3,blend(P.lip,col('664537'),.4),skin);
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
        const x=s*(.001+.071*u),y=arch(2.758,2.746,.003,u)-v*(.005+.004*sin(Math.PI*u));
        return[x,y,faceZ(x,y)-.001-.002*sin(v*Math.PI)];},24,6,(u,v)=>blend(pepper,salt,.25+.11*sin(u*51+v*4)**2),hair,s>0);
    }
    const lipW=manager?.070:.071,seam=x=>mouthHeight+.001*(x/lipW)**2;
    function lips(part){m.bone(part==='bottom'?'lip':part==='inside'?'mouth':'head');m.surface((u,v)=>{
      const k=u*2-1,x=k*lipW,r=Math.max(0,1-k*k),base=seam(x);
      let y;if(part==='inside')y=base+lerp(-.027,.0005,v)*r;
      else if(part==='bottom')y=base-r*.010*(1-v);
      else y=base+r*v*(.007+.003*Math.exp(-((Math.abs(k)-.27)**2)/.033));
      const z=faceZ(x,y)-(part==='inside'?.002:.007+(part==='bottom'?.003:.002)*sin(Math.PI*v))*r;
      return[x,y,z];},32,8,part==='inside'?col('583637'):blend(P.skin,P.lip,part==='bottom'?.49:.44),skin,false,
        part==='upper'?()=>[boneIndex.head,boneIndex.head,0]:undefined);}
    lips('upper');lips('inside');lips('bottom');
    m.bone('teeth');m.surface((u,v)=>{
      const k=u*2-1,x=k*lipW*.85,r=1-k*k,y=seam(x)+lerp(-.007,-.001,v)*r;
      return[x,y,faceZ(x,y)-.004*r];
    },48,6,(u,v)=>{
      const edge=Math.abs(sin((u-.5)*Math.PI*8))**24;
      return blend(col('f1e5ce'),col('bca78d'),.13*edge+.10*(1-v));
    },enamel);
    for(const s of [-1,1]){
      m.bone('head');
      m.tube(t=>{const x=s*(lipW+.003*t),y=seam(s*lipW)-.001*t;return[x,y,faceZ(x,y)-.001];},t=>.0005*(1-t),blend(P.lip,P.skin,.45),skin,9,5);
    }
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
    const neckRows=[[2.49,.105,.103,0,.010],[2.52,.102,.102,0,.010],[2.59,.093,.097,0,.007],[2.66,.099,.100,0,-.004],[2.69,.105,.105,0,-.006]];
    m.loft(neckRows,tint(P.skin,.96),skin,24);
    function neckPoint(angle,y,clearance) {
      const [width,depth,x,z]=sample(neckRows,y);
      return [x+(width+clearance)*sin(angle),y,z-(depth+clearance)*cos(angle)];
    }
    const body=[[1.425,.280,.172,.018],[1.458,.327,.193,.018],[1.56,.342,.202,.012],[1.71,.307,.187,.007],[1.87,.291,.176,.012],[2.04,.310,.187,.013],[2.20,.349,.205,.006],[2.335,.370,.190,.010],[2.40,.375,.162,.018],[2.444,.334,.134,.02],[2.484,.220,.112,.014],[2.53,.126,.108,.010],[2.558,.099,.102,.007]];
    function cloth(a,y,off=0){
      const [w,d,z]=sample(body,y),h=cos(a);
      const dart=.0035*sin(a*5+y*15)*gauss(y,0,1.88,0,.18,1)*sin(a)**2;
      return[(w+off+dart)*sin(a),y,z-(d+off+dart)*h-.008*Math.max(0,h)*Math.exp(-((y-2.245)**2)/.019)*sin(a)**2];
    }
    function front(x,y,off=0){const [w]=sample(body,y),p=cloth(Math.asin(clamp(x/(w+off),-.995,.995)),y,off);p[0]=x;return p;}
    function sticker(bound,c,mat,lift=.005,n=10){
      m.surface((u,v)=>{const [x,y]=bound(u,v);return front(x,y,lift);},n,n,c,mat);
    }
    function quad(points,c,mat,off=.005){
      sticker((u,v)=>[0,1].map(j=>lerp(lerp(points[0][j],points[1][j],u),lerp(points[3][j],points[2][j],u),v)),c,mat,off,8);
    }
    function crease(path,r,c,mat,off=.009){m.tube(t=>{const [x,y]=path(t);return front(x,y,off);},r,c,mat,16,6);}
    function rivet(x,y,r,c,off=.009){const q=front(x,y,off);m.ell(q[0],q[1],q[2],r,r,.004,c,metal,10,5);}
    const edges=worker?[[1.56,.15],[1.72,.14],[2.26,.14],[2.40,.36],[2.55,.60]]:[[1.425,.46],[1.47,.37],[1.70,.18],[1.87,.015],[2,.13],[2.18,.32],[2.34,.45],[2.44,.66],[2.55,.89]];
    const ylo=edges[0][0],yhi=edges.at(-1)[0],gap=y=>sample(edges,y)[0];
    const collarOpening=.50;
    const neckline=angle=>2.525-.016*Math.max(0,cos(angle))**6;
    const collarBase=angle=>neckPoint(angle,neckline(angle),.007);
    const collarTop=angle=>neckPoint(angle,2.554-.010*Math.max(0,cos(angle))**4,.009);
    // The shirt, collar stand and folded collar share their joining edges.
    for(const side of [-1,1]) {
      m.surface((u,v)=>{
        const height=lerp(1.74,2.525,v);
        const opening=collarOpening*clamp((height-2.505)/.020);
        const angle=side*lerp(opening,gap(height)+.04,u);
        const y=height+(neckline(angle)-2.525)*v**10;
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
    const backHem=angle=>neckPoint(angle,2.502,.026);
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
      const a=[side*.045,2.544,-.103],b=[side*.110,2.532,-.055];
      const c=[side*.142,2.480,-.111],d=[side*.078,2.434,-.161];
      m.surface((u,v)=>{
        const p=a.map((value,i)=>lerp(lerp(value,b[i],u),lerp(d[i],c[i],u),v));
        p[2]-=.008*sin(Math.PI*v)*sin(Math.PI*u);
        return p;
      },18,18,tint(P.shirt,1.05),fabric,side>0);
      m.tube(t=>d.map((value,i)=>lerp(value,c[i],t)),.0009,tint(P.shirt,.88),fabric,24,5);
    }
    m.loft([[1.451,.243,.164,0,.004],[1.49,.306,.181,0,.003],[1.57,.318,.184,0,.003],[1.665,.295,.177,0,0],[1.733,.284,.170,0,0]],P.pants,fabric,30);
    const belt=worker?P.leather:col('614737');
    m.loft([[1.69,.29,.177,0,.001],[1.696,.298,.182,0,0],[1.744,.294,.179,0,0],[1.75,.287,.172,0,0]],belt,leather,36,8);
    for(const [a,b] of [[[-.041,1.699,-.188],[.041,1.699,-.188]],[[.041,1.699,-.188],[.041,1.739,-.188]],[[.041,1.739,-.188],[-.041,1.739,-.188]],[[-.041,1.739,-.188],[-.041,1.699,-.188]]])m.tube(t=>a.map((v,i)=>lerp(v,b[i],t)),.004,silver,metal,3,7);
    m.tube(t=>[0,lerp(1.705,1.735,t),-.190],.0025,silver,metal,3,7);
    const jacketSurface=(u,y)=>{
      const opening=gap(y),angle=lerp(opening,TAU-opening,u);
      return cloth(angle,y,.008);
    };
    m.surface((u,v)=>jacketSurface(u,lerp(ylo,2.34,v)),48,28,P.coat,fabric);
    m.surface((u,v)=>jacketSurface(u,lerp(2.34,yhi,v)),48,32,P.coat,fabric);
    if(!worker){
      m.tube(t=>cloth(Math.PI,lerp(1.445,2.43,t),.011),.0009,tint(P.coat,.83),fabric,42,5);
      for(const side of [-1,1])m.tube(t=>cloth(Math.PI+side*.43,lerp(1.45,1.69,t),.012),.0015,tint(P.coat,.74),fabric,17,5);
    }
    for(const s of [-1,1]){
      if(!worker){
        const lapel=[[1.875,.009,.018],[1.938,.029,.063],[2.13,.086,.150],[2.292,.135,.221],[2.359,.148,.235],[2.372,.148,.191],[2.411,.142,.213],[2.485,.115,.167],[2.543,.101,.126]];
        m.surface((u,v)=>{
          const y=lerp(lapel[0][0],lapel.at(-1)[0],v),[a,b]=sample(lapel,y),edge=cloth(gap(y),y,.008);
          const outer=Math.max(b,edge[0]+.012),x=s*lerp(a,outer,u),p=front(x,y,.015);
          p[2]-=.010*sin(Math.PI*u)*sin(Math.PI*v*.8);
          return p;
        },18,48,(u,v)=>blend(P.coat,P.lapel,.45+.35*sin(Math.PI*u)),fabric,s<0);
        m.tube(t=>{
          const y=lerp(lapel[0][0],lapel.at(-1)[0],t),[a]=sample(lapel,y);return front(s*(a+.003),y,.019);
        },.0008,tint(P.lapel,.91),fabric,40,5);
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
  const handForms=new Map();
  const fingerShapes=[
    {points:[[.456,1.497,-.101],[.458,1.454,-.105],[.451,1.411,-.110],[.444,1.382,-.107]],radii:[.0175,.0145,.013,.011]},
    {points:[[.456,1.500,-.072],[.458,1.455,-.074],[.450,1.402,-.078],[.443,1.365,-.075]],radii:[.018,.015,.0135,.0115]},
    {points:[[.456,1.496,-.043],[.458,1.452,-.042],[.451,1.410,-.044],[.444,1.377,-.041]],radii:[.017,.014,.0125,.0105]},
    {points:[[.456,1.482,-.014],[.458,1.447,-.010],[.452,1.418,-.009],[.446,1.398,-.006]],radii:[.0155,.013,.0115,.0095]}
  ];
  function handForm(carry){
    if(handForms.has(carry))return handForms.get(carry);
    const ellipsoid=(p,c,r)=>{
      const x=p[0]-c[0],y=p[1]-c[1],z=p[2]-c[2];
      const a=Math.hypot(x/r[0],y/r[1],z/r[2]),b=Math.hypot(x/(r[0]*r[0]),y/(r[1]*r[1]),z/(r[2]*r[2]));
      return b<.00001?-Math.min(...r):a*(a-1)/b;
    };
    const union=(a,b,k)=>{
      const h=clamp(.5+.5*(b-a)/k);return lerp(b,a,h)-k*h*(1-h);
    };
    const segments=[];
    const chain=(points,radii)=>{
      for(let i=0;i<points.length-1;i++){
        const a=points[i],d=sub(points[i+1],a);
        segments.push({a,d,l2:d.reduce((sum,v)=>sum+v*v,0),r:radii[i],dr:radii[i+1]-radii[i]});
      }
    };
    for(const finger of fingerShapes)chain(finger.points,finger.radii);
    if(carry){
      chain([[.435,1.55,-.096],[.437,1.578,-.114],[.405,1.615,-.120],[.380,1.598,-.119],[.376,1.568,-.112]],
        [.021,.018,.014,.012,.010]);
    }else{
      chain([[.435,1.548,-.099],[.421,1.522,-.116],[.418,1.490,-.131],[.428,1.466,-.127]],
        [.024,.020,.016,.013]);
    }
    const field=p=>{
      let distance=ellipsoid(p,[.455,1.515,-.056],[.039,.073,.064]);
      distance=union(distance,ellipsoid(p,[.453,1.595,-.050],[.044,.041,.052]),.012);
      distance=union(distance,ellipsoid(p,[carry?.442:.436,1.529,-.096],[.026,.041,.034]),.010);
      for(const segment of segments){
        const x=p[0]-segment.a[0],y=p[1]-segment.a[1],z=p[2]-segment.a[2];
        const t=clamp((x*segment.d[0]+y*segment.d[1]+z*segment.d[2])/segment.l2);
        const d=Math.hypot(x-t*segment.d[0],y-t*segment.d[1],z-t*segment.d[2])-segment.r-t*segment.dr;
        distance=union(distance,d,.006);
      }
      return distance;
    };
    const pattern=new Pattern();pattern.bone('handR');
    pattern.implicit([[.354,.520],[1.333,1.655],[-.158,.028]],.0086,field,[1,1,1],skin);
    const normalAt=p=>unit([0,1,2].map(axis=>{
      const hi=[...p],lo=[...p];hi[axis]+=.00025;lo[axis]-=.00025;return field(hi)-field(lo);
    }));
    const nail=(axis,sign,center,ry,width)=>{
      const columns=18,rows=6,base=pattern.out.length/16,epsilon=.0001;
      for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
        const angle=TAU*i/columns,r=epsilon+(1-epsilon)*j/rows,y=center.y+ry*cos(angle)*r,p=center.at(y);
        p[1]=y;p[axis===0?2:0]+=width*sin(angle)*r;
        let inner=p[axis],outer=axis===0?(sign>0?.525:.350):-.170;
        for(let k=0;k<15;k++){
          p[axis]=(inner+outer)*.5;
          if(field(p)>0)outer=p[axis];else inner=p[axis];
        }
        p[axis]=(inner+outer)*.5;const n=normalAt(p);
        const raised=p.map((v,k)=>v+n[k]*.00045);
        pattern.out.push(...raised,...n,1,1,1,enamel,0,...weights('handR',raised,0,0),i/columns,j/rows);
      }
      const emit=(a,b,c)=>{
        const p=id=>pattern.out.slice(id*16,id*16+3),n=pattern.out.slice(a*16+3,a*16+6);
        const face=cross(sub(p(b),p(a)),sub(p(c),p(a)));
        if(face.reduce((sum,v,i)=>sum+v*n[i],0)<0)[b,c]=[c,b];
        pattern.indices.push(a,b,c);
      };
      for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
        const a=base+i+(columns+1)*j,b=a+1,c=a+columns+1,d=c+1;
        emit(a,d,b);emit(a,c,d);
      }
    };
    const lineAtY=(a,b,y)=>a.map((v,i)=>lerp(v,b[i],clamp((a[1]-y)/(a[1]-b[1]))));
    for(const finger of fingerShapes){
      const tip=finger.points.at(-1),joint=finger.points.at(-2);
      nail(0,1,{y:tip[1]+.014,at:y=>lineAtY(joint,tip,y)},.010,.006);
    }
    if(carry)nail(0,-1,{y:1.580,at:y=>lineAtY([.380,1.598,-.119],[.376,1.568,-.112],y)},.008,.0058);
    else nail(2,-1,{y:1.479,at:y=>lineAtY([.418,1.490,-.131],[.428,1.466,-.127],y)},.009,.0065);
    const form=pattern.chunks.get('handR');handForms.set(carry,form);return form;
  }
  function makeHand(m,P,side,carry){
    m.bone('hand'+(side<0?'L':'R'));
    const form=handForm(carry),offset=m.out.length/16;
    // One watertight skin surface includes wrist, palm, finger webs and thumb.
    for(let i=0;i<form.vertices.length;i+=16){
      const p=[form.vertices[i]*side,form.vertices[i+1],form.vertices[i+2]],n=[form.vertices[i+3]*side,form.vertices[i+4],form.vertices[i+5]];
      const material=form.vertices[i+9],color=material===skin?P.skin:blend(P.skin,col('f2d6bb'),.42);
      m.out.push(...p,...n,...color,material,0,...weights(m.name,p,0,0),0,0);
    }
    for(let i=0;i<form.indices.length;i+=3){
      const [a,b,c]=form.indices.slice(i,i+3);
      m.indices.push(offset+a,offset+(side>0?b:c),offset+(side>0?c:b));
    }
  }
  function limbs(m,P,role) {
    const worker=role==='worker',silver=col('a4aeb9'),skinC=P.skin;
    for(const s of [-1,1]){
      const side=s<0?'L':'R';
      function loft(rows,c,material,n=22,v,folds){m.loft(rows.map(([y,w,d,x,z])=>[y,w,d,s*x,z]),c,material,n,v,folds);}
      m.bone('thigh'+side);
      // One continuous trouser leg, blended across hip and knee by the skinning rig.
      loft([[.177,.088,.102,.169,.018],[.203,.099,.115,.168,.012],[.235,.101,.119,.166,.006],[.278,.092,.110,.164,.013],[.36,.095,.118,.164,.014],[.53,.100,.124,.165,.022],[.69,.110,.128,.164,.012],[.81,.110,.122,.166,-.010],[.91,.116,.130,.167,-.012],[1.08,.123,.143,.164,-.004],[1.27,.143,.157,.155,0],[1.44,.155,.169,.151,.011],[1.54,.148,.160,.152,.011],[1.61,.108,.119,.15,.008]],P.pants,fabric,32,62,(a,y)=>
        .0038*sin(3*a+32*y)*Math.exp(-(((y-.81)/.11)**2))+.0032*sin(2*a-53*y)*Math.exp(-(((y-.24)/.065)**2))+.0035*Math.exp(-((Math.sin(a)/.15)**2)));
      m.bone('foot'+side);
      const sole=worker?col('403e39'):col('272930');
      loft([[.012,.095,.210,.165,-.067],[.020,.104,.222,.165,-.071],[.045,.105,.223,.165,-.071],[.062,.101,.215,.165,-.067]],sole,rubber,36,10);
      loft([[.053,.099,.212,.165,-.067],[.065,.104,.216,.165,-.068],[.082,.103,.212,.165,-.066],[.108,.099,.196,.165,-.061],[.138,.092,.163,.165,-.039],[.17,.084,.132,.166,-.014],[.200,.081,.105,.166,.011],[.223,.076,.088,.166,.014]],P.leather,leather,36,26);
      for(let i=0;i<5;i++){
        const y=.123+i*.014,z=-.184+i*.024;
        m.tube(t=>[s*.165+lerp(-.041,.041,t),y+.011*sin(Math.PI*t),z-.003*sin(Math.PI*t)],.0024,tint(P.leather,1.33),leather,12,5);
      }
      m.tube(t=>{const k=2*t-1;return[s*.165+k*.086,.091+.022*(1-k*k),-.229+.025*k*k];},.0011,tint(P.leather,1.38),leather,24,5);
      m.bone('arm'+side);
      const sleeve=worker?P.shirt:P.coat;
      if(worker){
        loft([[1.98,.092,.094,.429,.006],[2.015,.102,.106,.431,.009],[2.105,.105,.111,.422,.011],[2.258,.119,.128,.403,.014],[2.377,.120,.132,.369,.016],[2.431,.096,.105,.359,.016],[2.466,.047,.053,.348,.017],[2.473,.004,.005,.345,.017]],sleeve,fabric,30,30);
        loft([[1.596,.058,.062,.457,-.051],[1.74,.074,.082,.455,-.020],[1.88,.087,.096,.445,.002],[1.985,.087,.10,.432,.005],[2.042,.086,.096,.429,.005]],skinC,skin,28,28);
      }else{
        loft([[1.607,.073,.078,.454,-.054],[1.628,.079,.085,.453,-.052],[1.73,.082,.090,.452,-.038],[1.895,.091,.100,.44,-.003],[1.993,.096,.104,.430,.005],[2.105,.102,.110,.422,.011],[2.258,.114,.123,.403,.014],[2.377,.119,.131,.369,.016],[2.431,.096,.105,.359,.016],[2.466,.048,.054,.348,.017],[2.473,.004,.005,.345,.017]],sleeve,fabric,32,50,(a,y)=>.0038*sin(a*3+y*36)*Math.exp(-(((y-1.985)/.115)**2)));
        loft([[1.582,.067,.071,.456,-.055],[1.594,.071,.074,.456,-.055],[1.626,.073,.077,.454,-.051]],P.shirt,fabric,28,8);
        for(let k=0;k<4;k++)m.ell(s*(.530-k*.002),1.646+k*.020,-.042,.004,.006,.006,tint(P.coat,.73),metal,10,6);
      }
      makeHand(m,P,s,role==='auditor'&&s>0);
      if(!worker&&s<0){
        m.bone('fore'+side);
        loft([[1.576,.062,.069,.456,-.058],[1.59,.064,.07,.456,-.058],[1.607,.064,.07,.455,-.056]],P.leather,leather,18,5);
        m.ell(s*.514,1.595,-.062,.015,.027,.027,silver,metal,12,8);
        m.ell(s*.525,1.596,-.062,.009,.021,.021,col('394957'),metal,12,8);
      }
      if(role==='auditor'&&s>0){
        m.bone('tablet');
        // Original slim folio, carried vertically beside the thigh in the palm.
        const tx=.400,ty=1.368,tz=-.065;
        const shapes=[[0,.962],[.10,.989],[.24,1],[.76,1],[.91,.988],[1,.963]];
        const point=(a,r,x)=>{
          const yy=sin(a),zz=cos(a);
          return[x,ty+r*.218*Math.sign(yy)*Math.abs(yy)**.22,tz+r*.144*Math.sign(zz)*Math.abs(zz)**.22];
        };
        m.surface((u,v)=>point(u*TAU,sample(shapes,v)[0],tx+lerp(-.012,.012,v)),48,6,col('586372'),metal);
        for(const side of [-1,1])m.surface((u,v)=>point(u*TAU,.0001+v*.966,tx+side*.012),48,4,side>0?col('3b4656'):col('354054'),leather,side<0);
        m.ell(tx+.013,ty+.180,tz+.098,.004,.013,.013,col('202736'),metal,12,8);
      }
    }
  }
  const baked=new Map();
  function build(role='auditor'){
    if(!Object.hasOwn(profiles,role))role='auditor';
    if(!baked.has(role)){
      const m=new Pattern(),P=Object.fromEntries(Object.entries(profiles[role]).map(([k,v])=>[k,col(v)]));
      tailoring(m,P,role);limbs(m,P,role);makeHead(m,P,role);baked.set(role,m.finish(role));
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

  function pose(x,z,time=0,walking=false,role='auditor',dir=0,mouth=false,walkDistance,blinkClock=time){
    const roleOffset=role==='manager'?1.3:role==='worker'?2.7:0,t=time+roleOffset;
    const w=walking?1:0, breath=sin(t*1.65), answer=mouth?1:0;
    const cycle=(walkDistance ?? time*3.6)/strideDistance;
    const phase=cycle*TAU;
    const root=transform(x,0,z,0,dir),rig={};
    rig.body=joint(multiply(root,transform(0,.003*breath,0)),[0,1.66,0],0,-sin(phase)*.055*w,cos(phase)*.013*w);
    rig.head=joint(rig.body,[0,2.58,0],-.013*breath+.018*sin(t*5)*answer,.029*sin(t*.66)+.033*sin(t*2.5)*answer,.006*sin(t*.94));
    const vis=answer*(.4+.33*sin(t*19)+.20*sin(t*29+1)+.07*sin(t*42)),op=Math.max(0,vis);
    rig.jaw=joint(rig.head,[0,headHeight(2.785,role),.028],-.088*op);
    const reveal=smooth(.025,.18,op),level=headHeight(mouthHeight,role);
    const open=identity();open[5]=Math.max(.005,op);open[13]=level*(1-open[5]);open[14]=.010*(1-reveal);
    rig.mouth=multiply(rig.head,open);rig.lip=multiply(rig.jaw,transform(0,-.003*op,0));
    const teeth=identity();teeth[5]=.005+.995*reveal;teeth[13]=level*(1-teeth[5]);teeth[14]=.009*(1-reveal);
    rig.teeth=multiply(rig.head,teeth);
    for(const side of ['L','R']){
      // Use elapsed real time so the simulation's frame cap cannot slow blinking.
      const blinkTime=(blinkClock+roleOffset+1.8+(side==='R'?.012:0))%4;
      const blink=smooth(0,.075,blinkTime)*(1-smooth(.075,.205,blinkTime));
      rig['eyelid'+side]=multiply(rig.head,transform(0,-.033*blink,-.020*blink));
    }
    rig.tablet=rig.body;
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
          [.012,-.277],[.012,.143],[.020,-.293],
          [.020,.151],[.045,-.294],[.045,.152]
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
      rig['hand'+side]=rig['fore'+side];
      if(carry)rig.tablet=rig['hand'+side];
    }
    return rig;
  }
  global.SCAIPeople={build,pose,bones};
})(window);
