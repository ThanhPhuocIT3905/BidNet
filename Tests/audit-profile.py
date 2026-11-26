"""Verify profile attributes, password change and avatar cleanup; restores demo data."""
import subprocess
import uuid
import requests

BASE = 'http://localhost:5014'
badge = 'QA-profile-' + uuid.uuid4().hex[:10]
s = requests.Session()
r = s.post(BASE + '/api/auth/login', json={'usernameOrEmail': 'bidder_demo', 'password': 'Demo@12345'}, timeout=30)
r.raise_for_status()
s.headers['Authorization'] = 'Bearer ' + r.json()['accessToken']
original = s.get(BASE + '/api/users/me', timeout=20).json()
checks = []

def check(name, response, expected):
    assert response.status_code in expected, (name, response.status_code, response.text[:300])
    checks.append(name)
    return response

try:
    updated = check('profile saves new attributes', s.put(BASE + '/api/users/me', json={
        'fullName': original.get('fullName'), 'phoneNumber': original.get('phoneNumber'),
        'dateOfBirth': '1995-04-12', 'gender': 'Female', 'contactAddress': 'QA contact address'
    }), [200]).json()
    assert updated['dateOfBirth'] == '1995-04-12' and updated['gender'] == 'Female'
    assert updated['contactAddress'] == 'QA contact address'
    check('future birth date rejected', s.put(BASE + '/api/users/me', json={'dateOfBirth': '2099-01-01'}), [400])
    check('underage rejected', s.put(BASE + '/api/users/me', json={'dateOfBirth': '2020-01-01'}), [400])
    check('invalid gender rejected', s.put(BASE + '/api/users/me', json={'gender': 'Unknown'}), [400])
    check('non-image avatar rejected', s.post(BASE + '/api/users/me/avatar',
        files={'file': ('avatar.txt', b'not an image', 'image/png')}), [400])
    png = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050001a5f645400000000049454e44ae426082')
    avatar = check('valid avatar uploads', s.post(BASE + '/api/users/me/avatar',
        files={'file': ('avatar.png', png, 'image/png')}), [200]).json()
    assert avatar['avatarUrl'].startswith('https://')
    product = requests.get(BASE + '/api/products/1', timeout=20).json()
    assert 'sellerAvatarUrl' in product and 'sellerJoinedAt' in product
    checks.append('public seller card data available')
    check('avatar removal works', s.delete(BASE + '/api/users/me/avatar'), [200])
    assert s.get(BASE + '/api/users/me', timeout=20).json()['avatarUrl'] is None
    checks.append('avatar removed')
    created = requests.post(BASE + '/api/auth/register', json={
        'username': badge, 'email': badge + '@bidnet.local', 'password': 'Qa@12345x'}, timeout=20)
    check('temporary account registered', created, [201])
    qa = requests.Session()
    qa.headers['Authorization'] = 'Bearer ' + requests.post(BASE + '/api/auth/login', json={
        'usernameOrEmail': badge, 'password': 'Qa@12345x'}, timeout=20).json()['accessToken']
    check('wrong current password rejected', qa.put(BASE + '/api/users/me/password', json={
        'currentPassword': 'wrong-pass', 'newPassword': 'Qa@54321x'}), [400])
    check('password changed', qa.put(BASE + '/api/users/me/password', json={
        'currentPassword': 'Qa@12345x', 'newPassword': 'Qa@54321x'}), [204])
    check('old password no longer accepted', requests.post(BASE + '/api/auth/login', json={
        'usernameOrEmail': badge, 'password': 'Qa@12345x'}, timeout=20), [401])
    check('new password accepted', requests.post(BASE + '/api/auth/login', json={
        'usernameOrEmail': badge, 'password': 'Qa@54321x'}, timeout=20), [200])
finally:
    s.put(BASE + '/api/users/me', json={
        'fullName': original.get('fullName'), 'phoneNumber': original.get('phoneNumber'),
        'dateOfBirth': original.get('dateOfBirth'), 'gender': original.get('gender'),
        'contactAddress': original.get('contactAddress')
    })
    subprocess.run(['sqlcmd', '-S', r'.\SQLEXPRESS', '-E', '-C', '-d', 'BidNetDb', '-b', '-Q',
                    f"DELETE FROM Users WHERE Username = N'{badge}'"], check=False, capture_output=True)
    print('PASS:', len(checks), 'profile checks')
