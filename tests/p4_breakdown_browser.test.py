"""Browser regression of the P4 breakdown against synthetic exact-year data."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import parse_qs, urlparse
import json
import os
from playwright.sync_api import sync_playwright

flow = [dict(page_id=f'P{n}', order=n, title=f'P{n}', enabled=True) for n in range(1, 8)]
content = [dict(page_id='P1', content_id=m, action_key=m, headline=m, order=i, enabled=True) for i, m in enumerate(['cash', 'fixed_deposit', 'bond'])]
content += [dict(page_id='P2', content_id='purpose', action_key='future', headline='future', order=1, enabled=True)]
tables = {'自動滾存': [dict(policy_year=y, multiplier=1.2 + y / 100) for y in [8, 13, 14, 15]]}
bootstrap = dict(flow=flow, page_content=content, routing=[], current_methods=[], withdrawal_strategies=[], return_tables=tables)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
def route_official(route):
    action = parse_qs(urlparse(route.request.url).query).get('action', [''])[0]
    data = {'bootstrap': bootstrap, 'content': {k: bootstrap[k] for k in ['flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies']}, 'returns': tables, 'version': {}}.get(action, {})
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'data': data}))
def row(card, label):
    return card.locator('.comparison-detail').filter(has=card.page.locator('span', has_text=label)).first.locator('strong').inner_text()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(**({'executable_path': '/usr/bin/chromium'} if os.path.exists('/usr/bin/chromium') else {}), args=['--no-sandbox'])
        for method in ['cash', 'fixed_deposit', 'bond']:
            for width, height in [(390,844),(412,914),(834,1194),(1194,834),(1800,1200)]:
                context = browser.new_context(viewport={'width':width,'height':height}, service_workers='block')
                page = context.new_page()
                errors=[]
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.route('**/exec?*', route_official)
                page.goto(f'http://127.0.0.1:{server.server_port}/')
                page.locator('[data-value="scenario1"]').click()
                page.locator(f'[data-action="select-method"][data-value="{method}"]').click()
                page.locator('[data-action="select-purpose"]').click()
                page.locator('#annual-contribution').fill('50000')
                page.locator('#customer-age').fill('40')
                page.locator('#existing-deposit').fill('200000')
                page.locator('#cash-rate').fill('2')
                if method != 'cash':
                    for field, value in [('principal','300000'),('termYears','2'),('annualRate','3')]:
                        page.locator(f'[data-holding-field="{field}"]').first.fill(value)
                    page.locator('[data-action="add-holding"]').click()
                    for field, value in [('principal','100000'),('termYears','1'),('annualRate','4')]:
                        page.locator(f'[data-holding-field="{field}"]').nth(1).fill(value)
                page.locator('[data-action="next"]').click()
                left=page.locator('[data-breakdown="current"]'); right=page.locator('[data-breakdown="saving"]')
                assert not left.evaluate('(e)=>e.open') and not right.evaluate('(e)=>e.open')
                left.locator('summary').click(); assert left.evaluate('(e)=>e.open') and not right.evaluate('(e)=>e.open')
                right.locator('summary').click(); assert left.evaluate('(e)=>e.open') and right.evaluate('(e)=>e.open')
                assert 'HK$ 750,000' in left.inner_text() and 'HK$ 950,000' in left.inner_text(), left.inner_text()
                assert 'HK$ 250,000' in right.inner_text() and 'HK$ 700,000' in right.inner_text()
                assert 'HK$ 337,500' in right.inner_text()
                for detail in (left, right):
                    card = detail.locator('xpath=..')
                    summary_total = card.locator('.comparison-card-total strong').first.inner_text()
                    detail_total = detail.locator('.comparison-detail strong').last.inner_text()
                    assert summary_total == detail_total
                if method != 'cash':
                    assert page.locator('.instrument-p4-detail').count()==2
                    assert '到期之後下一期息率' in page.locator('.p4-instrument-card').inner_text()
                for year in [8,13,14,15]:
                    page.locator(f'#comparison-time-rail [data-value="{year}"]').click()
                    assert left.evaluate('(e)=>e.open') and right.evaluate('(e)=>e.open')
                    assert f'第 {year} 年' in left.inner_text()
                    assert f'HK$ {50000*year:,}' in left.inner_text()
                left.locator('summary').click(); assert not left.evaluate('(e)=>e.open') and right.evaluate('(e)=>e.open')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                assert left.locator('summary').evaluate('(e)=>e.getBoundingClientRect().height') >= 44
                page.locator('[data-action="back"]').click()
                page.locator('#annual-contribution').fill('60000')
                page.locator('#existing-deposit').fill('300000')
                page.locator('#cash-rate').fill('3')
                page.locator('[data-action="next"]').click()
                assert not left.evaluate('(e)=>e.open') and not right.evaluate('(e)=>e.open')
                left.locator('summary').click(); right.locator('summary').click()
                assert 'HK$ 300,000' in left.inner_text() and 'HK$ 60,000' in left.inner_text()
                assert '3%' in left.inner_text() and 'HK$ 300,000' in right.inner_text()
                assert not errors, errors
                context.close()
        context = browser.new_context(service_workers='block')
        market = context.new_page()
        market.route('**/exec?*', route_official)
        market.goto(f'http://127.0.0.1:{server.server_port}/')
        market.locator('[data-value="scenario2"]').click()
        market.locator('[data-action="toggle-investment-tool"][data-value="stock"]').click()
        market.locator('[data-action="continue-investment-tools"]').click()
        market.locator('[data-market-end]').select_option('2023')
        md = market.locator('[data-breakdown="market"]')
        md.locator('summary').click()
        assert '恒生指數' in md.inner_text() and '2016' in md.inner_text() and '2023' in md.inner_text()
        assert '22000.56' in md.inner_text() and '17047.4' in md.inner_text()
        assert '歷史表現不保證未來回報' in md.inner_text()
        assert 'HK$ -' in md.inner_text()
        market.locator('[data-market-principal]').fill('200000')
        assert md.evaluate('(e)=>e.open') and 'HK$ 200,000' in md.inner_text()
        context.close()
        # Render unavailable and partially available official phases directly with the real view.
        page = browser.new_page()
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
        result = page.evaluate("""async () => {
          const {render} = await import('/src/views.js');
          const {createState} = await import('/src/state.js');
          const state=createState({currentAge:40}); state.pageId='P4';
          Object.assign(state.session,{scenario:'scenario1',currentMethod:'cash',annualContribution:50000,policyYear:15,assumptions:{existingDeposit:200000,cashRate:2}});
          const official={flow:[{page_id:'P4'}],page_content:[],current_methods:[],strategyMap:{none:'none'},return_tables:{none:[{policy_year:15,multiplier:1.2}]}};
          const app=document.createElement('div');
          // Existing timeline offers year 15, but no official row for fair comparison when the mapping is absent.
          official.return_tables.none[0].multiplier='unavailable';
          render(app,state,official); const missing=app.textContent;
          state.session.scenario='scenario2'; state.session.savingPhases=[{id:1},{id:2,annualContribution:60000}];
          official.return_tables.none[0].multiplier=1.2; render(app,state,official);
          return {missing,partial:app.textContent};
        }""")
        assert '官方價值' in result['missing'] and '未能計算' in result['missing']
        assert '部分期數未有官方價值' in result['partial']
        page.close()
        browser.close()
finally:
    server.shutdown()
print('P4 cash, fixed deposit and bond browser interactions passed at five viewport sizes')
