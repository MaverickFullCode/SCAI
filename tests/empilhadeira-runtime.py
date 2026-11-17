"""Conferência da empilhadeira em WebGL: python tests/empilhadeira-runtime.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import tempfile,json
ROOT=Path(__file__).resolve().parent.parent
HOOK="""window.requestAnimationFrame=()=>0;Object.defineProperty(window,'SCAI3D',{configurable:true,set(api){const Base=api.Engine;api.Engine=class extends Base{constructor(...args){super(...args);window.qaEngine=this}};Object.defineProperty(window,'SCAI3D',{value:api})}});"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',args=['--no-first-run'])
 try:
  for profile in ['computador','celular']:
   opts={'viewport':{'width':1365,'height':864}}
   if profile=='celular':opts.update(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,user_agent=pw.devices['iPhone 13']['user_agent'])
   context=browser.new_context(**opts);page=context.new_page();page.add_init_script(HOOK);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    page.goto((ROOT/'SCAI.html').as_uri());page.locator('#heroPlay').click();f=page.frames[-1];f.locator('#startMission').click()
    f.evaluate('''async()=>{await SCAIGraphics.ready;await SCAIMaterials.decode();await SCAICharacterMaterials.decode();window.advance=n=>{for(let i=0;i<n;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render()};Object.assign(qaEngine.player,{x:11.945,z:-.3,dir:Math.PI/2});advance(6)}''')
    assert f.locator('#physicalBtn').inner_text()=='Entrar'
    if profile=='computador':page.keyboard.press('e')
    else:f.locator('#physicalBtn').click()
    if profile=='computador':
     f.evaluate("while(qaEngine.vehicleSeat.phase==='approaching')advance(1);qaEngine.yaw=0;advance(70)")
     f.locator('#scene').screenshot(path=str(ROOT/'docs/previa-embarque-empilhadeira.jpg'))
     f.evaluate('advance(40)');f.locator('#scene').screenshot(path=str(Path(tempfile.gettempdir())/'scai-embarque-piso-cabine.png'))
    f.evaluate('advance(180)');assert f.evaluate('qaEngine.vehicleSeat.phase')=='driving';assert f.locator('#physicalBtn').inner_text()=='Sair'
    if profile=='computador':
     f.evaluate('qaEngine.yaw=2.5;advance(1)');f.locator('#scene').screenshot(path=str(Path(tempfile.gettempdir())/'scai-empilhadeira-pose.png'))
    # Put the vehicle straight in the passage to verify its full footprint clears the door.
    f.evaluate('Object.assign(qaEngine.forklift,{x:12.19,z:0,angle:0});qaEngine.shutter.open=qaEngine.shutter.target=1;qaEngine.yaw=-Math.PI/2;advance(1)')
    if profile=='computador':page.keyboard.down('w')
    else:
     session=context.new_cdp_session(page);button=f.locator('#touchControls [data-key="w"]').bounding_box();session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':button['x']+20,'y':button['y']+20}]})
    f.evaluate('advance(240)')
    assert not f.locator('#tabletBtn').is_disabled()
    before_read=f.evaluate('qaEngine.forklift.x')
    if profile=='computador':page.keyboard.press('f')
    else:f.locator('#tabletBtn').click()
    f.evaluate('advance(45)');assert f.evaluate('qaEngine.tabletRead.screen');assert f.evaluate('qaEngine.forklift.x')>before_read
    if profile=='computador':
     f.evaluate('qaEngine.yaw=.25;advance(1)');f.locator('#scene').screenshot(path=str(ROOT/'docs/previa-tablet-dirigindo.jpg'))
    if profile=='computador':page.keyboard.up('w')
    else:session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert f.evaluate('qaEngine.forklift.x')>25,'deve atravessar o portão no veículo'
    f.evaluate('advance(70)');assert f.evaluate('qaEngine.forklift.speed')==0
    assert f.evaluate('qaEngine.forklift.wheelAngles.every(a=>a<0)')
    # Turning, centering and reverse in the large free area.
    f.evaluate("qaEngine.setInput('w',true);qaEngine.setInput('a',true);advance(70);qaEngine.keys={}")
    assert f.evaluate('qaEngine.forklift.steer')<0
    if profile=='computador':
     f.evaluate('qaEngine.yaw=qaEngine.forklift.angle+2.5;advance(1)');f.locator('#scene').screenshot(path=str(ROOT/'docs/previa-empilhadeira-dirigivel.jpg'))
    f.evaluate('advance(70)');assert f.evaluate('qaEngine.forklift.steer')==0
    before=f.evaluate('Array.from(qaEngine.forklift.wheelAngles)');f.evaluate("qaEngine.keys.s=true;advance(90);qaEngine.keys={};advance(45)");after=f.evaluate('Array.from(qaEngine.forklift.wheelAngles)');assert all(b>a for a,b in zip(before,after))
    if profile=='computador':page.keyboard.press('e')
    else:f.locator('#physicalBtn').click()
    f.evaluate('advance(180)');assert f.evaluate('qaEngine.vehicleSeat') is None
    parked=f.evaluate('JSON.stringify(qaEngine.forklift)');f.evaluate('advance(120)');assert f.evaluate('JSON.stringify(qaEngine.forklift)')==parked
    assert f.evaluate('qaEngine.canMove(qaEngine.player.x,qaEngine.player.z)');assert f.evaluate('qaEngine.canMove(12.615,-1.35)')
    assert not errors,errors;assert f.evaluate('qaEngine.gl.getError()')==0
    print(json.dumps({'profile':profile,'mounted':True,'crossedGate':True,'steeringAndReverse':True,'parkedAfterExit':True,'errors':errors}),flush=True)
   finally:context.close()
 finally:browser.close()
