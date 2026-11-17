"""Unified customer flow against synthetic official rows and verified market data."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import parse_qs, urlparse
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os
flow = [dict(page_id=f'P{n}', order=n, title=f'P{n}', enabled=True) for n in range(1,8)]
tables = {'自動滾存':[dict(policy_year=y,multiplier=1.2+y/100) for y in [8,13,14,15]]}
bootstrap = dict(flow=flow,page_content=[],routing=[],current_methods=[],withdrawal_strategies=[],return_tables=tables)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
Thread(target=server.serve_forever,daemon=True).start()
def route_official(route):
    action=parse_qs(urlparse(route.request.url).query).get('action',[''])[0]
    data={'bootstrap':bootstrap,'content':{k:bootstrap[k] for k in ['flow','page_content','routing','current_methods','withdrawal_strategies']},'returns':tables,'version':{}}.get(action,{})
    route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'data':data}))
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if os.path.exists('/usr/bin/chromium') else {}),args=['--no-sandbox'])
  for width,height in [(320,800),(390,844),(412,914),(834,1194),(1194,834),(1800,1200)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},service_workers='block'); page=ctx.new_page(); errors=[]
   page.on('pageerror',lambda e:errors.append(str(e))); page.route('**/exec?*',route_official); page.goto(f'http://127.0.0.1:{server.server_port}/')
   assert page.locator('#page-title').inner_text() == '平時多出嚟嘅錢，你通常會點安排？'
   assert page.locator('[data-action="toggle-unified-tool"]').count()==4
   if width==390: page.screenshot(path='docs/screenshots/unified-flow/p1.png',full_page=True)
   page.locator('[data-value="cash"]').click(); page.locator('[data-value="fixed_deposit"]').click(); page.locator('[data-value="market"]').click()
   assert page.locator('[data-action="toggle-unified-tool"][aria-pressed="true"]').count()==3
   page.locator('[data-action="continue-unified-tools"]').click(); assert page.locator('[data-action="select-unified-purpose"]').count()==4
   if width==390: page.screenshot(path='docs/screenshots/unified-flow/p2.png',full_page=True)
   page.locator('[data-action="select-unified-purpose"][data-value="future"]').click()
   assert page.locator('#page-title').inner_text() == '如果將時間加落去呢？'
   for key in ['fixed_deposit','market']: assert page.locator(f'details[data-optional="{key}"]').evaluate('(e)=>e.open')
   assert page.locator('.market-path').is_visible(); assert page.locator('[data-action="select-market-history-series"]').count()==4
   page.locator('#customer-age').fill('40'); page.locator('#annual-contribution').fill('50000'); page.locator('#existing-deposit').fill('200000')
   page.locator('[data-holding-field="principal"]').first.fill('300000'); page.locator('[data-holding-field="termYears"]').first.fill('2'); page.locator('[data-holding-field="annualRate"]').first.fill('3')
   page.locator('[data-action="add-holding"]').click(); assert page.locator('[data-holding-field="principal"]').count()==2
   assert page.locator('details[data-optional="market"]').evaluate('(e)=>e.open')
   page.locator('details[data-optional="market-simulator"] summary').click(); page.locator('[data-market-principal]').fill('100000')
   assert '歷史模擬結果' in page.locator('[data-market-result]').inner_text()
   page.locator('[data-market-end]').select_option('2023'); assert '2023' in page.locator('[data-market-result]').inner_text()
   page.locator('[data-action="select-market-history-series"][data-value="spy"]').click(); assert page.locator('details[data-optional="market-simulator"]').evaluate('(e)=>e.open')
   assert page.locator('[data-market-principal]').input_value()=='100,000'
   if width==390:
    page.evaluate('window.scrollTo(0,0)'); page.screenshot(path='docs/screenshots/unified-flow/p3-expanded.png',full_page=True)
   page.locator('details[data-optional="fixed_deposit"] > summary').click(); page.locator('details[data-optional="market"] > summary').click()
   if width==390:
    page.evaluate('window.scrollTo(0,0)'); page.screenshot(path='docs/screenshots/unified-flow/p3-collapsed.png',full_page=True)
   page.locator('details[data-optional="fixed_deposit"] > summary').click(); assert page.locator('[data-holding-field="principal"]').first.input_value()=='300,000'
   page.locator('[data-action="next"]').click(); assert page.locator('#page-title').inner_text()=='無須改變現有安排，新增儲蓄發掘更多可能性？'
   assert page.locator('#comparison-time-rail').count()==1; story=page.locator('[data-p4-design="unified"]')
   assert story.locator('.p4-colored-bar').count()==2; assert story.locator('.p4-bar-title strong:nth-child(2)').all_inner_texts()==['HK$ 750,000','HK$ 750,000']
   assert '☁️ 今期定期到期後' in story.inner_text() and '☁️ 市場冇水晶球' in story.inner_text()
   assert story.locator('.p4-simple-outcome strong').all_inner_texts()==['HK$ 950,000','HK$ 1,037,500']
   if width==390:
    page.evaluate('window.scrollTo(0,0)'); page.screenshot(path='docs/screenshots/unified-flow/p4.png',full_page=True)
   page.locator('#comparison-time-rail [data-value="8"]').click(); assert story.locator('.p4-bar-title strong:nth-child(2)').all_inner_texts()==['HK$ 400,000','HK$ 400,000']
   assert story.locator('.p4-simple-outcome strong').all_inner_texts()==['HK$ 600,000','HK$ 670,000']
   page.locator('[data-action="back"]').click(); assert page.locator('details[data-optional="fixed_deposit"]').evaluate('(e)=>e.open'); assert not page.locator('details[data-optional="market"]').evaluate('(e)=>e.open')
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'); assert not errors,errors
   ctx.close()
  ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block'); page=ctx.new_page(); page.route('**/exec?*',route_official)
  page.add_init_script('localStorage.setItem("ava-saving-user-overrides-v1", JSON.stringify({pages:{P1:{title:"自訂標題"}},cards:{"unified-p1-cash":{headline:"自訂銀行"}}}))')
  page.goto(f'http://127.0.0.1:{server.server_port}/'); assert page.locator('#page-title').inner_text()=='自訂標題'; assert page.locator('[data-value="cash"] strong').inner_text()=='自訂銀行'
  page.locator('[data-value="cash"]').click(); page.locator('[data-action="continue-unified-tools"]').click(); page.locator('[data-action="select-unified-purpose"]').first.click()
  assert not page.locator('details[data-optional="fixed_deposit"]').evaluate('(e)=>e.open'); assert not page.locator('details[data-optional="market"]').evaluate('(e)=>e.open')
  page.locator('#customer-age').fill('40'); page.locator('#annual-contribution').fill('50000'); page.locator('#existing-deposit').fill('200000')
  assert page.locator('details[data-optional="fixed_deposit"]').evaluate('(e)=>!e.open')
  assert page.locator('details[data-optional="market"]').evaluate('(e)=>!e.open')
  page.locator('[data-action="next"]').click()
  story=page.locator('[data-p4-design="unified"]')
  assert story.locator('.p4-colored-bar').count()==2
  assert story.locator('.resource-card').count()==0
  assert story.get_by_role('heading',name='你現有嘅工具，繼續各自發揮作用').count()==0
  assert '今期定期到期後' not in story.inner_text()
  assert '市場冇水晶球' not in story.inner_text()
  assert page.locator('.p4-common-principal strong').inner_text()=='HK$ 200,000'
  ctx.close(); browser.close()
finally: server.shutdown()
print('Unified flow passed on six viewport sizes')
