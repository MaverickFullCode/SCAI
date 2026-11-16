(() => {
  'use strict';
  const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);

  class Renderer {
    constructor(gl, colors) {
      this.gl=gl;
      this.colors=colors;
      this.program=SCAILighting.program(gl);
      this.attr={};
      this.uniform={};
      for(const name of ['Position','Normal','Color','Uv','Material','Skin','Detail']){
        this.attr[name]=gl.getAttribLocation(this.program,'a'+name);
      }
      for(const name of ['Model','VP','Eye','Atlas','Graphics','Shadow','ShadowReady','Actor','Player','Bones[0]','People','PeopleReady']){
        this.uniform[name]=gl.getUniformLocation(this.program,'u'+name);
      }
      const mesh=new SCAIMesh();
      SCAIWorld.build(mesh,colors);
      this.world=this.buffer(mesh.v,12);
      this.shadow=SCAILighting.makeShadowMap(gl,this.world.buffer,mesh.propsStart,this.world.count);
      this.contacts=this.makeContacts(mesh.shadows);
      this.actors={};
      for(const role of ['auditor','manager','worker']){
        const model=SCAIPeople.build(role);
        this.actors[role]={geometry:this.buffer(model.data,model.stride,model.indices),bones:model.bones};
      }
      this.boneMatrices=new Float32Array(SCAIPeople.bones.length*16);
      gl.useProgram(this.program);
      this.materialTexture=this.texture(0);
      this.graphicsTexture=this.texture(1);
      this.uploadImage(1,this.graphicsTexture,SCAIGraphics.createAtlas());
      SCAIGraphics.ready.then(canvas=>this.uploadImage(1,this.graphicsTexture,canvas));
      const surfaces=window.SCAIMaterials;
      if(surfaces.complete && surfaces.naturalWidth) this.uploadImage(0,this.materialTexture,surfaces);
      else surfaces.addEventListener('load',()=>this.uploadImage(0,this.materialTexture,surfaces),{once:true});
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,this.shadow.texture);
      gl.uniform1i(this.uniform.Atlas,0); gl.uniform1i(this.uniform.Graphics,1);
      gl.uniform1i(this.uniform.Shadow,2); gl.uniform1i(this.uniform.ShadowReady,this.shadow.ready);
      this.peopleTexture=this.texture(3);
      gl.uniform1i(this.uniform.People,3);gl.uniform1i(this.uniform.PeopleReady,0);
      const people=window.SCAICharacterMaterials;
      const uploadPeople=()=>{
        const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=1024;
        atlas.getContext('2d').drawImage(people,0,0,atlas.width,atlas.height);
        this.uploadImage(3,this.peopleTexture,atlas);
        gl.useProgram(this.program);gl.uniform1i(this.uniform.PeopleReady,1);
      };
      if(people?.complete&&people.naturalWidth)uploadPeople();
      else people?.addEventListener('load',uploadPeople,{once:true});
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
      gl.clearColor(.80,.85,.91,1);
    }
    buffer(data,stride,indices){
      const gl=this.gl, buffer=gl.createBuffer();
      let indexType=gl.UNSIGNED_SHORT,indexBuffer=null;
      if(indices instanceof Uint32Array){
        if(gl.getExtension('OES_element_index_uint'))indexType=gl.UNSIGNED_INT;
        else{
          const expanded=new Float32Array(indices.length*stride);
          for(let i=0;i<indices.length;i++)expanded.set(data.subarray(indices[i]*stride,(indices[i]+1)*stride),i*stride);
          data=expanded;indices=null;
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
      if(indices){
        indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
      }
      return {buffer,indexBuffer,indexType,count:indices?indices.length:data.length/stride,vertexCount:data.length/stride,stride};
    }
    texture(unit) {
      const gl=this.gl,texture=gl.createTexture();
      gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([155,151,145,255]));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      return texture;
    }
    uploadImage(unit,texture,source) {
      const gl=this.gl;
      gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      if((source.width&(source.width-1))===0 && (source.height&(source.height-1))===0){
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        const aniso=gl.getExtension('EXT_texture_filter_anisotropic');
        if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,
          Math.min(4,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      }
    }
    makeContacts(shadows){
      const mesh=new SCAIMesh();
      for(const [x,z,rx,rz,alpha,y] of shadows) {
        for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
          mesh.vertex([x+u*rx,y,z+v*rz],[0,1,0],[alpha,0,0],[u,v],15);
        }
      }
      return this.buffer(mesh.v,12);
    }
    setMarkers(markers) {
      const signature=markers.map(m=>m.key+Number(m.complete)).join('/');
      if(signature===this.markerSignature)return;
      const mesh=new SCAIMesh();
      for(const marker of markers){
        mesh.objectiveMarker(marker.x,marker.z,marker.complete?this.colors.green:this.colors.orange,marker.x>0?-.045:-.005);
      }
      if(this.markers)this.gl.deleteBuffer(this.markers.buffer);
      this.markers=this.buffer(mesh.v,12);
      this.markerSignature=signature;
    }
    bind(geometry) {
      const gl=this.gl,bytes=geometry.stride*4;
      gl.bindBuffer(gl.ARRAY_BUFFER,geometry.buffer);
      if(geometry.indexBuffer)gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,geometry.indexBuffer);
      for(const [name,size,offset] of [['Position',3,0],['Normal',3,3],['Color',3,6],['Uv',2,9]]){
        const attr=this.attr[name];
        gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr,size,gl.FLOAT,false,bytes,offset*4);
      }
      const mat=this.attr.Material;
      const skin=this.attr.Skin;
      const detail=this.attr.Detail;
      if(geometry.stride===16){
        gl.disableVertexAttribArray(mat); gl.vertexAttrib1f(mat,0);
        gl.enableVertexAttribArray(skin); gl.vertexAttribPointer(skin,3,gl.FLOAT,false,bytes,44);
        gl.enableVertexAttribArray(detail); gl.vertexAttribPointer(detail,2,gl.FLOAT,false,bytes,56);
      }else{
        gl.enableVertexAttribArray(mat); gl.vertexAttribPointer(mat,1,gl.FLOAT,false,bytes,44);
        gl.disableVertexAttribArray(skin); gl.vertexAttrib3f(skin,0,0,0);
        gl.disableVertexAttribArray(detail); gl.vertexAttrib2f(detail,0,0);
      }
    }
    drawGeometry(geometry){
      if(!geometry?.count)return;
      this.bind(geometry);
      this.gl.drawArrays(this.gl.TRIANGLES,0,geometry.count);
    }
    drawPerson(x,z,time,walking,role,dir,mouth,walkDistance,blinkClock=time){
      const gl=this.gl, actor=this.actors[role];
      const pose=SCAIPeople.pose(x,z,time,walking,role,dir,mouth,walkDistance,blinkClock);
      for(let i=0;i<actor.bones.length;i++)this.boneMatrices.set(pose[actor.bones[i]],i*16);
      gl.uniformMatrix4fv(this.uniform['Bones[0]'],false,this.boneMatrices);
      this.bind(actor.geometry);
      if(actor.geometry.indexBuffer)gl.drawElements(gl.TRIANGLES,actor.geometry.count,actor.geometry.indexType,0);
      else gl.drawArrays(gl.TRIANGLES,0,actor.geometry.count);
    }
    draw(engine) {
      const gl=this.gl, p=engine.player, focus=engine.events.isDialogueOpen?.(),blinkClock=performance.now()/1000;
      gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.uniform.VP,false,engine.vp);
      gl.uniform3fv(this.uniform.Eye,engine.eye); gl.uniform2f(this.uniform.Player,p.x,p.z);
      gl.uniformMatrix4fv(this.uniform.Model,false,identity); gl.uniform1i(this.uniform.Actor,0);
      this.drawGeometry(this.world);
      this.drawGeometry(this.markers);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      this.drawGeometry(this.contacts);
      gl.depthMask(true); gl.disable(gl.BLEND);
      gl.uniform1i(this.uniform.Actor,1);
      if(!focus && engine.cameraScale>=.43)this.drawPerson(p.x,p.z,engine.t,engine.walking,'auditor',p.dir,false,engine.walkDistance,blinkClock);
      this.drawPerson(-10.7,-5.2,engine.t,false,'manager',Math.PI,!!engine.events.isTalking?.(),undefined,blinkClock);
      if(!focus)this.drawPerson(3.3,-2.25,engine.t,false,'worker',.6,false,undefined,blinkClock);
    }
  }
  window.SCAIRenderer=Renderer;
})();
