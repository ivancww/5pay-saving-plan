"""Optional local Chromium check for customer interactions and responsive layout.

Run from the repository root with Playwright's Python package and Chromium.
It serves this repository on localhost and mocks only the Official GET endpoint;
the exact return rows come from the checked-in evidence fixture.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import parse_qs, urlparse
import json

from playwright.sync_api import sync_playwright


evidence = json.loads(Path('research/evidence/official-return-audit-2026-10-01.json').read_text())
flow = [dict(page_id=f'P{number}', order=number, title=f'P{number}', subtitle='', enabled=True) for number in range(1, 8)]
content = [
    dict(page_id='P1', content_id='method-none', action_key='none', headline='未有安排', subtext='', order=1, enabled=True),
    dict(page_id='P2', content_id='purpose-future', action_key='future', headline='為未來準備', subtext='', order=1, enabled=True),
]
bootstrap = dict(flow=flow, page_content=content, routing=[], current_methods=[],
                 withdrawal_strategies=evidence['withdrawal_strategies'], return_tables=evidence['return_tables'])


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
Thread(target=server.serve_forever, daemon=True).start()
base_url = f'http://127.0.0.1:{server.server_port}/'


def official_response(route):
    action = parse_qs(urlparse(route.request.url).query).get('action', [''])[0]
    data = {'bootstrap': bootstrap, 'content': {key: bootstrap[key] for key in ['flow', 'page_content', 'routing', 'current_methods', 'withdrawal_strategies']},
            'returns': evidence['return_tables'], 'version': dict(data_version='browser-fixture')}[action]
    route.fulfill(status=200, content_type='application/json', body=json.dumps(dict(ok=True, data=data)))


def open_page(browser, width, height=900):
    context = browser.new_context(viewport=dict(width=width, height=height), service_workers='block')
    page = context.new_page()
    page.route('**/exec?*', official_response)
    page.goto(base_url, wait_until='domcontentloaded')
    page.locator('[data-action="select-scenario"]').first.wait_for()
    return context, page


def no_overflow(page, label):
    size = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
    assert size['scroll'] <= size['width'], (label, size)


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
        for width, label in [(320, 'narrow phone'), (360, 'iPhone size'), (390, 'Android portrait'),
                             (412, 'folded phone'), (834, 'iPad portrait'), (1194, 'iPad landscape'),
                             (1800, 'unfolded/desktop')]:
            context, page = open_page(browser, width)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            no_overflow(page, f'{label} entry')
            page.locator('[data-value="scenario3"]').click()
            assert page.locator('.goal-triangle').is_visible()
            for goal in ['stability', 'flexibility', 'growth']:
                page.locator(f'[data-action="toggle-goal"][data-value="{goal}"]').click()
            assert page.locator('.goal-point.is-selected').count() == 3
            no_overflow(page, f'{label} triangle')
            page.locator('[data-action="continue-goals"]').click()
            assert page.locator('.tradeoff-node.is-selected').count() == 3
            no_overflow(page, f'{label} tradeoff')
            page.locator('[data-action="back"]').click()
            assert page.locator('.goal-point.is-selected').count() == 3
            assert not errors, (label, errors)
            context.close()

        context, page = open_page(browser, 390)
        page.locator('[data-value="scenario2"]').click()
        assert page.locator('[data-action="toggle-investment-tool"]').count() == 4
        page.locator('[data-action="toggle-investment-tool"][data-value="stock"]').click()
        page.locator('[data-action="continue-investment-tools"]').click()
        assert page.locator('.market-path').is_visible()
        no_overflow(page, 'market path')
        page.locator('[data-action="select-market-response"][data-value="hold"]').click()
        page.locator('[data-action="back"]').click()
        assert page.locator('.tool-card.is-selected').count() == 1
        page.locator('[data-action="continue-investment-tools"]').click()
        assert page.locator('.response-card.is-selected').count() == 1
        page.locator('[data-action="continue-to-saving"]').click()
        assert page.locator('[data-action="select-purpose"]').count() == 1
        assert page.locator('#page-title').inner_text() == '你希望呢筆錢將來用喺邊？'
        page.locator('[data-action="select-purpose"]').first.click()
        page.locator('#annual-contribution').fill('50000')
        page.locator('#customer-age').fill('40')
        page.locator('[data-action="next"]').click()
        assert page.locator('#comparison-time-rail').is_visible()
        page.locator('[data-action="next"]').click()
        page.locator('[data-action="add-saving-phase"]').click()
        page.locator('[data-action="add-saving-phase"]').click()
        assert page.locator('[data-saving-phase]').count() == 3
        page.locator('[data-action="next"]').click()
        assert page.locator('#accumulation-time-rail').is_visible()
        page.locator('[data-action="next"]').click()
        assert page.locator('[data-withdrawal-phase]').count() == 3
        page.locator('[data-action="customer-view"]').click()
        assert page.locator('[data-action="print"]').is_visible()
        no_overflow(page, 'three phase Customer View')
        context.close()

        for tools, expected in [(['fixed_deposit'], 'S2_MATURITY'), (['bond'], 'S2_MATURITY'),
                                (['etf', 'bond'], 'S2_MIXED')]:
            context, page = open_page(browser, 320)
            page.locator('[data-value="scenario2"]').click()
            for tool in tools:
                page.locator(f'[data-action="toggle-investment-tool"][data-value="{tool}"]').click()
            page.locator('[data-action="continue-investment-tools"]').click()
            if expected == 'S2_MATURITY':
                assert page.locator('.maturity-visual').is_visible()
                page.locator('[data-action="select-maturity-response"][data-value="renew"]').click()
                assert page.locator('.horizon-line').is_visible()
            else:
                assert page.locator('.market-path').is_visible()
                page.locator('[data-action="select-market-response"][data-value="hold"]').click()
                assert page.locator('[data-action="continue-market-to-maturity"]').is_visible()
                page.locator('[data-action="continue-market-to-maturity"]').click()
                assert page.locator('.maturity-visual').is_visible()
                page.locator('[data-action="select-maturity-response"][data-value="compare"]').click()
                page.locator('[data-action="continue-maturity-to-mixed"]').click()
                assert page.locator('[data-action="select-mixed-focus"]').count() == 2
                page.locator('[data-action="back"]').click()
                assert page.locator('[data-value="compare"][aria-pressed="true"]').count() == 1
                page.locator('[data-action="back"]').click()
                assert page.locator('[data-value="hold"][aria-pressed="true"]').count() == 1
                page.locator('[data-action="back"]').click()
                assert page.locator('.tool-card.is-selected').count() == 2
                page.locator('[data-action="continue-investment-tools"]').click()
                page.locator('[data-action="select-market-response"][data-value="hold"]').click()
                page.locator('[data-action="continue-market-to-maturity"]').click()
                page.locator('[data-action="select-maturity-response"][data-value="compare"]').click()
                page.locator('[data-action="continue-maturity-to-mixed"]').click()
            no_overflow(page, f'{tools} {expected}')
            context.close()

        context, page = open_page(browser, 390)
        page.locator('[data-value="scenario1"]').click()
        assert page.locator('[data-action="select-method"]').count() == 1
        page.locator('[data-action="select-method"]').click()
        page.locator('[data-action="select-purpose"]').click()
        assert page.locator('#p3-current-path-value').is_visible()
        page.locator('[data-action="next"]').click()
        assert page.locator('[role="alert"]').is_visible()
        page.locator('#annual-contribution').fill('50000')
        assert page.evaluate('document.activeElement.id') == 'annual-contribution'
        page.locator('#customer-age').fill('40')
        page.locator('[data-action="next"]').click()
        assert page.locator('.comparison-stack').is_visible()
        context.close()

        context, page = open_page(browser, 390)
        page.goto(base_url + '?avaEntry=user', wait_until='domcontentloaded')
        page.locator('#edit-title').fill('我哋由邊度開始？')
        page.locator('[data-action="preview"]').click()
        assert page.locator('#page-title').inner_text() == '我哋由邊度開始？'
        page.locator('[data-action="save-preview"]').click()
        page.reload(wait_until='domcontentloaded')
        assert page.locator('#page-title').inner_text() == '我哋由邊度開始？'
        context.close()
        browser.close()
finally:
    server.shutdown()

print('Chromium customer clicks and no-overflow checks passed at 320/360/390/412/834/1194/1800px')
