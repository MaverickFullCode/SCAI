"""Fluxo real da revisão de textos/plano: python tests/textos-plano-runtime.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, tempfile
ROOT=Path(__file__).resolve().parent.parent
HOOK="""window.requestAnimationFrame=()=>0;Object.defineProperty(window,'SCAI3D',{configurable:true,set(api){const Base=api.Engine;api.Engine=class extends Base{constructor(...args){super(...args);window.qaEngine=this}};Object.defineProperty(window,'SCAI3D',{value:api})}});"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',args=['--no-first-run'])
 try:
  for profile,width,height,success in [('computador',1365,864,True),('celular',390,844,True),('tablet',1024,768,True),('saldo-insuficiente',1365,864,False)]:
   opts=dict(viewport={'width':width,'height':height})
   if profile in ['celular','tablet']: opts.update(is_mobile=True,has_touch=True,user_agent=pw.devices['iPhone 13' if profile=='celular' else 'iPad (gen 7)']['user_agent'])
   context=browser.new_context(**opts);page=context.new_page();page.add_init_script(HOOK);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    page.goto((ROOT/'SCAI.html').as_uri());assert page.locator('#sobre').inner_text().find('8 créditos')>=0
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#heroPlay').click();f=page.frames[-1];f.locator('#startMission').click()
    f.evaluate("""async()=>{await SCAIGraphics.ready;await SCAIMaterials.decode();await SCAICharacterMaterials.decode();window.place=(x,z)=>{Object.assign(qaEngine.player,{x,z});for(let i=0;i<6;i++){qaEngine.update(1/60);qaEngine.events.onFrame(qaEngine)}qaEngine.render()};place(-10.7,-.8);} """)
    page.clock.install();page.keyboard.press('q')
    for text in (['Comparar os registros','Combinar um prazo'] if success else ['Repetir a contagem','Concluir agora']):
     assert f.locator('#dialogueChoices button').count()==0
     page.clock.fast_forward(18000)
     assert f.locator('#dialogueChoices button').count()==3
     if profile=='celular':
      assert abs(f.locator('#dialoguePanel').bounding_box()['height']-height*.5)<3
      assert f.locator('#dialogueChoices').evaluate('e=>e.scrollWidth<=e.clientWidth')
     f.locator('#dialogueChoices button').filter(has_text=text).click();assert ('Você acertou' in f.locator('#dialogueText').inner_text()) == success;f.locator('#dialogueContinue').click()
    f.locator('#openPlan').click();assert f.locator('select.priority').count()==0
    # Docs is deliberately left out: executing it must record one change without a bonus.
    plan=['count','recalc','analytics'] if success else ['confirm','recalc','analytics']
    for key in plan:f.locator('[data-plan="'+key+'"]').check()
    if profile=='celular':
     f.locator('.modalCard').screenshot(path=str(Path(tempfile.gettempdir())/'scai-plano-simples-celular.png'))
     assert f.locator('.modalCard').evaluate('e=>e.scrollWidth<=e.clientWidth')
    assert not errors, errors
    assert f.locator('#startExecution').is_enabled(), f.locator('#modalBody').inner_text()
    f.locator('#startExecution').click()
    tests=[('docs',-4.3,2.8),('count',5.1,-.55),('recalc',-8.8,2.8),('analytics',-3.4,-4.45)] if success else [('confirm',14.15,1.4),('docs',-4.3,2.8),('recalc',-8.8,2.8),('analytics',-3.4,-4.45)]
    for key,x,z in tests:
     f.evaluate('([x,z])=>place(x,z)',[x,z]);page.keyboard.press('q');f.locator('#procChange' if key=='docs' else '#procGo').click();f.locator('#toScene').click()
     before=f.locator('#pointsText').inner_text();page.keyboard.press('q');assert f.locator('#procGo,#procChange').count()==0;assert 'Consulta gratuita' in f.locator('#modalBody').inner_text();f.locator('#procClose').click();assert f.locator('#pointsText').inner_text()==before
    assert f.locator('#pointsText').inner_text()=='0 créditos'
    if not success:
     f.evaluate('place(5.1,-.55)');page.keyboard.press('q');assert f.locator('#procChange').is_disabled();f.locator('#procClose').click()
    if profile=='celular':f.locator('#workToggle').click()
    f.locator('#reportBtn').click();f.locator('[data-opinion="qualified"]').click();f.locator('#finalize').click()
    assert f.locator('#modalTitle').inner_text()==('Missão concluída!' if success else 'Veja o que falta melhorar')
    assert 'mudanças de plano: 1' in f.locator('#modalBody').inner_text()
    if success:assert '100/100' in f.locator('#modalBody').inner_text()
    else:assert 'Contagem' in f.locator('#modalBody').inner_text()
    f.locator('#reviewConcepts').click();f.locator('#backResult').click();f.locator('#modalClose').click()
    assert f.locator('#stagebar .done').count()==(6 if success else 5)
    assert not errors,errors
    assert f.evaluate('qaEngine.gl.getError()')==0
    print(json.dumps({'profile':profile,'success':success,'errors':errors}),flush=True)
    page.clock.resume()
   finally:context.close()
 finally:browser.close()

