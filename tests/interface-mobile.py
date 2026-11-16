"""Regressão do HUD e diálogo: python tests/interface-mobile.py (Playwright)."""
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
CASES=[
 ('celular',390,844,390,844,True,True,True,None),
 ('celular-compacto',375,667,375,667,True,True,True,None),
 ('celular-paisagem',844,390,390,844,True,True,True,None),
 ('celular-pequeno',320,568,320,568,True,True,True,None),
 ('tablet-retrato',768,1024,768,1024,True,True,False,None),
 ('tablet-paisagem',1024,768,1024,768,True,True,False,None),
 ('tablet-tela-dividida',390,844,768,1024,True,True,False,None),
 ('tablet-compacto',600,960,600,960,True,True,False,'Mozilla/5.0 (Linux; Android 13; Tablet) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'),
 ('computador',1365,864,1365,864,False,False,False,None),
 ('computador-estreito',390,844,1365,864,False,False,False,None),
]

def draw(frame):
 frame.evaluate('''()=>{for(let i=0;i<2;i++){
  qaEngine.update(.016);for(let k=0;k<6;k++)qaEngine.events.onFrame(qaEngine);qaEngine.render();
 }}''')

def metrics(frame):
 return frame.evaluate('''()=>{
  const panel=document.querySelector('#dialoguePanel'),choices=document.querySelector('#dialogueChoices');
  const text=document.querySelector('#dialogueText'),bounds=panel.getBoundingClientRect();
  return {ratio:bounds.height/innerHeight,top:bounds.top,questionTop:text.getBoundingClientRect().top,
   questionBottom:text.getBoundingClientRect().bottom,choicesTop:choices.getBoundingClientRect().top,
   questionRight:text.getBoundingClientRect().right,choicesLeft:choices.getBoundingClientRect().left,
   answerScroll:choices.scrollHeight>choices.clientHeight+2,questionFont:getComputedStyle(text).fontSize,
   answerFont:getComputedStyle(choices.querySelector('button')).fontSize,
   overflow:document.documentElement.scrollWidth>innerWidth};
 }''')

def speaker_bounds(frame):
 return frame.evaluate('''()=>{
  const model=SCAIPeople.build('manager'),pose=SCAIPeople.pose(-10.7,-5.2,qaEngine.t,false,'manager',Math.PI,false),vp=qaEngine.vp,ys=[];
  const transform=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
  for(const part of model.parts){
   if(!['head','lip','eyelidL','eyelidR'].includes(part.bone))continue;
   for(let j=part.first;j<part.first+part.count;j+=3){
    const i=model.indices[j]*model.stride,p=Array.from(model.data.slice(i,i+3)),w=model.data[i+13];
    const a=transform(pose[model.bones[model.data[i+11]]],p),b=transform(pose[model.bones[model.data[i+12]]],p);
    const q=a.map((v,k)=>v*(1-w)+b[k]*w),clipY=vp[1]*q[0]+vp[5]*q[1]+vp[9]*q[2]+vp[13],clipW=vp[3]*q[0]+vp[7]*q[1]+vp[11]*q[2]+vp[15];
    ys.push((1-clipY/clipW)*innerHeight*.5);
   }
  }
  return {top:Math.min(...ys),bottom:Math.max(...ys)};
 }''')

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--engine',choices=['chromium','webkit'],default='chromium')
parser.add_argument('--case',action='append',choices=[case[0] for case in CASES])
parser.add_argument('--capture',action='store_true',help='Atualiza as capturas do celular em docs/.')
args=parser.parse_args()

with sync_playwright() as pw:
 edge=Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
 executable=os.environ.get('SCAI_BROWSER') or (str(edge) if edge.exists() else None)
 browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-first-run']) if args.engine=='chromium' else pw.webkit.launch(headless=True)
 for label,width,height,screen_w,screen_h,mobile,touch,phone,user_agent in CASES:
  if args.case and label not in args.case:continue
  options=dict(viewport={'width':width,'height':height},screen={'width':screen_w,'height':screen_h},is_mobile=mobile,has_touch=touch,device_scale_factor=1)
  if user_agent:options['user_agent']=user_agent
  elif phone:options['user_agent']=pw.devices['iPhone 13']['user_agent']
  elif mobile:options['user_agent']=pw.devices['iPad (gen 7)']['user_agent']
  page=browser.new_page(**options);page.add_init_script(HOOK)
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto((ROOT/'SCAI.html').as_uri());page.locator('#heroPlay').click()
  frame=page.frames[-1];frame.locator('#startMission').click()
  page.clock.install()
  detected=frame.locator('#game').evaluate("el=>el.classList.contains('phone-ui')")
  if detected!=phone:
   probe=frame.evaluate('()=>({ua:navigator.userAgent,platform:navigator.platform,touch:navigator.maxTouchPoints,coarse:matchMedia("(any-pointer: coarse)").matches,primary:matchMedia("(pointer: coarse)").matches,screen:[screen.width,screen.height],viewport:[innerWidth,innerHeight]})')
   raise AssertionError((label,probe))
  assert frame.locator('#mobilePanelButtons').is_visible()==phone,label
  assert frame.locator('#missionCard').is_visible()!=phone,label
  assert frame.locator('#quickbar').is_visible()!=phone,label
  if phone:
   for selector in ['#missionToggle','#workToggle','#missionCard','#quickbar']:
    assert frame.locator(selector).evaluate("el=>{const style=getComputedStyle(el);return style.userSelect||style.webkitUserSelect}")=='none'
   frame.locator('#missionToggle').click();assert frame.locator('#missionCard').is_visible()
   assert frame.locator('#missionToggle').get_attribute('aria-expanded')=='true'
   frame.locator('#missionCard .panel-collapse').click();assert frame.locator('#missionCard').is_hidden()
   frame.locator('#missionToggle').click();frame.locator('#missionCard .panel-close').click()
   assert frame.locator('#missionCard').is_hidden()
   frame.locator('#workToggle').click();assert frame.locator('#quickContent').is_visible()
   frame.locator('#missionToggle').click();assert frame.locator('#quickbar').is_hidden()
   frame.locator('#missionToggle').click();assert frame.locator('#missionCard').is_hidden()
   frame.locator('#workToggle').click()
   before=frame.evaluate('({...qaEngine.player})');frame.locator('#routeBtn').click()
   after=frame.evaluate('({...qaEngine.player})')
   assert all(after[axis]==before[axis] for axis in ['x','z'])
   assert frame.locator('#quickbar').is_hidden()
   frame.locator('#missionToggle').click();page.keyboard.press('Escape')
   assert frame.locator('#missionCard').is_hidden()
   frame.locator('#missionToggle').click();frame.locator('#scene').click(position={'x':width*.5,'y':height-105})
   assert frame.locator('#missionCard').is_hidden()
   if label=='celular' and args.capture:
    page.clock.fast_forward(3300);frame.evaluate('()=>document.activeElement.blur()')
    frame.evaluate("()=>{Object.assign(qaEngine.player,{x:-5.2,z:-.25,dir:Math.PI});qaEngine.yaw=0;qaEngine.cameraScale=1}");draw(frame)
    page.screenshot(path=str(ROOT/'docs/previa-celular-hud.png'),animations='disabled')
  frame.evaluate("()=>Object.assign(qaEngine.player,{x:-10.7,z:-.80})");draw(frame)
  frame.locator('#actionBtn').click();draw(frame)
  assert frame.locator('#mobilePanelButtons').is_hidden()
  results=[]
  for question in range(2):
   assert frame.locator('#dialogueChoices button').count()==0
   assert frame.evaluate('qaEngine.events.isTalking()')
   page.clock.fast_forward(13000);draw(frame)
   m=metrics(frame);results.append(m)
   assert abs(m['ratio']-(.5 if phone else .25))<.002,(label,m)
   assert m['questionFont']==m['answerFont']=='16px',(label,m)
   assert not m['overflow'],(label,m)
   if phone:
    head=speaker_bounds(frame)
    assert head['top']>=0 and head['bottom']<m['top']-4,(label,head,m)
    if width>height:assert m['questionRight']<=m['choicesLeft']+1,(label,m)
    else:assert m['questionBottom']<=m['choicesTop']+1,(label,m)
    if label in ['celular','celular-compacto']:assert not m['answerScroll'],(label,question,m)
    frame.locator('#dialogueChoices').evaluate('el=>{el.scrollTop=el.scrollHeight}')
    assert abs(frame.locator('#dialogueText').bounding_box()['y']-m['questionTop'])<1
    frame.locator('#dialogueChoices').evaluate('el=>{el.scrollTop=0}')
    if label=='celular' and question==0 and args.capture:page.screenshot(path=str(ROOT/'docs/previa-celular-dialogo.png'),animations='disabled')
   reply='Aceitar a explicação verbal' if label in ['celular','celular-compacto'] and question==0 else 'Solicitar registros' if question==0 else 'Ouvir as preocupações'
   frame.locator('#dialogueChoices button').filter(has_text=reply).click()
   assert not frame.evaluate('qaEngine.events.isTalking()')
   frame.locator('#dialogueContinue').click()
  frame.locator('#openPlan').click();frame.locator('[data-inc="docs"]').click();frame.locator('#startExecution').click();draw(frame)
  if phone:
   assert frame.locator('#quickbar').is_hidden()
   frame.locator('#workToggle').click();assert frame.locator('#reportBtn').is_visible()
   assert 'consumido' in frame.locator('#quickContent').inner_text()
   frame.locator('#reportBtn').click();assert frame.locator('#quickbar').is_hidden()
   frame.locator('#modalClose').click();assert frame.locator('#quickbar').is_hidden()
   frame.locator('#workToggle').click();frame.locator('#quickbar .panel-close').click()
   assert frame.locator('#workToggle').get_attribute('aria-expanded')=='false'
  assert not errors,(label,errors)
  assert frame.evaluate('qaEngine.gl.getError()')==0,label
  print(json.dumps({'device':label,'phone':phone,'dialogue':results,'errors':errors}),flush=True)
  page.close()
 browser.close()
