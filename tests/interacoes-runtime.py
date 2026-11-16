"""Regressão das interações Q/E em WebGL: python tests/interacoes-runtime.py."""
from pathlib import Path
import argparse
import json
import os
import signal
import subprocess
import sys
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
parser.add_argument('--timeout',type=float,default=120,help='Limite total em segundos, incluindo a limpeza do navegador.')
parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS)
args=parser.parse_args()
if args.timeout<=0:parser.error('--timeout deve ser maior que zero')

if not args.worker:
 # The parent owns this exact child PID; timeout is a failed test, never success.
 command=[sys.executable,str(Path(__file__).resolve()),*sys.argv[1:],'--worker']
 options={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {'start_new_session':True}
 child=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',env={**os.environ,'PYTHONUNBUFFERED':'1','PYTHONIOENCODING':'utf-8'},**options)
 try:
  output,_=child.communicate(timeout=args.timeout)
 except subprocess.TimeoutExpired:
  print(f'[cleanup] Falha: teste excedeu {args.timeout:g}s; encerrando somente a árvore do processo de teste {child.pid}.',file=sys.stderr,flush=True)
  if child.poll() is None:
   if os.name=='nt':
    subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10,check=False)
   else:os.killpg(child.pid,signal.SIGKILL)
  output,_=child.communicate(timeout=10)
  print(output,end='',flush=True)
  raise SystemExit(2)
 print(output,end='',flush=True)
 if child.returncode==0:
  expected=set(args.case or ['computador','celular','tablet'])
  profiles={json.loads(line).get('profile') for line in output.splitlines() if line.startswith('{')}
  markers=['[cleanup] navegador fechado','[cleanup] Playwright encerrado']+[f'[cleanup] {name}: contexto fechado' for name in expected]
  if profiles!=expected or not all(marker in output for marker in markers):
   print('[cleanup] Falha: saída incompleta; não foi confirmado o término dos testes e da limpeza.',file=sys.stderr,flush=True)
   raise SystemExit(3)
 raise SystemExit(child.returncode)

with sync_playwright() as pw:
 edge=Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
 executable=os.environ.get('SCAI_BROWSER') or (str(edge) if edge.exists() else None)
 browser=pw.webkit.launch(headless=True) if args.engine=='webkit' else pw.chromium.launch(headless=True,executable_path=executable,args=['--no-first-run'])
 try:
  for name,width,height,mobile in [('computador',1365,864,False),('celular',390,844,True),('tablet',1024,768,True)]:
   if args.case and name not in args.case:continue
   options=dict(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
   if mobile:options['user_agent']=pw.devices['iPhone 13' if name=='celular' else 'iPad (gen 7)']['user_agent']
   context=browser.new_context(**options);page=context.new_page();page.add_init_script(HOOK)
   clock_installed=False
   try:
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto((ROOT/'SCAI.html').as_uri());page.locator('#heroPlay').click()
    frame=page.frames[-1];frame.locator('#startMission').click()
    frame.evaluate('''async()=>{
     await SCAIGraphics.ready;await SCAIMaterials.decode();await SCAICharacterMaterials.decode();
     window.advance=frames=>{for(let i=0;i<frames;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render()};
     window.place=(x,z,dir)=>{Object.assign(qaEngine.player,{x,z,dir});qaEngine.keys={};qaEngine.cameraScale=1;advance(6)};
     window.untilPhase=(phase,maxFrames=600)=>{
      for(let i=0;i<maxFrames&&qaEngine.seating?.phase!==phase;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}
      qaEngine.render();return qaEngine.seating?.phase===phase;
     };
     window.untilFree=()=>{for(let i=0;i<600&&qaEngine.seating;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render();return !qaEngine.seating};
    }''')
    page.clock.install();clock_installed=True
    frame.evaluate('place(-10.7,-.8,Math.PI)')
    assert frame.locator('#actionIcon').inner_text()=='Q'
    page.keyboard.press('e');assert frame.locator('#dialoguePanel').is_hidden()
    page.keyboard.press('q');assert frame.locator('#dialoguePanel').is_visible()
    for question in range(2):
     assert frame.locator('#dialogueChoices button').count()==0
     assert frame.locator('#physicalAction').is_hidden()
     page.clock.fast_forward(13000)
     frame.locator('#dialogueChoices button').filter(has_text='Solicitar registros' if question==0 else 'Ouvir as preocupações').click();frame.locator('#dialogueContinue').click()
    frame.locator('#openPlan').click();frame.locator('[data-inc="docs"]').click();frame.locator('#startExecution').click()

    contacts=frame.evaluate('''()=>{
     let checked=0;
     for(const chair of SCAI3D.chairs)for(const [dx,dz] of [[.675,0],[-.675,0],[0,.72],[0,-.72]]){
      const x=chair.x+dx,z=chair.z+dz;if(!qaEngine.canMove(x,z))continue;
      const nearest=[...SCAI3D.chairs].sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
      for(const dir of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
       place(x,z,dir);
       if(qaEngine.nearbyChair()?.id!==nearest.id||qaEngine.physicalAction()?.kind!=='chair')throw Error('Cadeira incorreta ou dependente da orientação');
       checked++;
      }
     }
     return checked;
    }''')
    assert contacts>=16,contacts
    frame.evaluate('place(-4.3,5.62,Math.PI)')
    assert frame.locator('#action').is_visible()
    assert frame.locator('#physicalAction').is_visible()
    assert frame.locator('#physicalBtn').inner_text()=='Sentar'
    mission=frame.locator('#action').bounding_box();physical=frame.locator('#physicalAction').bounding_box()
    assert physical['y']+physical['height']<=mission['y'],(name,mission,physical)
    before_alignment=frame.evaluate('qaEngine.walkDistance')
    page.keyboard.press('e');frame.evaluate('advance(1)')
    assert frame.evaluate("qaEngine.seating?.phase==='aligning'&&qaEngine.seating.blend===0")
    frame.evaluate('advance(6)')
    assert frame.locator('#physicalBtn').inner_text()=='Posicionando…'
    assert frame.locator('#physicalBtn').is_disabled()
    assert frame.evaluate("untilPhase('sitting')")
    assert frame.evaluate('qaEngine.walkDistance')>before_alignment
    assert frame.evaluate('Math.abs(Math.atan2(Math.sin(qaEngine.player.dir-qaEngine.seating.chair.dir),Math.cos(qaEngine.player.dir-qaEngine.seating.chair.dir)))<.01')
    assert frame.evaluate('qaEngine.seating.blend===0')
    frame.evaluate('advance(15)')
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
    assert frame.evaluate("untilPhase('leaving')&&qaEngine.seating.blend===0")
    leaving_distance=frame.evaluate('qaEngine.walkDistance');frame.evaluate('advance(6)')
    assert frame.locator('#physicalBtn').inner_text()=='Saindo…'
    assert frame.locator('#physicalBtn').is_disabled()
    assert frame.evaluate('qaEngine.walkDistance')>leaving_distance
    assert frame.evaluate('untilFree()&&qaEngine.canMove(qaEngine.player.x,qaEngine.player.z)')
    page.keyboard.press('q');assert frame.locator('#procClose').is_visible();frame.locator('#procClose').click()

    frame.evaluate('place(-1,0,Math.PI/2)')
    assert frame.locator('#physicalBtn').inner_text()=='Abrir porta'
    assert frame.evaluate('!qaEngine.canMove(0,0)')
    frame.evaluate('advance(120)')
    assert frame.evaluate('qaEngine.door.open===0&&qaEngine.door.target===0')
    frame.evaluate('()=>{qaEngine.yaw=Math.PI/2;qaEngine.cameraScale=1;advance(6)}')
    assert frame.evaluate('qaEngine.cameraScale===1&&!qaEngine.hidePlayer')
    if mobile:frame.locator('#physicalBtn').tap()
    else:frame.locator('#physicalBtn').click()
    frame.evaluate('advance(30)')
    assert frame.evaluate('qaEngine.door.open>0&&qaEngine.door.open<1')
    frame.evaluate('advance(50)')
    assert frame.evaluate('qaEngine.door.open===1&&qaEngine.canMove(0,0)')
    page.keyboard.down('e');page.keyboard.down('e');frame.evaluate('advance(80)');page.keyboard.up('e')
    assert frame.evaluate('qaEngine.door.target===0&&qaEngine.door.open===0&&!qaEngine.canMove(0,0)')
    frame.evaluate('place(1,0,-Math.PI/2)');page.keyboard.press('e');frame.evaluate('advance(80)')
    assert frame.evaluate('qaEngine.door.open===1')
    frame.evaluate('place(0,0,Math.PI/2)');page.keyboard.press('e');frame.evaluate('advance(100)')
    assert frame.evaluate('qaEngine.door.target===0&&qaEngine.door.open>0&&qaEngine.door.open<1&&qaEngine.canMove(0,0)')
    paused_open=frame.evaluate('qaEngine.door.open');frame.evaluate('advance(120)')
    assert frame.evaluate('qaEngine.door.target===0&&qaEngine.door.open')==paused_open
    frame.evaluate('place(1,0,-Math.PI/2);advance(100)')
    assert frame.evaluate('qaEngine.door.target===0&&qaEngine.door.open===0')
    assert frame.evaluate('qaEngine.gl.getError()')==0
    assert not errors,(name,errors)
    result={'profile':name,'keys':'Q: missão; E: cadeira/porta','seatedAndStanding':True,'doorBothSides':True,'chairContacts':contacts,'preAlignment':True,'doorPausesWithoutReopening':True,'cameraIgnoresGlass':True,'errors':errors}
   finally:
    print(f'[cleanup] {name}: retomando clock',file=sys.stderr,flush=True)
    try:
     if clock_installed and not page.is_closed():page.clock.resume()
     print(f'[cleanup] {name}: clock retomado',file=sys.stderr,flush=True)
    finally:
     print(f'[cleanup] {name}: fechando contexto',file=sys.stderr,flush=True)
     context.close()
     print(f'[cleanup] {name}: contexto fechado',file=sys.stderr,flush=True)
   print(json.dumps(result),flush=True)
 finally:
  print('[cleanup] fechando navegador',file=sys.stderr,flush=True)
  browser.close()
  print('[cleanup] navegador fechado',file=sys.stderr,flush=True)
print('[cleanup] Playwright encerrado',file=sys.stderr,flush=True)
