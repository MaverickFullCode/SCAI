"""Conferência WebGL da porta de enrolar e do galpão: python tests/galpao-runtime.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parent.parent
HOOK="""window.requestAnimationFrame=()=>0;Object.defineProperty(window,'SCAI3D',{configurable:true,set(api){const Base=api.Engine;api.Engine=class extends Base{constructor(...args){super(...args);window.qaEngine=this}};Object.defineProperty(window,'SCAI3D',{value:api})}});"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',args=['--no-first-run'])
 try:
  for profile in ['computador','celular']:
   opts={'viewport':{'width':1365,'height':864}}
   if profile=='celular':opts.update(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,user_agent=pw.devices['iPhone 13']['user_agent'])
   context=browser.new_context(**opts);page=context.new_page();page.add_init_script(HOOK);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   try:
    page.goto((ROOT/'SCAI.html').as_uri());page.locator('#heroPlay').click();f=page.frames[-1];f.locator('#startMission').click()
    f.evaluate('''async()=>{
     await SCAIGraphics.ready;await SCAIMaterials.decode();await SCAICharacterMaterials.decode();
     window.advance=n=>{for(let i=0;i<n;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render()};
     window.place=(x,z,yaw=-Math.PI/2)=>{Object.assign(qaEngine.player,{x,z,dir:-yaw});qaEngine.keys={};qaEngine.yaw=yaw;qaEngine.cameraScale=1;advance(6)};
     place(15.9,3.07);advance(180);
    }''')
    assert f.evaluate('qaEngine.shutter.open')==0
    assert f.locator('#physicalBtn').inner_text()=='Abrir porta'
    if profile=='computador':page.keyboard.press('e')
    else:f.locator('#physicalBtn').click()
    f.evaluate('advance(75)')
    assert .49<f.evaluate('qaEngine.shutter.open')<.55
    assert not f.evaluate('qaEngine.canMove(16.6,0)')
    if profile=='computador':
     f.evaluate('qaEngine.yaw=-2.15;advance(1)');f.locator('#scene').screenshot(path=str(ROOT/'docs/previa-porta-enrolar.jpg'))
    f.evaluate('advance(90)');assert f.evaluate('qaEngine.shutter.open')==1
    f.evaluate('place(15.9,0);qaEngine.keys.w=true;advance(120);qaEngine.keys={};')
    assert f.evaluate('qaEngine.player.x')>22
    assert 'expansão' in f.locator('#location').text_content()
    f.evaluate('place(30,SCAIWarehouse.layout.centerZ);qaEngine.render()')
    if profile=='computador':f.locator('#scene').screenshot(path=str(ROOT/'docs/previa-galpao-expansao.jpg'))
    f.evaluate('qaEngine.keys.w=true;advance(1300);qaEngine.keys={};')
    assert 96<f.evaluate('qaEngine.player.x')<96.3
    assert not f.evaluate('qaEngine.canMove(97,0)')
    assert not f.evaluate('qaEngine.cameraPointBlocked(...qaEngine.eye)')
    f.evaluate('place(17.55,3.07)')
    assert f.locator('#physicalBtn').inner_text()=='Fechar porta'
    f.locator('#physicalBtn').click();f.evaluate('advance(180)')
    assert f.evaluate('qaEngine.shutter.open')==0
    assert not f.evaluate('qaEngine.canMove(16.6,0)')
    f.evaluate('advance(180)');assert f.evaluate('qaEngine.shutter.open')==0
    f.locator('#physicalBtn').click();f.evaluate('advance(180);place(18,0,Math.PI/2);qaEngine.keys.w=true;advance(60);qaEngine.keys={};')
    assert f.evaluate('qaEngine.player.x')<16.2
    # Every wall limits the camera; the closed curtain can be traversed and hidden.
    if profile=='computador':
     from tempfile import gettempdir
     f.evaluate('place(-2,6.5,-2.25)');f.locator('#scene').screenshot(path=str(Path(gettempdir())/'scai-janela-galpao-alinhado.png'))
     f.evaluate('place(23,0,Math.PI/2)');f.locator('#scene').screenshot(path=str(Path(gettempdir())/'scai-parede-portao-corrigida.png'))
     f.evaluate('place(17.4,-5,Math.PI/2)');f.locator('#scene').screenshot(path=str(Path(gettempdir())/'scai-juncao-piso-vedada.png'))
    f.evaluate('place(17.5,-46.8,Math.PI*1.5)')
    assert not f.evaluate('qaEngine.cameraPointBlocked(...qaEngine.eye)')
    assert f.evaluate('qaEngine.cameraScale')<1
    assert f.evaluate('qaEngine.gl.getError()')==0
    assert not errors,errors
    print(json.dumps({'profile':profile,'panelsBothSides':True,'crossedBothWays':True,'largeEmptyFloor':True,'cameraProtected':True,'errors':errors}),flush=True)
   finally:context.close()
 finally:browser.close()
