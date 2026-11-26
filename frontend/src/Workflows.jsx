import React, { useEffect, useState } from "react";
import { api, json, query, date, money } from "./api";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "./UI.jsx";

const labels = { Open: "Mới tiếp nhận", InProgress: "Đang xử lý", Resolved: "Đã giải quyết", Pending: "Chờ thanh toán", Paid: "Đã thanh toán", Delivered: "Đã giao", Cancelled: "Đã hủy" };
function useData(path) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({});
  useEffect(() => {
    let active = true;
    setState({});
    api(path).then(data => active && setState({ data }), e => active && setState({ error: e.message }));
    return () => { active = false; };
  }, [path, revision]);
  return { ...state, reload: () => setRevision(v => v + 1) };
}
function Result({ result, children }) {
  return result.error ? <ErrorState message={result.error} onRetry={result.reload} /> : result.data === undefined ? <LoadingState /> : children(result.data);
}
function Pager({ page, total, size = 20, setPage }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return pages > 1 && <nav className="pagination" aria-label="Phân trang"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</button></nav>;
}
export function SupportWorkspace({ user, notify }) {
  const [id, setId] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const r = useData(`/api/support?${query({ page, status, q })}`);
  return <><PageHeader title="Yêu cầu hỗ trợ" description="Theo dõi trao đổi và tiến trình xử lý." >{user.role !== "Admin" && <a className="btn" href="#/contact">Tạo yêu cầu</a>}</PageHeader>
    <form className="admin-filters" onSubmit={e => { e.preventDefault(); setQ(new FormData(e.currentTarget).get("q")); setPage(1); }}><label>Tìm mã hoặc tiêu đề<input name="q" /></label><label>Trạng thái<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả</option>{["Open", "InProgress", "Resolved"].map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label><button className="btn">Tìm kiếm</button></form>
    <Result result={r}>{d => <><div className="panel">{d.items.map(t => <div className="notification" key={t.id}><button className="btn secondary" onClick={() => setId(t.id)}>#{t.id} · {t.subject}</button><p>{labels[t.status]} · {t.requesterName} · {date(t.updatedAt)}</p></div>)}{!d.items.length && <EmptyState title="Chưa có yêu cầu" />}</div><Pager page={page} total={d.totalCount} setPage={setPage} /></>}</Result>
    {id && <TicketDetail key={id} id={id} user={user} notify={notify} onChange={r.reload} />}</>;
}
export function TicketDetail({ id, user, notify, onChange = () => {} }) {
  const [page, setPage] = useState(1);
  const r = useData(`/api/support/${id}?messagePage=${page}`);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(kind, data) {
    if (busy) return;
    setBusy(true); setError("");
    try { await json(kind === "messages" ? "POST" : "PATCH", `/api/support/${id}/${kind}`, { ...data, version: r.data.version }); if (kind === "messages") { setBody(""); setPage(1); } r.reload(); onChange(); notify("Đã cập nhật yêu cầu."); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="panel form-wrap"><Result result={r}>{t => <><h2>#{t.id} · {t.subject}</h2><p>{labels[t.status]} · {t.requesterName}</p>{t.orderId && <a href={`#${user.role === "Admin" ? `/admin/orders/${t.orderId}` : `/order/${t.orderId}`}`}>Đơn hàng #{t.orderId}</a>} {t.productId && <a href={`#/product/${t.productId}`}>Phiên #{t.productId}</a>}
    <div aria-live="polite">{t.messages.map(m => <article className="notification" key={m.id}><strong>{m.authorName}{m.isAdmin ? " · Quản trị viên" : ""}</strong><small> · {date(m.createdAt)}</small><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</p></article>)}</div><Pager page={page} total={t.messagePages} size={1} setPage={setPage} />
    <form onSubmit={e => { e.preventDefault(); save("messages", { message: body }); }}><label>Phản hồi<textarea required maxLength={2000} value={body} onChange={e => setBody(e.target.value)} /></label><p className="muted">Gửi phản hồi sẽ mở lại yêu cầu đã giải quyết.</p><button className="btn" disabled={busy || !body.trim()}>Gửi phản hồi</button></form>
    {user.role === "Admin" && <form onSubmit={e => { e.preventDefault(); save("status", { status: new FormData(e.currentTarget).get("status") }); }}><label>Trạng thái<select key={t.version} name="status" defaultValue={t.status}>{["Open", "InProgress", "Resolved"].map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label><button className="btn secondary" disabled={busy}>Lưu trạng thái</button></form>}
    {error && <div role="alert" className="notice error">{error}<button className="btn secondary" onClick={r.reload}>Tải lại dữ liệu</button></div>}</>}</Result></section>;
}
export function AdminOrders() {
  const [page, setPage] = useState(1), [status, setStatus] = useState(""), [q, setQ] = useState("");
  const r = useData(`/api/Orders?${query({ page, status, q })}`);
  return <><PageHeader title="Quản lý đơn hàng" description="Tra cứu giao dịch theo mã, sản phẩm hoặc tài khoản." /><form className="admin-filters" onSubmit={e => { e.preventDefault(); setQ(new FormData(e.currentTarget).get("q")); setPage(1); }}><label>Tìm kiếm<input name="q" /></label><label>Trạng thái<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả</option>{["Pending", "Paid", "Delivered", "Cancelled"].map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label><button className="btn">Tìm kiếm</button></form><Result result={r}>{d => <><div className="panel table-wrap"><table className="table"><thead><tr><th>Đơn</th><th>Sản phẩm</th><th>Người mua / bán</th><th>Giá chốt</th><th>Trạng thái</th></tr></thead><tbody>{d.items.map(o => <tr key={o.id}><td><a href={`#/admin/orders/${o.id}`}>#{o.id}</a></td><td>{o.productName}</td><td>{o.buyerName} / {o.sellerName}</td><td>{money(o.finalPrice)}</td><td>{labels[o.status]}</td></tr>)}</tbody></table>{!d.items.length && <EmptyState title="Không có đơn phù hợp" />}</div><Pager page={page} total={d.totalCount} setPage={setPage} /></>}</Result></>;
}
export function AuditLogs() {
  const [page, setPage] = useState(1), [entityType, setType] = useState("");
  const r = useData(`/api/admin/audit-logs?${query({ page, entityType })}`);
  return <><PageHeader title="Nhật ký quản trị" description="Lịch sử thao tác được ghi cùng thay đổi dữ liệu." /><label>Đối tượng<select value={entityType} onChange={e => { setType(e.target.value); setPage(1); }}><option value="">Tất cả</option>{["User", "Product", "Category", "Order", "SupportTicket"].map(s => <option key={s}>{s}</option>)}</select></label><Result result={r}>{d => <><div className="panel">{d.items.map(x => <article className="notification" key={x.id}><strong>{x.action} · {x.entityType} #{x.entityId}</strong><p>{x.actorName} · {date(x.createdAt)}</p><p>{x.note}</p></article>)}{!d.items.length && <EmptyState title="Chưa có thao tác quản trị" />}</div><Pager page={page} total={d.totalCount} setPage={setPage} /></>}</Result></>;
}
export function OrderHistory({ id, version }) {
  const [page, setPage] = useState(1);
  const r = useData(`/api/Orders/${id}/history?${query({ page, version })}`);
  const actions = { Created: "Tạo đơn", MigrationBaseline: "Mốc bổ sung lịch sử", ShippingUpdated: "Cập nhật nhận hàng", DemoPaymentCompleted: "Thanh toán demo", StatusChanged: "Chuyển trạng thái" };
  return <section className="panel"><h2>Lịch sử đơn hàng</h2><Result result={r}>{d => <>{d.items.map(x => <article className="notification" key={x.id}><strong>{actions[x.action] || x.action} · {labels[x.toStatus]}</strong><p>{x.actorName} · {date(x.createdAt)}</p><p>{x.note}</p></article>)}{!d.items.length && <p>Chưa có lịch sử.</p>}<Pager page={page} total={d.totalCount} setPage={setPage} /></>}</Result></section>;
}
