"""Fluxo da conversa do trabalhador: python tests/trabalhador-runtime.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,tempfile
ROOT=Path(__file__).resolve().parent.parent
HOOK="""window.requestAnimationFrame=()=>0;Object.defineProperty(window,'SCAI3D',{configurable:true,set(api){const Base=api.Engine;api.Engine=class extends Base{constructor(...args){super(...args);window.qaEngine=this}};Object.defineProperty(window,'SCAI3D',{value:api})}});"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',args=['--no-first-run'])
 try:
  for profile in ['computador','celular']:
   options={'viewport':{'width':1365,'height':864}}
   if profile=='celular':options.update(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,user_agent=pw.devices['iPhone 13']['user_agent'])
   context=browser.new_context(**options);page=context.new_page();page.add_init_script(HOOK);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    page.goto((ROOT/'SCAI.html').as_uri());page.locator('#heroPlay').click();f=page.frames[-1];f.locator('#startMission').click()
    f.evaluate('''async()=>{await SCAIGraphics.ready;await SCAIMaterials.decode();await SCAICharacterMaterials.decode();window.advance=n=>{for(let i=0;i<n;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render()};Object.assign(qaEngine.player,{x:5.65,z:3.87,dir:0});advance(6);}''')
    credits=f.locator('#pointsText').inner_text();stage=f.locator('#stagebar').text_content();page.clock.install()
    assert f.locator('#physicalBtn').inner_text()=='Conversar'
    if profile=='computador':page.keyboard.press('e')
    else:f.locator('#physicalBtn').click()
    assert f.evaluate('qaEngine.workerTalk.phase')=='approaching'
    assert f.locator('#dialoguePanel').is_hidden()
    f.evaluate('advance(360)');assert f.evaluate('qaEngine.workerTalk.phase')=='speaking'
    assert f.locator('#dialoguePanel').is_visible();assert 'TRABALHADOR' in f.locator('#dialogueSpeaker').text_content()
    assert f.locator('#dialogueContinue').is_hidden()
    page.clock.fast_forward(1000)
    length=len(f.locator('#dialogueText').text_content());assert 29<=length<=32,length
    f.evaluate('advance(12)')
    assert f.evaluate('''()=>{const e=qaEngine,w=e.renderer.workerPosition,m=SCAIPeople.pose(w.x,w.z,e.t,false,'worker',w.dir,false,0,0,1,0,1).head,p=[0,2.724,-.18],point=[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]),v=e.vp;const clip=i=>v[i]*point[0]+v[i+4]*point[1]+v[i+8]*point[2]+v[i+12],y=(1-clip(1)/clip(3))*e.canvas.clientHeight/2;return y>0&&y<document.querySelector('#dialoguePanel').getBoundingClientRect().top-8;}'''), 'a legenda não pode cobrir a boca'
    f.locator('#scene').screenshot(path=str(Path(tempfile.gettempdir())/('scai-conversa-trabalhador-'+profile+'.png')))
    if profile=='computador':page.screenshot(path=str(ROOT/'docs/previa-conversa-trabalhador.jpg'))
    page.clock.fast_forward(6000);assert f.locator('#dialogueContinue').is_visible();assert f.evaluate('qaEngine.workerTalk.look')==1
    assert 'resolver tudo sozinho' in f.locator('#dialogueText').text_content()
    if profile=='computador':page.keyboard.press('e')
    else:f.locator('#dialogueContinue').click()
    assert f.locator('#dialoguePanel').is_hidden();assert f.evaluate('qaEngine.workerTalk.phase')=='returning'
    f.evaluate('advance(45)');assert f.evaluate('qaEngine.workerTalk') is None
    assert f.locator('#pointsText').inner_text()==credits;assert f.locator('#stagebar').text_content()==stage
    # The interview remains usable after a worker conversation, with its own speaker/camera.
    f.evaluate('Object.assign(qaEngine.player,{x:-10.7,z:-.8});advance(6)');page.keyboard.press('q')
    assert 'MARCOS' in f.locator('#dialogueSpeaker').text_content();assert f.evaluate('qaEngine.workerTalk') is None
    page.clock.fast_forward(8000);assert f.locator('#dialogueChoices button').count()==3
    assert not errors,errors;assert f.evaluate('qaEngine.gl.getError()')==0
    print(json.dumps({'profile':profile,'charactersAfter1s':length,'returnedToWork':True,'missionUnchanged':True,'interviewStillWorks':True,'errors':errors}),flush=True)
    page.clock.resume()
   finally:context.close()
 finally:browser.close()
