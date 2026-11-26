"""Profile page UI: attributes, avatar upload/remove, save and responsive layout."""
import json
import requests
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5014'
login = requests.post(BASE + '/api/auth/login', json={'usernameOrEmail': 'bidder_demo', 'password': 'Demo@12345'})
login.raise_for_status()
session = login.json()
headers = {'Authorization': 'Bearer ' + session['accessToken']}
original = requests.get(BASE + '/api/users/me', headers=headers).json()
png = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050001a5f645400000000049454e44ae426082')
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        for theme, width in [('dark', 390), ('light', 1440)]:
            context = browser.new_context(viewport={'width': width, 'height': 960})
            context.add_init_script(f"localStorage.setItem('bidnet.theme',{json.dumps(theme)});sessionStorage.setItem('bidnet.session',{json.dumps(json.dumps(session))});")
            page = context.new_page()
            page.goto('http://localhost:3000/#/profile', wait_until='networkidle')
            page.get_by_role('heading', name='Hồ sơ cá nhân').wait_for()
            assert page.get_by_label('Họ và tên').input_value() == (original.get('fullName') or '')
            assert page.get_by_label('Số điện thoại').input_value() == (original.get('phoneNumber') or '')
            assert page.get_by_label('Ngày sinh').count() == 1
            assert page.get_by_label('Giới tính').count() == 1
            assert page.get_by_label('Địa chỉ liên hệ').count() == 1
            assert page.get_by_label('Mật khẩu hiện tại').count() == 1
            assert page.get_by_text('Ngày tham gia').count() == 1
            assert page.get_by_text('Thông báo chưa đọc').count() == 1
            if width == 390:
                page.get_by_label('Ngày sinh').fill('1990-02-03')
                page.get_by_label('Giới tính').select_option('Male')
                page.get_by_label('Địa chỉ liên hệ').fill('QA UI contact address')
                page.get_by_role('button', name='Lưu hồ sơ').click()
                page.get_by_text('Thông tin cá nhân đã được lưu.').wait_for()
                saved = requests.get(BASE + '/api/users/me', headers=headers).json()
                assert saved['dateOfBirth'] == '1990-02-03' and saved['gender'] == 'Male'
                assert saved['contactAddress'] == 'QA UI contact address'
                page.get_by_label('Chọn ảnh đại diện').set_input_files(
                    {'name': 'avatar.png', 'mimeType': 'image/png', 'buffer': png})
                page.get_by_role('button', name='Xóa ảnh').wait_for(timeout=60000)
                uploaded = requests.get(BASE + '/api/users/me', headers=headers).json()
                assert uploaded['avatarUrl'].startswith('https://')
                page.get_by_role('button', name='Xóa ảnh').click()
                page.get_by_role('button', name='Xóa ảnh').wait_for(state='detached', timeout=60000)
                assert requests.get(BASE + '/api/users/me', headers=headers).json()['avatarUrl'] is None
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
            page.screenshot(path=fr'C:\Users\works\AppData\Local\Temp\opencode\bidnet-workflow-audit\profile-{theme}-{width}.png', full_page=True)
            context.close()
        browser.close()
    print('PASS: profile UI at mobile and desktop')
finally:
    requests.delete(BASE + '/api/users/me/avatar', headers=headers)
    requests.put(BASE + '/api/users/me', headers=headers, json={
        'fullName': original.get('fullName'), 'phoneNumber': original.get('phoneNumber'),
        'dateOfBirth': original.get('dateOfBirth'), 'gender': original.get('gender'),
        'contactAddress': original.get('contactAddress')
    })
