"""Capture real Swagger and Categories HTTP evidence using installed Edge.
Run while BidNet is serving http://localhost:5014 (or pass another base URL).
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).parent
shots = root / 'screenshots'
base = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5014').rstrip('/')
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
    page.goto(base + '/swagger', wait_until='networkidle', timeout=30000)
    assert page.get_by_text('Categories', exact=True).count() > 0, 'Swagger missing Categories group'
    assert page.get_by_text('Orders', exact=True).count() > 0, 'Swagger missing Orders group'
    assert page.get_by_text('Notifications', exact=True).count() > 0, 'Swagger missing Notifications group'
    page.screenshot(path=str(shots / '04-swagger-7-tables.png'), full_page=False)
    print('Swagger includes Categories, Orders, Notifications:', page.url)

    # Collapse unrelated tags and scroll to the three newly added API groups.
    for name in ('Admin', 'Auth', 'Errors', 'Product', 'ProductImages', 'User'):
        page.locator('.opblock-tag').filter(has_text=name).first.click()
    page.locator('.opblock-tag').filter(has_text='Categories').first.evaluate(
        '(el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12)')
    page.screenshot(path=str(shots / '06-swagger-new-groups.png'), full_page=False)

    response = page.request.get(base + '/api/categories')
    data = response.json()
    assert response.status == 200 and isinstance(data, list) and len(data) >= 4
    page.goto(base + '/api/categories', wait_until='load', timeout=30000)
    pretty = page.locator('input[type="checkbox"]')
    if pretty.count():
        pretty.first.check()
    page.screenshot(path=str(shots / '05-categories-response.png'), full_page=False)
    print(f'GET /api/categories: {response.status}, {len(data)} items')
    browser.close()
