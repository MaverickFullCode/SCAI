"""Confere as seis ordens possíveis e o vínculo entre alternativa e feedback."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent.parent
hook="window.requestAnimationFrame=()=>0;Object.defineProperty(window,'SCAI3D',{configurable:true,set(api){const Base=api.Engine;api.Engine=class extends Base{constructor(...args){super(...args);window.qaEngine=this}};Object.defineProperty(window,'SCAI3D',{value:api})}})"
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True)
 orders=[set(),set()]
 try:
  for first in range(3):
   for second in range(2):
    ctx=browser.new_context(viewport={'width':1365,'height':864});page=ctx.new_page();page.add_init_script(hook)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    try:
     page.goto((root/'SCAI.html').as_uri());page.locator('#heroPlay').click();f=page.frames[-1];f.locator('#startMission').click()
     f.evaluate('''randoms=>{let i=0;Math.random=()=>randoms[i++%randoms.length];Object.assign(qaEngine.player,{x:-10.7,z:-.8,dir:Math.PI});for(let i=0;i<6;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render()}''',[first/3+.01,second/2+.01])
     page.clock.install();page.keyboard.press('q')
     for question in range(2):
      assert f.locator('#dialogueChoices button').count()==0
      page.clock.fast_forward(13000)
      options=f.locator('#dialogueChoices button')
      assert options.count()==3
      labels=options.locator('strong').all_text_contents();assert labels==['A','B','C'],labels
      texts=options.evaluate_all('buttons=>buttons.map(b=>b.textContent.slice(1).trim())');assert len(set(texts))==3
      orders[question].add(tuple(texts))
      good=(first+second+question)%2==0
      answer=('Solicitar registros' if good else 'Aceitar a explicação verbal') if question==0 else ('Ouvir as preocupações' if good else 'Garantir um parecer positivo')
      options.filter(has_text=answer).click()
      assert f.locator('#dialogueStep').inner_text()==('BOA CONDUÇÃO' if good else 'REVEJA A DECISÃO')
      assert f.locator('#dialogueText').inner_text().startswith(('Excelente.' if good else 'A indagação') if question==0 else ('Correto.' if good else 'Prometer uma opinião'))
      f.locator('#dialogueContinue').click()
     assert f.locator('#openPlan').is_visible()
     assert not errors,errors
    finally:
     page.clock.resume();ctx.close()
  assert all(len(order)==6 for order in orders),[len(o) for o in orders]
  print(json.dumps({'ordersPerQuestion':[len(o) for o in orders],'letters':'A/B/C','correctAndWrongFeedback':True,'errors':[]}),flush=True)
 finally:browser.close()
