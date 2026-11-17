/* Galpão de expansão e porta de enrolar: geometria e limites compartilhados. */
(() => {
  'use strict';
  const layout={wallX:16.75,endX:96.75,halfWidth:27.67,centerZ:-20,height:10.8,floor:-.045,
    gateX:16.60,gateHalfWidth:1.59,gateHeight:3.60,slats:14,personClearance:3.24,
    panels:[{x:16.43,z:3.07,side:-1},{x:17.07,z:3.07,side:1}],
    cameraRoom:{min:[-12.54,.12,-47.43],max:[96.61,10.52,7.49]},farClip:260,panoramaRadius:140};
  // The west wall has a real opening. Both wings close the entire larger hall.
  layout.minZ=layout.centerZ-layout.halfWidth;layout.maxZ=layout.centerZ+layout.halfWidth;
  const wings=[[layout.minZ,-layout.gateHalfWidth],[layout.gateHalfWidth,layout.maxZ]].map(([min,max])=>({z:(min+max)/2,half:(max-min)/2}));
  const walls=[
    ...wings.map(wing=>({x:layout.wallX,z:wing.z,hx:.10,hz:wing.half,top:layout.height})),
    {x:2.035,z:-7.52,hx:14.575,hz:.01,top:6.18},
    {x:2.035,z:7.58,hx:14.575,hz:.01,top:6.18}
  ];
  const cameraWalls=[...walls,
    {x:layout.wallX,z:0,hx:.10,hz:layout.gateHalfWidth,bottom:layout.floor+layout.gateHeight,top:layout.height},
    {x:2.035,z:0,hx:14.575,hz:7.49,bottom:6.02,top:10.8}];
  function walkInside(x,z){
    return x>=-12.05&&((x<=layout.wallX&&z>=-7.08&&z<=7.04)||
      (x>=layout.wallX&&x<=layout.endX-.55&&z>=layout.minZ+.59&&z<=layout.maxZ-.63));
  }
  const canPass=open=>open*layout.gateHeight>=layout.personClearance;
  function slatPositions(open){
    const pitch=layout.gateHeight/layout.slats,lift=Math.max(0,Math.min(1,open))*layout.gateHeight,result=[];
    for(let i=0;i<layout.slats;i++){
      const bottom=layout.floor+i*pitch+lift,top=Math.min(layout.floor+layout.gateHeight,bottom+pitch+.006);
      if(top>bottom+.00001)result.push({index:i,y:(top+bottom)/2,height:top-bottom});
    }
    return result;
  }
  const color=(s,material)=>Object.assign([0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255),{material});
  function build(mesh){
    const p={floor:color('aeb1b5',6),seam:color('989b9e',6),roof:color('d6dce1',5),steel:color('506276',5),
      silver:color('bdc3c7',5),deep:color('273644',5),blue:color('2b5884',5),lamp:color('fff0d2',10),
      panel:color('d8d5cb',5),paper:color('f0ece3',8),red:color('be4d43',5),green:color('52743d',5),frost:color('b3cdd4',9)};
    const B=(...args)=>mesh.box(...args),R=(...args)=>mesh.bevelBox(...args),T=(...args)=>mesh.tube(...args);
    const {wallX,endX,halfWidth,centerZ,height,floor,gateHeight,gateHalfWidth}=layout,cx=(wallX+endX)/2,length=endX-wallX;
    B(cx+.025,-.165,centerZ,length-.05,.24,halfWidth*2,p.floor);
    // A recessed concrete footing bridges the floor/wall seam without coplanar faces.
    B(wallX+.05,floor-.103,centerZ,.70,.20,halfWidth*2+.20,p.floor);
    for(const wing of wings){
      B(wallX,height/2,wing.z,.20,height,wing.half*2,p.roof);
      B(wallX+.12,.105,wing.z,.10,.33,wing.half*2,p.steel);
      B(wallX-.12,.105,wing.z,.10,.33,wing.half*2,p.steel);
    }
    for(let x=wallX+.32;x<endX;x+=4.27)B(x,floor+.002,centerZ,.014,.003,halfWidth*2,p.seam);
    for(let z=-halfWidth+1;z<halfWidth;z+=3.95)B(cx,floor+.002,z+centerZ,length,.003,.012,p.seam);
    for(const side of [-1,1]){
      B(cx,height/2,centerZ+side*halfWidth,length,height,.20,p.roof);
      B(cx,.197,centerZ+side*(halfWidth-.125),length,.408,.047,p.steel);
      for(let x=wallX+.6;x<endX;x+=1.115)B(x,height/2,centerZ+side*(halfWidth-.115),.014,height-.12,.026,p.silver);
      for(const y of [.49,4.56,8.9])B(cx,y,centerZ+side*(halfWidth-.14),length,.065,.031,p.steel);
    }
    B(wallX,(height+floor+gateHeight)/2,0,.20,height-floor-gateHeight,gateHalfWidth*2,p.roof);
    B(endX,height/2,centerZ,.20,height,halfWidth*2,p.roof);
    B(endX-.125,.197,centerZ,.047,.408,halfWidth*2,p.steel);
    for(let z=-halfWidth+.5;z<halfWidth;z+=1.115)B(endX-.115,height/2,z+centerZ,.026,height-.12,.014,p.silver);
    B(cx,height+.13,centerZ,length,.26,halfWidth*2,p.roof);
    for(let z=-halfWidth+.3;z<halfWidth;z+=.77)B(cx,height-.02,z+centerZ,length,.035,.018,p.silver);
    // Wall-mounted columns and overhead trusses leave the entire floor unobstructed.
    for(let x=wallX+1.7;x<endX;x+=9.7){
      B(x,height-.28,centerZ,.16,.32,halfWidth*2-.35,p.steel);
      B(x,height-1.13,centerZ,.16,.12,halfWidth*2-.35,p.steel);
      for(let z=-halfWidth+.25;z<halfWidth-.25;z+=4.9){
        const next=Math.min(z+4.9,halfWidth-.25);
        T([x,height-1.13,z+centerZ],[x,height-.28,next+centerZ],.043,p.steel,6);
        T([x,height-.28,z+centerZ],[x,height-1.13,next+centerZ],.043,p.steel,6);
      }
      for(const side of [-1,1]){
        B(x,height/2,centerZ+side*(halfWidth-.16),.22,height,.20,p.steel);
        T([x,height-2,centerZ+side*(halfWidth-.27)],[x,height-1.13,centerZ+side*(halfWidth-1.7)],.06,p.steel,6);
      }
      for(const z of [-18,0,18]){
        T([x,height-.3,z+centerZ],[x,height-1.5,z+centerZ],.015,p.steel,6);
        R(x,height-1.53,z+centerZ,1.7,.10,.65,p.deep,.018);
        R(x,height-1.59,z+centerZ,1.6,.025,.56,p.lamp,.008);
      }
    }
    // A closed cassette conceals the slats as they roll up, without crossing the roof.
    for(const x of [16.51,16.99]){
      for(const z of [-1.67,1.67])R(x,1.83,z,.12,3.75,.12,p.deep,.016);
      R(x,3.77,0,.32,.43,3.54,p.blue,.034);
    }
    return ()=>{for(const panel of layout.panels)mesh.object('shutter-control:'+panel.side,()=>{
      const back=panel.x-panel.side*.09;
      R(back,1.98,panel.z,.13,.83,.56,p.panel,.025);
      B(panel.x-panel.side*.022,1.99,panel.z,.025,.61,.43,p.paper);
      for(const [i,y] of [1.77,1.91,2.05].entries())mesh.sphere(panel.x,y,panel.z+.07,.014,.038,.038,i===2?p.red:p.green,10,6);
    });};
  }
  function buildSlat(){
    const mesh=new window.SCAIMesh(),pitch=layout.gateHeight/layout.slats+.006;
    mesh.bevelBox(layout.gateX,0,0,.058,pitch,layout.gateHalfWidth*2,color('bdc3c7',5),.008);
    mesh.box(layout.gateX-.034,pitch/2-.016,0,.008,.014,layout.gateHalfWidth*2-.025,color('80909e',5));
    mesh.box(layout.gateX+.034,pitch/2-.016,0,.008,.014,layout.gateHalfWidth*2-.025,color('80909e',5));
    return mesh;
  }
  window.SCAIWarehouse={layout,walls,cameraWalls,walkInside,canPass,slatPositions,build,buildSlat};
})();
