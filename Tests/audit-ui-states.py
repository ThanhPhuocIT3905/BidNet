"""Isolated browser state checks; mutations are intercepted, never persisted."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

session = {'accessToken': 'isolated-ui-fixture', 'user': {
    'id': 999, 'username': 'ui-admin', 'fullName': 'UI Admin', 'role': 'Admin', 'isActive': True}}
checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    for width in [390, 768, 1440]:
        for theme in ['light', 'dark']:
            context = browser.new_context(viewport={'width': width, 'height': 960})
            context.add_init_script(f"sessionStorage.setItem('bidnet.session',{json.dumps(json.dumps(session))});localStorage.setItem('bidnet.theme','{theme}');")
            page = context.new_page()
            page.route('**/api/users/me', lambda route: route.fulfill(status=200, json=session['user'],
                headers={'Access-Control-Allow-Origin': 'http://localhost:3000'}))
            mode = {'value': 'empty'}
            def respond(route):
                if route.request.method == 'OPTIONS':
                    route.continue_()
                    return
                headers = {'Access-Control-Allow-Origin': 'http://localhost:3000'}
                if route.request.method == 'POST':
                    route.fulfill(status=200, json={'id': 999, 'name': 'Isolated UI'}, headers=headers)
                elif mode['value'] == 'error':
                    route.fulfill(status=503, json={'message': 'Temporary test failure'}, headers=headers)
                else:
                    route.fulfill(status=200, json=[], headers=headers)
            page.route('**/api/Categories', respond)
            page.goto('http://localhost:3000/#/admin/categories')
            expect(page.get_by_role('heading', name='Chưa có danh mục', exact=True)).to_be_visible()
            page.get_by_role('button', name='+ Thêm danh mục').click()
            page.locator('#catName').fill('Isolated UI')
            page.get_by_role('button', name='Lưu danh mục').click()
            expect(page.locator('dialog[open]')).to_have_count(0)
            expect(page.locator('#toast')).to_contain_text('Đã lưu danh mục')
            mode['value'] = 'error'
            page.reload()
            expect(page.get_by_role('alert')).to_contain_text('Temporary test failure')
            mode['value'] = 'empty'
            page.get_by_role('button', name='Thử lại').click()
            expect(page.get_by_role('heading', name='Chưa có danh mục', exact=True)).to_be_visible()
            checks.append({'width': width, 'theme': theme, 'empty': True, 'success': True, 'errorRetry': True})
            context.close()
    browser.close()
out = Path(__file__).resolve().parents[1] / 'docs/qa/ui-state-results.json'
out.write_text(json.dumps(checks, indent=2), encoding='utf-8')
print(f'PASS: {len(checks)} viewport/theme combinations: empty, modal save success, error and retry')
