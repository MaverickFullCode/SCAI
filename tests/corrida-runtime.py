"""Conferência do controle circular e da corrida: python tests/corrida-runtime.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,tempfile
ROOT=Path(__file__).resolve().parent.parent
HOOK="""window.requestAnimationFrame=()=>0;Object.defineProperty(window,'SCAI3D',{configurable:true,set(api){const Base=api.Engine;api.Engine=class extends Base{constructor(...a){super(...a);window.qaEngine=this}};Object.defineProperty(window,'SCAI3D',{value:api})}});"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',args=['--no-first-run'])
 try:
  for profile,width,height in [('computador',1365,864),('celular',390,844),('celular-estreito',320,740),('tablet',1024,768)]:
   opts={'viewport':{'width':width,'height':height}}
   if profile!='computador':opts.update(is_mobile=True,has_touch=True,user_agent=pw.devices['iPad (gen 7)' if profile=='tablet' else 'iPhone 13']['user_agent'])
   context=browser.new_context(**opts);page=context.new_page();page.add_init_script(HOOK);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    page.goto((ROOT/'SCAI.html').as_uri());page.locator('#heroPlay').click();f=page.frames[-1];f.locator('#startMission').click()
    f.evaluate('''async()=>{await SCAIGraphics.ready;await SCAIMaterials.decode();await SCAICharacterMaterials.decode();window.advance=n=>{for(let i=0;i<n;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render()};Object.assign(qaEngine.player,{x:40,z:-20,dir:0});qaEngine.yaw=0;qaEngine.walkDistance=0;qaEngine.gait=null;advance(6)}''')
    if profile=='computador':
     page.keyboard.down('w');page.keyboard.down('c')
    else:
     run=f.locator('#runBtn').bounding_box();tablet=f.locator('#tabletBtn').bounding_box();stick=f.locator('#moveStick').bounding_box();thumb=f.locator('.stick-thumb').bounding_box()
     assert run['x']+run['width']<=tablet['x'],'C deve ficar à esquerda de F'
     assert stick['x']+stick['width']<=run['x'],'controles não devem se sobrepor'
     session=context.new_cdp_session(page)
     w={'x':stick['x']+stick['width']/2,'y':stick['y']+thumb['height']/2+1,'id':1}
     c={'x':run['x']+run['width']/2,'y':run['y']+run['height']/2,'id':2}
     session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[w,c]})
    assert f.evaluate('(qaEngine.keys.w||!!qaEngine.joystick)&&qaEngine.keys.c')
    f.evaluate('advance(60)');assert f.evaluate('qaEngine.running&&qaEngine.walking');assert abs(f.evaluate('qaEngine.walkDistance')-7.2)<1e-6
    assert f.locator('#runBtn').get_attribute('aria-pressed')=='true'
    if profile in ('computador','celular'):
     f.locator('#scene').screenshot(path=str(Path(tempfile.gettempdir())/f'scai-corrida-{profile}.png'))
    if profile=='computador':page.keyboard.up('c')
    else:session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[c]})
    assert f.evaluate('(qaEngine.keys.w||!!qaEngine.joystick)&&!qaEngine.keys.c')
    f.evaluate('advance(60)');assert f.evaluate('!qaEngine.running&&qaEngine.walking');assert abs(f.evaluate('qaEngine.walkDistance')-10.8)<1e-6
    assert f.locator('#runBtn').get_attribute('aria-pressed')=='false'
    if profile=='computador':page.keyboard.up('w')
    else:session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    f.evaluate('advance(6)');assert f.evaluate('!qaEngine.walking&&!qaEngine.running')
    assert f.evaluate('!window.getSelection().toString()')
    if profile!='computador':
     session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[w,c]})
     session.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
     assert f.evaluate('!(qaEngine.keys.w||!!qaEngine.joystick)&&!qaEngine.keys.c'),'interrupção do toque deve soltar ambos os controles'
    assert not errors,errors;assert f.evaluate('qaEngine.gl.getError()')==0
    print(json.dumps({'profile':profile,'runningSpeed':7.2,'walkingAfterRelease':3.6,'controls':True,'errors':errors}),flush=True)
   finally:context.close()
 finally:browser.close()
