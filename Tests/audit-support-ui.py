"""Real support conversation through the UI; removes only this run's ticket."""
import json
import subprocess
import uuid
import requests
from playwright.sync_api import sync_playwright

prefix = 'QA-ui-' + uuid.uuid4().hex
sessions = {}
for role, name, password in [('buyer', 'bidder_demo', 'Demo@12345'), ('admin', 'admin', 'Admin@12345')]:
    response = requests.post('http://localhost:5014/api/auth/login', json={'usernameOrEmail': name, 'password': password})
    response.raise_for_status()
    sessions[role] = response.json()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        contexts = {}
        for role in sessions:
            context = browser.new_context(viewport={'width': 390, 'height': 960})
            context.add_init_script(f"sessionStorage.setItem('bidnet.session',{json.dumps(json.dumps(sessions[role]))});")
            contexts[role] = context
        buyer = contexts['buyer'].new_page()
        buyer.goto('http://localhost:3000/#/contact')
        buyer.locator('[name=subject]').fill(prefix)
        buyer.locator('[name=message]').fill('Kiểm tra trao đổi hỗ trợ')
        buyer.get_by_role('button', name='Gửi yêu cầu', exact=True).click()
        buyer.get_by_role('link', name='Xem trao đổi').click()
        buyer.get_by_role('heading', name=prefix, exact=False).wait_for()
        url = buyer.url
        admin = contexts['admin'].new_page()
        admin.goto(url)
        admin.get_by_label('Phản hồi', exact=True).fill('Đã kiểm tra yêu cầu')
        admin.get_by_role('button', name='Gửi phản hồi', exact=True).click()
        admin.get_by_text('Đã kiểm tra yêu cầu', exact=True).wait_for()
        admin.locator('select[name=status]').select_option('Resolved')
        with admin.expect_response(lambda r: '/status' in r.url and r.request.method == 'PATCH') as saved:
            admin.get_by_role('button', name='Lưu trạng thái').click()
        assert saved.value.status == 204, saved.value.text()
        admin.locator('section.form-wrap > p').filter(has_text='Đã giải quyết').wait_for()
        buyer.reload()
        buyer.get_by_text('Đã kiểm tra yêu cầu', exact=True).wait_for()
        buyer.get_by_label('Phản hồi', exact=True).fill('Cần hỗ trợ thêm')
        buyer.get_by_role('button', name='Gửi phản hồi', exact=True).click()
        buyer.locator('section.form-wrap > p').filter(has_text='Mới tiếp nhận').wait_for()
        assert not buyer.evaluate('document.documentElement.scrollWidth > innerWidth')
        browser.close()
    print('PASS: create, reply, resolve and reopen support through mobile UI')
finally:
    sql = f"""SET XACT_ABORT ON; BEGIN TRAN;
    DELETE FROM Notifications WHERE TicketId IN (SELECT Id FROM SupportTickets WHERE Subject=N'{prefix}');
    DELETE FROM AdminAuditLogs WHERE EntityType='SupportTicket' AND EntityId IN (SELECT Id FROM SupportTickets WHERE Subject=N'{prefix}');
    DELETE FROM SupportMessages WHERE TicketId IN (SELECT Id FROM SupportTickets WHERE Subject=N'{prefix}');
    DELETE FROM SupportTickets WHERE Subject=N'{prefix}'; COMMIT;"""
    subprocess.run(['sqlcmd', '-S', r'.\SQLEXPRESS', '-E', '-C', '-d', 'BidNetDb', '-b', '-Q', sql], check=True, capture_output=True)
