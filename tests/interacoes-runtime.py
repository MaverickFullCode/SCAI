"""Regressão das interações Q/E em WebGL: python tests/interacoes-runtime.py."""
from pathlib import Path
import argparse
import json
import os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
HOOK="""window.requestAnimationFrame=()=>0;
Object.defineProperty(window,'SCAI3D',{configurable:true,set(api){
 const Base=api.Engine;api.Engine=class extends Base{constructor(...args){super(...args);window.qaEngine=this}};
 Object.defineProperty(window,'SCAI3D',{value:api});
}});"""
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--engine',choices=['chromium','webkit'],default='chromium')
parser.add_argument('--case',action='append',choices=['computador','celular','tablet'])
args=parser.parse_args()

with sync_playwright() as pw:
 edge=Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
 executable=os.environ.get('SCAI_BROWSER') or (str(edge) if edge.exists() else None)
 browser=pw.webkit.launch(headless=True) if args.engine=='webkit' else pw.chromium.launch(headless=True,executable_path=executable,args=['--no-first-run'])
 for name,width,height,mobile in [('computador',1365,864,False),('celular',390,844,True),('tablet',1024,768,True)]:
  if args.case and name not in args.case:continue
  options=dict(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
  if mobile:options['user_agent']=pw.devices['iPhone 13' if name=='celular' else 'iPad (gen 7)']['user_agent']
  page=browser.new_page(**options);page.add_init_script(HOOK)
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto((ROOT/'SCAI.html').as_uri());page.locator('#heroPlay').click()
  frame=page.frames[-1];frame.locator('#startMission').click()
  frame.evaluate('''async()=>{
   await SCAIGraphics.ready;await SCAIMaterials.decode();await SCAICharacterMaterials.decode();
   window.advance=frames=>{for(let i=0;i<frames;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render()};
   window.place=(x,z,dir)=>{Object.assign(qaEngine.player,{x,z,dir});qaEngine.keys={};qaEngine.cameraScale=1;advance(6)};
  }''')
  page.clock.install()
  frame.evaluate('place(-10.7,-.8,Math.PI)')
  assert frame.locator('#actionIcon').inner_text()=='Q'
  page.keyboard.press('e');assert frame.locator('#dialoguePanel').is_hidden()
  page.keyboard.press('q');assert frame.locator('#dialoguePanel').is_visible()
  for question in range(2):
   assert frame.locator('#dialogueChoices button').count()==0
   assert frame.locator('#physicalAction').is_hidden()
   page.clock.fast_forward(13000)
   frame.locator('#dialogueChoices button').first.click();frame.locator('#dialogueContinue').click()
  frame.locator('#openPlan').click();frame.locator('[data-inc="docs"]').click();frame.locator('#startExecution').click()

  frame.evaluate('place(-4.3,5.62,0)')
  assert frame.locator('#action').is_visible()
  assert frame.locator('#physicalAction').is_visible()
  assert frame.locator('#physicalBtn').inner_text()=='Sentar'
  mission=frame.locator('#action').bounding_box();physical=frame.locator('#physicalAction').bounding_box()
  assert physical['y']+physical['height']<=mission['y'],(name,mission,physical)
  page.keyboard.press('e');frame.evaluate('advance(30)')
  assert frame.evaluate("qaEngine.seating?.phase==='sitting'&&qaEngine.seating.blend>0&&qaEngine.seating.blend<1")
  assert frame.locator('#physicalBtn').is_disabled()
  page.keyboard.down('w');frame.evaluate('advance(60)');page.keyboard.up('w')
  assert frame.evaluate("qaEngine.seating?.phase==='seated'&&qaEngine.seating.blend===1&&!qaEngine.walking")
  seated=frame.evaluate('({...qaEngine.player})')
  frame.evaluate('advance(20)');assert frame.evaluate('({...qaEngine.player})')==seated
  assert frame.locator('#action').is_hidden() and frame.locator('#reportBtn').is_disabled()
  page.keyboard.press('q');assert frame.locator('#modal').is_hidden() and frame.locator('#dialoguePanel').is_hidden()
  if mobile:frame.locator('#physicalBtn').tap()
  else:frame.locator('#physicalBtn').click()
  frame.evaluate('advance(25)')
  assert frame.evaluate("qaEngine.seating?.phase==='standing'&&qaEngine.seating.blend>0&&qaEngine.seating.blend<1")
  frame.evaluate('advance(60)')
  assert frame.evaluate('qaEngine.seating===null&&qaEngine.canMove(qaEngine.player.x,qaEngine.player.z)')
  page.keyboard.press('q');assert frame.locator('#procClose').is_visible();frame.locator('#procClose').click()

  frame.evaluate('place(-1,0,Math.PI/2)')
  assert frame.locator('#physicalBtn').inner_text()=='Abrir porta'
  assert frame.evaluate('!qaEngine.canMove(0,0)')
  if mobile:frame.locator('#physicalBtn').tap()
  else:frame.locator('#physicalBtn').click()
  frame.evaluate('advance(30)')
  assert frame.evaluate('qaEngine.door.open>0&&qaEngine.door.open<1')
  frame.evaluate('advance(50)')
  assert frame.evaluate('qaEngine.door.open===1&&qaEngine.canMove(0,0)')
  page.keyboard.press('e');frame.evaluate('advance(80)')
  assert frame.evaluate('qaEngine.door.open===0&&!qaEngine.canMove(0,0)')
  frame.evaluate('place(1,0,-Math.PI/2)');page.keyboard.press('e');frame.evaluate('advance(80)')
  assert frame.evaluate('qaEngine.door.open===1')
  frame.evaluate('place(0,0,Math.PI/2)');page.keyboard.press('e');frame.evaluate('advance(100)')
  assert frame.evaluate('qaEngine.door.target===1&&qaEngine.canMove(0,0)')
  assert frame.evaluate('qaEngine.gl.getError()')==0
  assert not errors,(name,errors)
  print(json.dumps({'profile':name,'keys':'Q: missão; E: cadeira/porta','seatedAndStanding':True,'doorBothSides':True,'doorSafety':True,'errors':errors}),flush=True)
  page.close()
 browser.close()
