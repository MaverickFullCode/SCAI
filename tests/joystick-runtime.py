"""Controle circular por toque real emulado: python tests/joystick-runtime.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,tempfile
ROOT=Path(__file__).resolve().parent.parent
HOOK="""window.requestAnimationFrame=()=>0;Object.defineProperty(window,'SCAI3D',{configurable:true,set(api){const Base=api.Engine;api.Engine=class extends Base{constructor(...a){super(...a);window.qaEngine=this}};Object.defineProperty(window,'SCAI3D',{value:api})}});"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',args=['--no-first-run'])
 try:
  for profile,width,height in [('celular',390,844),('tablet',1024,768),('paisagem',844,390)]:
   context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,user_agent=pw.devices['iPad (gen 7)' if profile=='tablet' else 'iPhone 13']['user_agent'])
   page=context.new_page();page.add_init_script(HOOK);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    page.goto((ROOT/'SCAI.html').as_uri());page.locator('#heroPlay').click();f=page.frames[-1];f.locator('#startMission').click()
    f.evaluate('''async()=>{await SCAIGraphics.ready;await SCAIMaterials.decode();await SCAICharacterMaterials.decode();window.advance=n=>{for(let i=0;i<n;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render()};Object.assign(qaEngine.player,{x:40,z:-20,dir:.8});qaEngine.yaw=-1.2;advance(6)}''')
    assert f.locator('#touchControls [data-key="w"]').count()==0
    stick=f.locator('#moveStick').bounding_box();thumb=f.locator('.stick-thumb').bounding_box();cx=stick['x']+stick['width']/2;cy=stick['y']+stick['height']/2;radius=(stick['width']-thumb['width'])/2-1
    assert stick['x']+stick['width']<=f.locator('#runBtn').bounding_box()['x']
    session=context.new_cdp_session(page)
    def touch(kind,*points):session.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':list(points)})
    def finger(x,y,id=1):return {'x':x,'y':y,'id':id}
    centre=finger(cx,cy);touch('touchStart',centre);f.evaluate('advance(6)');assert not f.evaluate('qaEngine.walking')
    half=finger(cx,cy-radius*.56);touch('touchMove',half);f.evaluate('advance(60)');assert abs(f.evaluate('qaEngine.walkDistance')-1.8)<.0001
    assert abs(f.evaluate('qaEngine.player.dir')-1.2)<1e-7
    camera=f.locator('[data-key="arrowleft"]').bounding_box();turn=finger(camera['x']+camera['width']/2,camera['y']+camera['height']/2,2)
    touch('touchStart',half,turn);f.evaluate('advance(30)');touch('touchEnd',turn);assert f.evaluate('Math.abs(qaEngine.player.dir+qaEngine.yaw)<1e-7')
    right=finger(cx+radius,cy);touch('touchMove',right);f.evaluate('advance(60)');assert f.evaluate('Math.abs(qaEngine.player.dir+qaEngine.yaw-Math.PI/2)<1e-7')
    touch('touchMove',finger(cx+180,cy-180));f.evaluate('advance(6)');assert abs(f.evaluate('qaEngine.joystick.power')-1)<1e-7
    bounded=f.evaluate('''()=>{const b=document.querySelector('#moveStick').getBoundingClientRect(),t=document.querySelector('.stick-thumb').getBoundingClientRect();return Math.hypot(t.x+t.width/2-b.x-b.width/2,t.y+t.height/2-b.y-b.height/2)+t.width/2<=b.width/2}''')
    assert bounded,'círculo menor deve permanecer inteiro dentro do maior'
    touch('touchEnd');f.evaluate('advance(6)');assert f.evaluate('!qaEngine.joystick&&!qaEngine.walking')
    f.wait_for_function('''()=>{const b=document.querySelector('#moveStick').getBoundingClientRect(),t=document.querySelector('.stick-thumb').getBoundingClientRect();return Math.hypot(t.x+t.width/2-b.x-b.width/2,t.y+t.height/2-b.y-b.height/2)<.5}''',polling=50)
    if profile=='celular':f.locator('#scene').screenshot(path=str(Path(tempfile.gettempdir())/'scai-controle-circular.png'))
    # A second finger can open F; on foot this cancels and recentres movement.
    up=finger(cx,cy-radius);touch('touchStart',up);button=f.locator('#tabletBtn').bounding_box();tablet=finger(button['x']+button['width']/2,button['y']+button['height']/2,2)
    touch('touchStart',up,tablet);touch('touchEnd',tablet);f.evaluate('advance(6)');assert f.evaluate('!!qaEngine.tabletRead&&!qaEngine.joystick');assert f.locator('#moveStick').get_attribute('aria-disabled')=='true'
    touch('touchEnd');f.evaluate('advance(250)');assert f.locator('#moveStick').get_attribute('aria-disabled')=='false'
    run=f.locator('#runBtn').bounding_box();c=finger(run['x']+run['width']/2,run['y']+run['height']/2,2)
    touch('touchStart',up,c);f.evaluate('advance(6)');assert f.evaluate('qaEngine.running')
    f.evaluate("window.dispatchEvent(new Event('blur'));advance(6)");assert f.evaluate('!qaEngine.joystick&&!qaEngine.keys.c&&!qaEngine.walking');touch('touchCancel')
    # The same control still drives the forklift and remains available during F.
    f.evaluate('Object.assign(qaEngine.player,{x:11.945,z:-.3});advance(6)');touch('touchStart',centre);physical=f.locator('#physicalBtn').bounding_box();e=finger(physical['x']+physical['width']/2,physical['y']+physical['height']/2,2)
    touch('touchStart',centre,e);touch('touchEnd',e);touch('touchEnd');f.evaluate('advance(200)');assert f.evaluate('qaEngine.vehicleSeat.phase')=='driving'
    f.evaluate('Object.assign(qaEngine.forklift,{x:40,z:-20,angle:0});advance(6)');touch('touchStart',up);f.evaluate('advance(120)');assert f.evaluate('qaEngine.forklift.speed')==10
    touch('touchStart',up,tablet);touch('touchEnd',tablet);f.evaluate('advance(60)');assert f.evaluate('qaEngine.tabletRead.screen&&!!qaEngine.joystick');assert f.locator('#moveStick').get_attribute('aria-disabled')=='false';touch('touchEnd')
    assert not errors,errors;assert f.evaluate('qaEngine.gl.getError()')==0
    print(json.dumps({'profile':profile,'cameraRelative':True,'liveCameraTurn':True,'analogueSpeed':True,'clampedAndCentred':True,'multitouch':True,'forklift':True,'errors':errors}),flush=True)
   finally:context.close()
 finally:browser.close()
