/* Iluminação do interior em WebGL 1. O mobiliário projeta sombras pré-calculadas. */
(() => {
  'use strict';
  function link(gl, vertex, fragment) {
    const program=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    return program;
  }
  const shadowProjection=`
    vec2 lightUV(vec3 p){ return (p.xz-p.y*vec2(-.47,.40)-vec2(1.,0.))/vec2(40.,24.)+.5; }
  `;
  const vert=`
    attribute vec3 aPosition,aNormal,aColor;
    attribute vec2 aUv;
    attribute float aMaterial;
    uniform mat4 uModel,uVP;
    uniform bool uActor;
    varying vec3 world,normal,color;
    varying vec2 uv;
    varying float material;
    void main(){
      world=(uModel*vec4(aPosition,1.)).xyz;
      normal=mat3(uModel)*aNormal;
      color=aColor;
      material=uActor ? 20.+aUv.x : aMaterial;
      uv=uActor ? vec2(aPosition.x+aPosition.z*.65,aPosition.y)*1.5 : aUv;
      gl_Position=uVP*vec4(world,1.);
    }`;
  const frag=`
    precision highp float;
    uniform sampler2D uAtlas,uGraphics,uShadow;
    uniform bool uShadowReady;
    uniform vec3 uEye;
    uniform vec2 uPlayer;
    varying vec3 world,normal,color;
    varying vec2 uv;
    varying float material;
    ${shadowProjection}
    float visibility(vec3 n){
      if(!uShadowReady)return 1.;
      vec2 base=lightUV(world);
      float visible=0., bias=.032+.045*(1.-max(n.y,0.));
      float blocker=texture2D(uShadow,base).r*9.;
      float spread=mix(.0008,.0036,clamp((blocker-world.y)*.65,0.,1.));
      for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
        float h=texture2D(uShadow,base+vec2(float(i),float(j))*spread).r*9.;
        visible+=smoothstep(h-bias-.035,h-bias,world.y);
      }
      return visible/9.;
    }
    float footprint(vec2 center){
      vec2 diff=(world.xz-center)/vec2(.53,.35);
      return exp(-dot(diff,diff)*1.9);
    }
    vec3 finish(float tile, vec2 coord){
      vec2 index=vec2(mod(tile,4.),floor(tile*.25));
      // Mirrored repeats preserve continuous grain without an edge between samples.
      vec2 f=1.-abs(mod(coord,2.)-1.);
      vec3 sampleColor=texture2D(uAtlas,(index+.015+.97*f)/vec2(4.,2.)).rgb;
      vec3 mean=vec3(.83,.79,.72);
      if(tile<.5)mean=vec3(.58,.335,.17);
      else if(tile<1.5)mean=vec3(.86,.80,.70);
      else if(tile<2.5)mean=vec3(.085,.125,.2);
      else if(tile<3.5)mean=vec3(.18,.17,.16);
      else if(tile<4.5)mean=vec3(.76,.59,.40);
      else if(tile<5.5)mean=vec3(.72);
      else if(tile<6.5)mean=vec3(.57,.56,.54);
      else mean=vec3(.94,.90,.82);
      return clamp(sampleColor/mean,.54,1.65);
    }
    void main(){
      float m=floor(material+.5);
      bool actor=m>=20., skin=m==21., hair=m==22., windowPane=m==14.;
      if(m==15.){
        float r2=dot(uv,uv);
        gl_FragColor=vec4(.12,.10,.13,color.x*pow(max(1.-r2,0.),2.));
        return;
      }
      vec3 base=color;
      if(m>=12. && m<=14.) base=texture2D(uGraphics,uv).rgb;
      if(windowPane){ gl_FragColor=vec4(base*.97+vec3(.022,.027,.035),1.);return; }
      if(m<8. || m==20. || m==23.) {
        float tile=m==20.?2.:(m==23.?3.:m);
        float scale=tile==0.?.56:(tile==2.||tile==3.?2.6:.65);
        float strength=tile==0.?.42:(tile==1.?.23:(tile==2.||tile==3.?.13:.20));
        base*=mix(vec3(1.),finish(tile,uv*scale),strength);
      }
      vec3 n=normalize(normal),v=normalize(uEye-world);
      vec3 key=normalize(vec3(-.47,1.,.40));
      // Cool window light and warm light from the meeting room's recessed ceiling.
      float office=1.-smoothstep(-1.,1.4,world.x);
      float ceiling=.5+.5*n.y;
      float broad=clamp((dot(n,key)+.20)/1.2,0.,1.);
      float vis=visibility(n);
      float ao=1.;
      if(n.y>.5 && world.y<.11){
        float floorEdges=min(min(world.x+12.72,16.75-world.x),7.63-abs(world.z));
        ao-=.18*exp(-max(floorEdges,0.)*2.6);
        ao-=.28*max(footprint(uPlayer),max(footprint(vec2(-10.7,-5.2)),footprint(vec2(3.3,-2.25))));
      }
      vec3 ambient=mix(vec3(.43,.43,.46),vec3(.66,.71,.79),ceiling);
      vec3 lit=base*(ambient*ao + broad*mix(.11,.36,vis)*vec3(1.12,1.,.87));
      vec3 side=normalize(vec3(.8,.27,-.52));
      float bounce=max(0.,dot(n,side));
      lit+=base*(.09+.09*office)*vec3(1.,.77,.57)*bounce;
      if(skin)lit+=base*vec3(.15,.075,.047)*(1.-broad);
      bool metal=m==5.||m==24., glazed=m==9., leather=m==3.||m==23.;
      float spec=metal?.43:(glazed?.38:(leather||hair?.17:(skin?.105:.055)));
      vec3 h=normalize(key+v);
      lit+=spec*pow(max(dot(n,h),0.),metal?42.:(glazed?64.:24.))*mix(.35,1.,vis)*vec3(1.,.93,.82);
      float rim=pow(1.-clamp(dot(n,v),0.,1.),3.);
      lit+=rim*(metal||glazed?.19:(actor?.074:.031))*vec3(.76,.87,1.);
      // Broad ceiling spots on the meeting-room wood wall.
      if(world.z<-7.1 && office>.5){
        float along=abs(mod(world.x+.55,2.1)-1.05);
        float drop=max(0.,5.25-world.y);
        lit+=base*vec3(.35,.19,.078)*exp(-along*along/(.08+.14*drop))*exp(-drop*.37);
      }
      if(m==10.)lit=base*1.08+vec3(.055,.041,.025);
      if(m==13.)lit=mix(lit,base*1.025,.75);
      gl_FragColor=vec4(mix(lit,vec3(.78,.83,.88),smoothstep(13.,37.,distance(world,uEye))*.25),1.);
    }`;
  function makeShadowMap(gl,buffer,start,count) {
    const size=Math.min(1536,gl.getParameter(gl.MAX_TEXTURE_SIZE)), texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    for(const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,param,gl.NEAREST);
    for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);
    const frame=gl.createFramebuffer(),depth=gl.createRenderbuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,frame); gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,size,size);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    const ready=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    if(ready && count>start){
      const program=link(gl,`attribute vec3 p; varying float h; ${shadowProjection}
        void main(){h=clamp(p.y/9.,0.,1.); gl_Position=vec4(lightUV(p)*2.-1.,1.-2.*h,1.);}`,
        'precision mediump float; varying float h; void main(){gl_FragColor=vec4(vec3(h),1.);}');
      const attribute=gl.getAttribLocation(program,'p');
      gl.useProgram(program); gl.viewport(0,0,size,size); gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute,3,gl.FLOAT,false,48,0);
      gl.drawArrays(gl.TRIANGLES,start,count-start);
      gl.disableVertexAttribArray(attribute); gl.deleteProgram(program);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(frame);gl.deleteRenderbuffer(depth);
    return {texture,ready:ready && count>start};
  }
  window.SCAILighting={program:gl=>link(gl,vert,frag),makeShadowMap};
})();
