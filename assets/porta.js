/* Porta dupla da Aurora: vidro sem refração ou reflexos em tempo real. */
(() => {
  'use strict';
  const color=(hex,material)=>Object.assign([0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255),{material});
  const bounds=(meshes)=>{
    const result={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(const {mesh,first=0,count=mesh.length/12-first} of meshes){
      const data=mesh.v;
      for(let vertex=first;vertex<first+count;vertex++)for(let axis=0;axis<3;axis++){
        result.min[axis]=Math.min(result.min[axis],data[vertex*12+axis]);
        result.max[axis]=Math.max(result.max[axis],data[vertex*12+axis]);
      }
    }
    return result;
  };
  function build(){
    const finish=window.SCAILighting.glass;
    const graphite=color('344858',5),edge=color('8099a6',5),glass=color(finish.tint,finish.material);
    const frost=color('c4d7dd',8),label=color('31506a',8),light=color('f5d297',10);
    const fixed=new SCAIMesh(),frameParts=[];
    const frame=(id,draw)=>{
      const first=fixed.length/12;draw();const count=fixed.length/12-first;
      frameParts.push({id,first,count,...bounds([{mesh:fixed,first,count}])});
    };
    // The operator and both guide rails stay above the walking/head volume.
    frame('frame:header',()=>{
      fixed.bevelBox(.12,5.055,0,.29,.19,5.46,graphite,.027);
      fixed.box(-.032,5.011,0,.025,.025,5.31,edge);
      for(const side of [-1,1])fixed.box(.225,4.995,side*2.09,.012,.027,.44,light);
    });
    for(const side of [-1,1])frame(`frame:post:${side}`,()=>{
      fixed.bevelBox(.12,2.54,side*2.635,.19,5.0,.12,graphite,.018);
    });
    const leaves=[];
    for(const side of [-1,1]){
      const opaque=new SCAIMesh(),pane=new SCAIMesh(),z=side*1.30;
      // Narrow continuous stiles, top/bottom edge profiles, no floor threshold.
      for(const dz of [-1.266,1.266])opaque.bevelBox(.13,2.50,z+dz,.083,4.88,.053,graphite,.012);
      for(const y of [.087,4.913])opaque.bevelBox(.13,y,z,.084,.055,2.57,graphite,.012);
      for(const y of [1.47,1.65]){
        opaque.box(.131,y,z,.018,.095,2.47,frost);
        // Small navy squares interrupt the frosted bands without relying on text.
        for(const dz of [-.74,0,.74])opaque.box(.147,y,z+dz,.018,.036,.055,label);
      }
      const handleZ=side*.19;
      for(const x of [.025,.235]){
        for(const y of [1.94,2.53])opaque.tube([.13,y,handleZ],[x,y,handleZ],.021,edge,8);
        opaque.tube([x,1.94,handleZ],[x,2.53,handleZ],.027,edge,10);
      }
      // A single two-sided pane per leaf keeps transparent overdraw minimal.
      pane.quad([.13,.114,z-1.237],[.13,.114,z+1.237],[.13,4.885,z+1.237],[.13,4.885,z-1.237],glass);
      leaves.push({id:`leaf:${side}`,side,opaque,glass:pane,bounds:bounds([{mesh:opaque},{mesh:pane}])});
    }
    return {fixed,frameParts,leaves};
  }
  window.SCAIDoor={build};
})();
