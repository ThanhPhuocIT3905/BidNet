"""Targeted UI: profile + admin order detail at mobile/desktop, seller avatar card."""
import json
import time
import requests
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5014'
SHOTS = r'C:\Users\works\AppData\Local\Temp\opencode\bidnet-workflow-audit'


def login(username, password):
    for _ in range(7):
        r = requests.post(BASE + '/api/auth/login',
                          json={'usernameOrEmail': username, 'password': password}, timeout=30)
        if r.status_code != 429:
            r.raise_for_status()
            return r.json()
        time.sleep(10)
    r.raise_for_status()


admin = login('admin', 'Admin@12345')
buyer = login('bidder_demo', 'Demo@12345')
orders = requests.get(BASE + '/api/orders?page=1',
                      headers={'Authorization': 'Bearer ' + admin['accessToken']}, timeout=30).json()
order_id = orders['items'][0]['id'] if orders.get('items') else None
product = requests.get(BASE + '/api/products/1', timeout=30).json()
assert 'sellerAvatarUrl' in product and product.get('sellerJoinedAt')

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    cases = [('profile', buyer, '/#/profile'), ('admin-order', admin, f'/#/admin/orders/{order_id}')]
    for name, session, url in cases:
        for theme, width in [('dark', 390), ('light', 1440)]:
            context = browser.new_context(viewport={'width': width, 'height': 960})
            context.add_init_script(
                f"localStorage.setItem('bidnet.theme',{json.dumps(theme)});"
                f"sessionStorage.setItem('bidnet.session',{json.dumps(json.dumps(session))});")
            page = context.new_page()
            errors = []
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto('http://localhost:3000' + url, wait_until='networkidle')
            if name == 'profile':
                page.get_by_role('heading', name='Hồ sơ cá nhân').wait_for()
                for selector in ['#fullName', '#dateOfBirth', '#gender', '#contactAddress',
                                 '#phoneNumber', '#currentPassword', 'input[type=file]']:
                    assert page.locator(selector).count() == 1, selector
                assert page.get_by_text('Giới thiệu bản thân').count() == 0
                assert page.locator('.profile-identity .avatar').count() == 1
            else:
                page.get_by_text(f'#{order_id}', exact=False).first.wait_for()
                assert page.get_by_role('link', name='← Danh sách đơn').count() == 1
                assert page.locator('.admin-nav a[aria-current=page]').count() == 1
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
            assert not errors, errors[:3]
            page.screenshot(path=fr'{SHOTS}\{name}-{theme}-{width}.png', full_page=True)
            context.close()
    browser.close()
print('PASS: profile + admin order detail UI, order', order_id)
