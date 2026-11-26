import React, { useEffect, useState } from "react";
import { api, json, date, parseApiDate } from "./api";
import useRemote from "./useRemote";
import { PageHeader, LoadingState, ErrorState } from "./UI.jsx";
import Avatar from "./Avatar.jsx";

const emptyProfile = { fullName: "", phoneNumber: "", dateOfBirth: "", gender: "", contactAddress: "" };
const toDraft = account => Object.fromEntries(Object.keys(emptyProfile).map(key => [key, account[key] || ""]));

function Activity({ title, path, href, value, description }) {
  const r = useRemote(() => api(path), [path]);
  return <section className="panel profile-activity"><h3>{title}</h3>{r.loading ? <span role="status">Đang tải…</span> : r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.data && <strong>{value(r.data)}</strong>}<p className="muted small">{description}</p><a href={href}>Xem chi tiết →</a></section>;
}

export default function ProfilePage({ onProfile, notify }) {
  const r = useRemote(() => api("/api/users/me"), []);
  const [draft, setDraft] = useState(emptyProfile);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const account = r.data;
  useEffect(() => {
    if (account) setDraft(toDraft(account));
  }, [account]);
  const dirty = account && Object.keys(emptyProfile).some(key => draft[key].trim() !== (account[key] || ""));
  const change = e => { setDraft({ ...draft, [e.target.name]: e.target.value }); setSaved(false); };
  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy || uploading) return;
    if (file.size > 5 * 1024 * 1024) { setError("Ảnh không được vượt quá 5 MB."); return; }
    setUploading(true); setError("");
    try {
      const body = new FormData(); body.append("file", file);
      const updated = await api("/api/users/me/avatar", { method: "POST", body });
      onProfile(updated);
      await r.reload();
      notify("Đã cập nhật ảnh đại diện.");
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  }
  async function removeAvatar() {
    if (busy || uploading) return;
    setUploading(true); setError("");
    try {
      const updated = await api("/api/users/me/avatar", { method: "DELETE" });
      onProfile(updated);
      await r.reload();
      notify("Đã xóa ảnh đại diện.");
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  }
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState(""), [passwordSaved, setPasswordSaved] = useState(false);
  async function changePassword(e) {
    e.preventDefault();
    if (passwordBusy) return;
    if (password.newPassword !== password.confirm) { setPasswordError("Mật khẩu xác nhận không khớp."); return; }
    if (password.newPassword.length < 8) { setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự."); return; }
    if (password.newPassword === password.currentPassword) { setPasswordError("Mật khẩu mới phải khác mật khẩu hiện tại."); return; }
    setPasswordBusy(true); setPasswordError(""); setPasswordSaved(false);
    try {
      await json("PUT", "/api/users/me/password", { currentPassword: password.currentPassword, newPassword: password.newPassword });
      setPassword({ currentPassword: "", newPassword: "", confirm: "" });
      setPasswordSaved(true); notify("Đã đổi mật khẩu.");
    } catch (e) { setPasswordError(e.message); }
    finally { setPasswordBusy(false); }
  }
  async function submit(e) {
    e.preventDefault();
    if (busy || !dirty) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const updated = await json("PUT", "/api/users/me", Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim() || null])));
      onProfile(updated);
      await r.reload();
      setSaved(true); notify("Đã lưu hồ sơ.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const admin = account?.role === "Admin";
  return <>
    <PageHeader eyebrow="Tài khoản của tôi" title="Hồ sơ cá nhân" description="Thông tin liên hệ, tình trạng tài khoản và hoạt động trên Auctora." />
    {r.error && <ErrorState message={r.error} onRetry={r.reload} />}
    {r.loading && <LoadingState />}
    {account && <>
      <section className="panel profile-identity"><Avatar user={account} /><div><h2>{account.fullName || account.username}</h2><p>@{account.username} · Mã thành viên #{account.id}</p><div className="actions"><span className={`role-label ${account.role}`}>{admin ? "Quản trị viên" : "Thành viên"}</span><span className={`badge ${account.isActive ? "Active" : "Cancelled"}`}>{account.isActive ? "Đang hoạt động" : "Đã khóa"}</span></div></div></section>
      <div className="profile-columns">
        <section className="panel"><h2>Thông tin cá nhân</h2><p className="muted small">Thông tin hồ sơ và liên hệ của bạn. Ngày sinh và giới tính là tùy chọn.</p><form onSubmit={submit}>
          <div className="field"><label>Ảnh đại diện</label><div className="avatar-editor"><Avatar user={account} /><div><input id="avatarUpload" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || uploading || dirty} onChange={uploadAvatar} aria-label="Chọn ảnh đại diện" /><small>PNG, JPEG hoặc WebP · tối đa 5 MB. {dirty ? "Lưu hoặc hủy thay đổi trước khi cập nhật ảnh." : "Ảnh được lưu ngay sau khi tải lên."}</small>{account.avatarUrl && <button className="btn secondary" type="button" disabled={busy || uploading || dirty} onClick={removeAvatar}>Xóa ảnh</button>}{uploading && <span role="status">Đang cập nhật ảnh…</span>}</div></div></div>
          <div className="field"><label htmlFor="fullName">Họ và tên</label><input id="fullName" name="fullName" autoComplete="name" maxLength={200} value={draft.fullName} disabled={busy} onChange={e => { setDraft({ ...draft, fullName: e.target.value }); setSaved(false); }} /></div>
          <div className="field"><label htmlFor="phoneNumber">Số điện thoại</label><input id="phoneNumber" name="phoneNumber" type="tel" autoComplete="tel" maxLength={20} value={draft.phoneNumber} disabled={busy} onChange={e => { setDraft({ ...draft, phoneNumber: e.target.value }); setSaved(false); }} /></div>
          <div className="form-grid"><div className="field"><label htmlFor="dateOfBirth">Ngày sinh</label><input id="dateOfBirth" name="dateOfBirth" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={draft.dateOfBirth} disabled={busy || uploading} onChange={change} /></div><div className="field"><label htmlFor="gender">Giới tính</label><select id="gender" name="gender" value={draft.gender} disabled={busy || uploading} onChange={change}><option value="">Chưa cung cấp</option><option value="Female">Nữ</option><option value="Male">Nam</option><option value="Other">Khác</option><option value="PreferNotToSay">Không muốn cung cấp</option></select></div></div>
          <div className="field"><label htmlFor="contactAddress">Địa chỉ liên hệ</label><textarea id="contactAddress" name="contactAddress" autoComplete="street-address" maxLength={500} value={draft.contactAddress} disabled={busy || uploading} onChange={change} /><small>Địa chỉ giao hàng vẫn được xác nhận riêng cho từng đơn.</small></div>
          {(!account.fullName || !account.phoneNumber) && <p className="notice">Bạn chưa bổ sung { !account.fullName && !account.phoneNumber ? "họ tên và số điện thoại" : !account.fullName ? "họ tên" : "số điện thoại" }.</p>}
          {error && <p className="notice error" role="alert">{error}</p>}{saved && <p className="notice" role="status">Thông tin cá nhân đã được lưu.</p>}
          <div className="actions"><button className="btn dark" disabled={busy || uploading || !dirty}>{busy ? "Đang lưu…" : "Lưu hồ sơ"}</button><button type="button" className="btn secondary" disabled={busy || uploading || !dirty} onClick={() => { setDraft(toDraft(account)); setError(""); setSaved(false); }}>Hủy thay đổi</button></div>
        </form></section>
        <section className="panel"><h2>Thông tin tài khoản</h2><dl className="profile-facts"><div><dt>Tên đăng nhập</dt><dd>{account.username}</dd></div><div><dt>Email đăng ký</dt><dd>{account.email}</dd></div><div><dt>Ngày tham gia</dt><dd>{account.createdAt ? parseApiDate(account.createdAt).toLocaleDateString("vi-VN") : "—"}</dd></div><div><dt>Cập nhật hồ sơ</dt><dd>{account.updatedAt ? date(account.updatedAt) : "Chưa cập nhật"}</dd></div><div><dt>Vai trò</dt><dd>{admin ? "Quản trị viên" : "Thành viên · mua và bán đấu giá"}</dd></div></dl><p className="muted small">Tên đăng nhập và email hiện chưa hỗ trợ tự thay đổi. Vai trò và trạng thái tài khoản do quản trị viên quản lý.</p><a className="btn secondary" href={admin ? "#/admin/support" : "#/contact"}>Liên hệ hỗ trợ</a></section>
      </div>
      <section className="panel profile-security"><h2>Bảo mật tài khoản</h2><p className="muted small">Đổi mật khẩu định kỳ và không dùng lại mật khẩu của email hoặc dịch vụ khác.</p><form onSubmit={changePassword} className="password-form">
        <div className="field"><label htmlFor="currentPassword">Mật khẩu hiện tại</label><input id="currentPassword" type="password" autoComplete="current-password" maxLength={128} required value={password.currentPassword} onChange={e => { setPassword({ ...password, currentPassword: e.target.value }); setPasswordError(""); setPasswordSaved(false); }} /></div>
        <div className="field"><label htmlFor="newPassword">Mật khẩu mới</label><input id="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password.newPassword} onChange={e => { setPassword({ ...password, newPassword: e.target.value }); setPasswordError(""); setPasswordSaved(false); }} /><small>Tối thiểu 8 ký tự.</small></div>
        <div className="field"><label htmlFor="confirmPassword">Nhập lại mật khẩu mới</label><input id="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password.confirm} onChange={e => { setPassword({ ...password, confirm: e.target.value }); setPasswordError(""); setPasswordSaved(false); }} /></div>
        {passwordError && <p className="notice error" role="alert">{passwordError}</p>}{passwordSaved && <p className="notice" role="status">Mật khẩu đã được thay đổi.</p>}
        <button className="btn dark" disabled={passwordBusy || !password.currentPassword || password.newPassword.length < 8 || !password.confirm}>{passwordBusy ? "Đang đổi…" : "Đổi mật khẩu"}</button>
      </form></section>
      <h2>Hoạt động của bạn</h2><div className="profile-activities">
        {!admin && <><Activity title="Phiên đã đăng" path="/api/products/me?pageSize=1" href="#/my-products" value={d => d.totalCount} description="Tổng số phiên đấu giá của bạn." /><Activity title="Lượt đặt giá" path="/api/users/me/bids?pageSize=1" href="#/my-bids" value={d => d.totalCount} description="Các lượt giá đã được ghi nhận." /><Activity title="Đơn hàng" path="/api/Orders/me" href="#/orders" value={d => d.length} description="Đơn mua và đơn bán sau đấu giá." /></>}
        <Activity title="Thông báo chưa đọc" path="/api/Notifications/me" href="#/notifications" value={d => d.filter(n => !n.isRead).length} description="Cập nhật phiên, giao dịch và hỗ trợ." />
      </div>
      <section className="panel"><h2>{admin ? "Không gian quản trị" : "Giao dịch & hỗ trợ"}</h2><div className="actions">{admin ? <a className="btn secondary" href="#/admin">Mở trang quản trị</a> : <><a className="btn secondary" href="#/orders">Quản lý đơn & địa chỉ nhận hàng</a><a className="btn secondary" href="#/favorites">Phiên yêu thích</a></>}<a className="btn secondary" href={admin ? "#/admin/support" : "#/support"}>Theo dõi yêu cầu hỗ trợ</a></div>{!admin && <p className="muted small profile-note">Thông tin người nhận và địa chỉ giao hàng được lưu riêng trên từng đơn hàng.</p>}</section>
    </>}
  </>;
}
