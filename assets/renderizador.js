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
      for(const name of ['Model','VP','Eye','Atlas','Graphics','Shadow','ShadowReady','Actor','Player','Worker','Bones[0]','People','PeopleReady','Opacity','TabletTime']){
        this.uniform[name]=gl.getUniformLocation(this.program,'u'+name);
      }
      const mesh=new SCAIMesh();
      SCAIWorld.build(mesh,colors);
      this.world=this.buffer(mesh.v,12);
      this.cameraObjects=mesh.cameraObjects;
      this.hiddenObjects=new Set();
      this.hiddenActors=new Set();
      this.hiddenDoorParts=new Set();
      this.shadow=SCAILighting.makeShadowMap(gl,this.world.buffer,mesh.propsStart,this.world.count);
      this.contacts=this.makeContacts(mesh.shadows);
      if(window.SCAIDoor){
        const door=SCAIDoor.build();
        this.door={fixed:this.buffer(door.fixed.v,12),frameParts:door.frameParts,leaves:door.leaves.map(leaf=>({id:leaf.id,side:leaf.side,bounds:leaf.bounds,opaque:this.buffer(leaf.opaque.v,12),glass:this.buffer(leaf.glass.v,12)}))};
      }
      this.actors={};
      const workerChair=window.SCAI3D.chairs.find(chair=>chair.occupant==='worker');
      this.workerPosition={x:workerChair.x,z:workerChair.z+workerChair.facing*.035,dir:workerChair.dir};
      for(const role of ['auditor','manager','worker']){
        const model=SCAIPeople.build(role);
        const bounds=this.actorBounds(model);
        this.actors[role]={geometry:this.buffer(model.data,model.stride,model.indices),bones:model.bones,bounds};
        if(role==='worker')this.actors[role].seatedBounds=this.actorBounds(model,SCAIPeople.pose(0,0,0,false,role,0,false,undefined,0,1));
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
      gl.uniform1f(this.uniform.Opacity,1);
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
    drawWorld(engine){
      const hidden=[];
      for(const object of this.cameraObjects){
        const overlaps=engine.cameraOverlaps(object,this.hiddenObjects.has(object.id)?.06:0);
        if(overlaps){this.hiddenObjects.add(object.id);hidden.push(...object.ranges);}
        else this.hiddenObjects.delete(object.id);
      }
      this.bind(this.world);
      let first=0;
      // Keep the usual single draw call; only split the mesh around hidden objects.
      for(const range of hidden.sort((a,b)=>a.first-b.first)){
        if(range.first>first)this.gl.drawArrays(this.gl.TRIANGLES,first,range.first-first);
        first=Math.max(first,range.first+range.count);
      }
      if(first<this.world.count)this.gl.drawArrays(this.gl.TRIANGLES,first,this.world.count-first);
    }
    actorBounds(model,pose){
      const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},data=model.data;
      for(let i=0;i<data.length;i+=model.stride)for(let axis=0;axis<3;axis++){
        let value=data[i+axis];
        if(pose){
          const a=pose[model.bones[data[i+11]]],b=pose[model.bones[data[i+12]]],weight=data[i+13];
          const transform=m=>m[axis]*data[i]+m[axis+4]*data[i+1]+m[axis+8]*data[i+2]+m[axis+12];
          value=transform(a)*(1-weight)+transform(b)*weight;
        }
        bounds.min[axis]=Math.min(bounds.min[axis],value);bounds.max[axis]=Math.max(bounds.max[axis],value);
      }
      return bounds;
    }
    personVisible(engine,x,z,role,dir,seated=false){
      const actor=this.actors[role],local=seated?actor.seatedBounds:actor.bounds,cs=Math.cos(dir),sn=Math.sin(dir);
      const bounds={min:[Infinity,local.min[1]-.08,Infinity],max:[-Infinity,local.max[1]+.08,-Infinity]};
      for(const xx of [local.min[0],local.max[0]])for(const zz of [local.min[2],local.max[2]]){
        const px=x+xx*cs-zz*sn,pz=z+xx*sn+zz*cs;
        bounds.min[0]=Math.min(bounds.min[0],px-.08);bounds.max[0]=Math.max(bounds.max[0],px+.08);
        bounds.min[2]=Math.min(bounds.min[2],pz-.08);bounds.max[2]=Math.max(bounds.max[2],pz+.08);
      }
      if(engine.cameraOverlaps(bounds,this.hiddenActors.has(role)?.06:0)){this.hiddenActors.add(role);return false;}
      this.hiddenActors.delete(role);return true;
    }
    drawPerson(x,z,time,walking,role,dir,mouth,walkDistance,blinkClock=time,seatBlend=0,tabletRead=null){
      const gl=this.gl, actor=this.actors[role];
      const pose=SCAIPeople.pose(x,z,time,walking,role,dir,mouth,walkDistance,blinkClock,seatBlend,tabletRead?.blend||0);
      gl.uniform1f(this.uniform.TabletTime,role==='auditor'&&tabletRead?.screen?tabletRead.elapsed-.55:-1);
      for(let i=0;i<actor.bones.length;i++)this.boneMatrices.set(pose[actor.bones[i]],i*16);
      gl.uniformMatrix4fv(this.uniform['Bones[0]'],false,this.boneMatrices);
      this.bind(actor.geometry);
      if(actor.geometry.indexBuffer)gl.drawElements(gl.TRIANGLES,actor.geometry.count,actor.geometry.indexType,0);
      else gl.drawArrays(gl.TRIANGLES,0,actor.geometry.count);
    }
    updateDoorVisibility(engine){
      if(!this.door)return;
      const open=engine.door?.open||0,hidden=this.hiddenDoorParts;
      const update=(id,bounds)=>{
        if(engine.cameraOverlaps(bounds,hidden.has(id)?.06:0))hidden.add(id);
        else hidden.delete(id);
      };
      for(const part of this.door.frameParts)update(part.id,part);
      for(const leaf of this.door.leaves){
        const offset=leaf.side*2.55*open;
        update(leaf.id,{min:leaf.bounds.min.map((v,i)=>v+(i===2?offset:0)),max:leaf.bounds.max.map((v,i)=>v+(i===2?offset:0))});
      }
    }
    drawDoorFrame(){
      const parts=this.door.frameParts.filter(part=>this.hiddenDoorParts.has(part.id));
      if(!parts.length){this.drawGeometry(this.door.fixed);return;}
      this.bind(this.door.fixed);
      let first=0;
      for(const part of parts){
        if(part.first>first)this.gl.drawArrays(this.gl.TRIANGLES,first,part.first-first);
        first=part.first+part.count;
      }
      if(first<this.door.fixed.count)this.gl.drawArrays(this.gl.TRIANGLES,first,this.door.fixed.count-first);
    }
    drawDoor(engine,transparent=false){
      if(!this.door)return;
      const gl=this.gl,open=engine.door?.open||0;
      if(!transparent)this.drawDoorFrame();
      for(const leaf of this.door.leaves){
        if(this.hiddenDoorParts.has(leaf.id))continue;
        const model=new Float32Array(identity);model[14]=leaf.side*2.55*open;
        gl.uniformMatrix4fv(this.uniform.Model,false,model);
        this.drawGeometry(transparent?leaf.glass:leaf.opaque);
      }
      gl.uniformMatrix4fv(this.uniform.Model,false,identity);
    }
    draw(engine) {
      const gl=this.gl, p=engine.player,worker=this.workerPosition, focus=engine.events.isDialogueOpen?.(),blinkClock=performance.now()/1000;
      gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.uniform.VP,false,engine.vp);
      gl.uniform3fv(this.uniform.Eye,engine.eye); gl.uniform2f(this.uniform.Player,p.x,p.z);
      gl.uniform2f(this.uniform.Worker,worker.x+.45*Math.sin(worker.dir),worker.z-.45*Math.cos(worker.dir));
      gl.uniformMatrix4fv(this.uniform.Model,false,identity); gl.uniform1i(this.uniform.Actor,0);
      gl.uniform1f(this.uniform.Opacity,1);
      this.updateDoorVisibility(engine);
      this.drawWorld(engine);
      this.drawDoor(engine);
      this.drawGeometry(this.markers);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      this.drawGeometry(this.contacts);
      gl.depthMask(true); gl.disable(gl.BLEND);
      gl.uniform1i(this.uniform.Actor,1);
      if(!focus&&!engine.hidePlayer)this.drawPerson(p.x,p.z,engine.t,engine.walking,'auditor',p.dir,false,engine.walkDistance,blinkClock,engine.seating?.blend||0,engine.tabletRead);
      if(this.personVisible(engine,-10.7,-5.2,'manager',Math.PI))this.drawPerson(-10.7,-5.2,engine.t,false,'manager',Math.PI,!!engine.events.isTalking?.(),undefined,blinkClock);
      if(!focus&&this.personVisible(engine,worker.x,worker.z,'worker',worker.dir,true))this.drawPerson(worker.x,worker.z,engine.t,false,'worker',worker.dir,false,undefined,blinkClock,1);
      if(this.door){
        gl.uniform1i(this.uniform.Actor,0);gl.uniform1f(this.uniform.Opacity,.16);
        gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
        this.drawDoor(engine,true);
        gl.depthMask(true);gl.disable(gl.BLEND);
        gl.uniform1f(this.uniform.Opacity,1);gl.uniform1i(this.uniform.Actor,1);
      }
    }
  }
  window.SCAIRenderer=Renderer;
})();
