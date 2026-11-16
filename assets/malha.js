/* Malha intercalada: posição, normal, cor, UV e índice do material. */
(() => {
  'use strict';
  const unit = a => {
    const length = Math.hypot(...a) || 1;
    return a.map(x => x / length);
  };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const minus = (a,b) => a.map((v,i) => v-b[i]);
  const order = [0,1,2,0,2,3];
  class Mesh {
    constructor() {
      this.storage = new Float32Array(12288);
      this.length = 0;
      this.shadows = [];
      this.propsStart = 0;
      this.cameraObjects = [];
      this.activeObject = null;
    }
    get v() { return this.storage.subarray(0,this.length); }
    beginProps() { this.propsStart = this.length / 12; }
    object(id,draw) {
      const previous=this.activeObject, start=this.length/12;
      const object={id,ranges:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
      this.cameraObjects.push(object);this.activeObject=object;
      draw();
      const end=this.length/12;
      // Nested objects own their triangles (a chair remains independent of its desk).
      const children=this.cameraObjects.filter(item=>item!==object&&item.first>=start&&item.last<=end);
      let cursor=start;
      for(const child of children.filter(item=>item.parent===object)){
        if(child.first>cursor)object.ranges.push({first:cursor,count:child.first-cursor});
        cursor=child.last;
      }
      if(cursor<end)object.ranges.push({first:cursor,count:end-cursor});
      Object.assign(object,{first:start,last:end,parent:previous});
      this.activeObject=previous;
      return this;
    }
    vertex(p,n,c,uv,material = c.material ?? 8) {
      if (this.length + 12 > this.storage.length) {
        const larger = new Float32Array(this.storage.length * 2);
        larger.set(this.storage);
        this.storage = larger;
      }
      const d=this.storage, i=this.length;
      if(this.activeObject)for(let axis=0;axis<3;axis++){
        this.activeObject.min[axis]=Math.min(this.activeObject.min[axis],p[axis]);
        this.activeObject.max[axis]=Math.max(this.activeObject.max[axis],p[axis]);
      }
      d[i]=p[0]; d[i+1]=p[1]; d[i+2]=p[2];
      d[i+3]=n[0]; d[i+4]=n[1]; d[i+5]=n[2];
      d[i+6]=c[0]; d[i+7]=c[1]; d[i+8]=c[2];
      if (!uv) {
        const top=Math.abs(n[1])>.62, side=Math.abs(n[0])>.66;
        uv=top ? [p[0],p[2]] : [side?p[2]:p[0],p[1]];
      }
      d[i+9]=uv[0]; d[i+10]=uv[1]; d[i+11]=material;
      this.length+=12;
    }
    tri(a,b,c,col) {
      const n=unit(cross(minus(b,a),minus(c,a)));
      for(const p of [a,b,c]) this.vertex(p,n,col);
      return this;
    }
    quad(a,b,c,d,col) {
      this.tri(a,b,c,col); this.tri(a,c,d,col);
      return this;
    }
    surface(sample, columns, rows, color) {
      const vertices = [];
      const delta = .001;
      for (let row = 0; row <= rows; row++) {
        for (let column = 0; column <= columns; column++) {
          const u = column / columns;
          const v = row / rows;
          const point = sample(u, v);
          const du = minus(sample(Math.min(1, u + delta), v), sample(Math.max(0, u - delta), v));
          const dv = minus(sample(u, Math.min(1, v + delta)), sample(u, Math.max(0, v - delta)));
          vertices.push([point, unit(cross(du, dv)), [u, v]]);
        }
      }
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const a = row * (columns + 1) + column;
          const corners = [a, a + 1, a + columns + 2, a + columns + 1];
          for (const corner of order) {
            const [position, normal, uv] = vertices[corners[corner]];
            this.vertex(position, normal, color, uv);
          }
        }
      }
      return this;
    }
    box(x,y,z,w,h,d,col,rot=0) { return this.bevelBox(x,y,z,w,h,d,col,0,rot); }
    bevelBox(x,y,z,w,h,d,col,radius,rot=0) {
      const half=[w/2,h/2,d/2], cs=Math.cos(rot), sn=Math.sin(rot);
      const r=Math.min(Math.max(0,radius),...half.map(v=>v*.98));
      const rotate = p => [p[0]*cs-p[2]*sn,p[1],p[0]*sn+p[2]*cs];
      const coords = size => r ? [-size,-size+r,size-r,size] : [-size,size];
      for(let axis=0;axis<3;axis++) for(const side of [-1,1]) {
        const u=(axis+1)%3, v=(axis+2)%3, us=coords(half[u]), vs=coords(half[v]);
        const verts=[];
        for(const a of us) for(const b of vs) {
          const p=[0,0,0]; p[axis]=side*half[axis]; p[u]=a; p[v]=b;
          let normal=[0,0,0]; normal[axis]=side;
          if(r) {
            const inner=p.map((q,i)=>Math.max(-half[i]+r,Math.min(half[i]-r,q)));
            normal=unit(minus(p,inner));
            for(let i=0;i<3;i++) p[i]=inner[i]+r*normal[i];
          }
          const q=rotate(p);
          const uv=axis===1?[p[0],p[2]]:[axis===0?p[2]:p[0],p[1]];
          verts.push([[q[0]+x,q[1]+y,q[2]+z],rotate(normal),uv]);
        }
        for(let i=0;i<us.length-1;i++) for(let j=0;j<vs.length-1;j++) {
          const a=i*vs.length+j, ids=[a,a+vs.length,a+vs.length+1,a+1];
          for(const k of order) {
            const [p,n,uv]=verts[ids[k]];
            this.vertex(p,n,col,uv);
          }
        }
      }
      return this;
    }
    tube(a,b,r,col,segments=12) {
      const axis=unit(minus(b,a)), u=unit(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])), v=cross(axis,u);
      const section = i => {
        const t=2*Math.PI*i/segments, n=u.map((q,k)=>q*Math.cos(t)+v[k]*Math.sin(t));
        return {n,lo:a.map((q,k)=>q+r*n[k]),hi:b.map((q,k)=>q+r*n[k])};
      };
      let prev=section(0);
      for(let i=1;i<=segments;i++) {
        const next=section(i);
        const strip=[[prev.lo,prev.n],[next.lo,next.n],[next.hi,next.n],[prev.hi,prev.n]];
        for(const k of order)this.vertex(strip[k][0],strip[k][1],col);
        for(const p of [b,prev.hi,next.hi])this.vertex(p,axis,col);
        const neg=axis.map(n=>-n);
        for(const p of [a,next.lo,prev.lo])this.vertex(p,neg,col);
        prev=next;
      }
      return this;
    }
    cylinder(x,y,z,r,h,col,segments=16) {
      return this.tube([x,y-h/2,z],[x,y+h/2,z],r,col,segments);
    }
    sphere(x,y,z,rx,ry,rz,col,segments=16,rings=10,rot=0) {
      const cs=Math.cos(rot), sn=Math.sin(rot);
      const verts=[];
      for(let i=0;i<=rings;i++)for(let j=0;j<=segments;j++){
        const t=Math.PI*(i/rings-.5), a=2*Math.PI*j/segments;
        const q=[Math.cos(t)*Math.cos(a),Math.sin(t),Math.cos(t)*Math.sin(a)];
        const n=unit([q[0]/rx,q[1]/ry,q[2]/rz]);
        verts.push([[x+q[0]*rx*cs-q[2]*rz*sn,y+q[1]*ry,z+q[0]*rx*sn+q[2]*rz*cs],
          [n[0]*cs-n[2]*sn,n[1],n[0]*sn+n[2]*cs],[j/segments,i/rings]]);
      }
      for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){
        const a=i*(segments+1)+j, ids=[a,a+1,a+segments+2,a+segments+1];
        for(const k of order){const [p,n,uv]=verts[ids[k]];this.vertex(p,n,col,uv);}
      }
      return this;
    }
    sign(center,right,up,key) {
      const [l,t,r,b]=window.SCAIGraphics.uv(key), n=unit(cross(right,up));
      const uv=[[l,b],[r,b],[r,t],[l,t]], corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
      const material=key==='window'?14:['dashboard','workstation'].includes(key)?13:12;
      for(const k of order){
        const p=center.map((v,i)=>v+right[i]*corners[k][0]+up[i]*corners[k][1]);
        this.vertex(p,n,[1,1,1],uv[k],material);
      }
      return this;
    }
    shadow(x,z,rx,rz,opacity=.2,y=.009) { this.shadows.push([x,z,rx,rz,opacity,y]); }
    objectiveMarker(x,z,color,y) {
      this.cylinder(x,y+.018,z,.4,.036,[.115,.16,.21],32);
      this.cylinder(x,y+.041,z,.36,.016,color,32);
      this.cylinder(x,y+.052,z,.26,.008,[.95,.94,.89],32);
      this.cylinder(x,y+.06,z,.222,.01,color,32);
      return this;
    }
  }
  window.SCAIMesh=Mesh;
})();
