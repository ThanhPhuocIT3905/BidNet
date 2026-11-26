import React, { useState, useEffect } from "react";
import { api, json, query, money, date, parseApiDate } from "./api";
import { OrderDetail, Notifications } from "./screens";
import { AdminCategories, Diagnostics } from "./admin";
import { AdminOrders, AuditLogs, SupportWorkspace } from "./Workflows.jsx";
import { Modal, PageHeader, EmptyState, LoadingState, ErrorState, useConfirm } from "./UI.jsx";
import Avatar from "./Avatar.jsx";

const menu = [
  ["/admin", "Tổng quan"],
  ["/admin/users", "Tài khoản"],
  ["/admin/auctions", "Phiên đấu giá"],
  ["/admin/categories", "Danh mục"],
  ["/admin/orders", "Đơn hàng"],
  ["/admin/support", "Yêu cầu hỗ trợ"],
  ["/admin/audit-logs", "Nhật ký quản trị"],
  ["/admin/notifications", "Thông báo & hỗ trợ"],
  ["/admin/diagnostics", "Kiểm tra API"],
];
const statusNames = {
  Scheduled: "Sắp diễn ra",
  Active: "Đang diễn ra",
  Completed: "Đã kết thúc",
  Cancelled: "Đã hủy",
};

function useResult(path) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState(null);
  useEffect(() => {
    let current = true;
    api(path)
      .then((data) => {
        if (current) setState({ path, version, data });
      })
      .catch((e) => {
        if (current) setState({ path, version, error: e.message });
      });
    return () => {
      current = false;
    };
  }, [path, version]);
  return {
    ...(state?.path === path && state.version === version ? state : {}),
    reload: () => setVersion((v) => v + 1),
  };
}

function Result({ result, children }) {
  if (result.error)
    return (
      <ErrorState message={result.error} onRetry={result.reload} />
    );
  if (result.data === undefined) return <LoadingState />;
  return children(result.data);
}

function Overview() {
  const users = useResult("/api/admin/users?pageSize=1");
  const auctions = useResult("/api/products?pageSize=1");
  const categories = useResult("/api/Categories");
  const active = useResult("/api/products?status=Active&pageSize=1");
  const scheduled = useResult("/api/products?status=Scheduled&pageSize=1");
  const recent = useResult("/api/products?status=Active&sort=ending_soon&pageSize=5");
  return (
    <>
      <PageHeader eyebrow="Vận hành sàn" title="Tổng quan quản trị" description="Theo dõi phiên đang mở và đi thẳng tới công việc cần xử lý."><a className="btn dark" href="#/admin/auctions">Quản lý phiên →</a></PageHeader>
      <div className="admin-metrics">
        {[
          [users, "Tài khoản", "/admin/users"],
          [auctions, "Phiên đấu giá", "/admin/auctions"],
          [categories, "Danh mục", "/admin/categories"],
        ].map(([result, label, path]) => (
          <section className="panel" key={path}>
            <h2>{label}</h2>
            <Result result={result}>
              {(data) => <strong>{data.totalCount ?? data.length}</strong>}
            </Result>
            <a href={"#" + path}>Mở danh sách →</a>
          </section>
        ))}
      </div>
      <div className="dashboard-columns"><section className="workspace-section"><div className="workspace-section-head"><div><h2>Phiên sắp kết thúc</h2><p>5 phiên đang mở có thời hạn gần nhất.</p></div><a href="#/admin/auctions">Tất cả phiên →</a></div><Result result={recent}>{data => data.items.length ? <div className="dashboard-auctions">{data.items.map(item => <a key={item.id} href={`#/product/${item.id}`}><span className="record-id">#{item.id}</span><div><strong>{item.name}</strong><small>{date(item.endTime)}</small></div><b>{money(item.currentPrice)}</b><span aria-hidden="true">↗</span></a>)}</div> : <EmptyState title="Chưa có phiên đang mở" description="Các phiên đang diễn ra sẽ xuất hiện tại đây." />}</Result></section>
      <section className="workspace-section"><div className="workspace-section-head"><h2>Tình trạng vận hành</h2></div><div className="operation-summary"><div><span>Đang diễn ra</span><Result result={active}>{data => <strong>{data.totalCount}</strong>}</Result></div><div><span>Sắp diễn ra</span><Result result={scheduled}>{data => <strong>{data.totalCount}</strong>}</Result></div></div><a className="workspace-task" href="#/admin/notifications"><b>Thông báo & yêu cầu hỗ trợ</b><span>Xem yêu cầu từ thành viên →</span></a><a className="workspace-task" href="#/admin/orders"><b>Tra cứu giao dịch</b><span>Kiểm tra đơn bằng mã đơn hàng →</span></a><p className="workspace-note">Quản trị viên giám sát hoạt động của sàn; không tham gia đăng bán hoặc đặt giá.</p></section></div>
    </>
  );
}

function Pager({ page, total, size, onPage }) {
  const pages = Math.ceil(total / size);
  return (
    pages > 1 && (
      <nav className="pagination" aria-label="Phân trang">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Trước
        </button>
        <span>
          Trang {page} / {pages}
        </span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Sau
        </button>
      </nav>
    )
  );
}

function Accounts({ user, notify }) {
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ sortBy: "username" });
  const [pending, setPending] = useState(false);
  const result = useResult(
    "/api/admin/users?" + query({ ...filters, pageNumber: page, pageSize: 15 }),
  );
  async function toggle(account) {
    if (
      !await confirm({ title: `${account.isActive ? "Khóa" : "Mở khóa"} tài khoản`, message: `${account.username} ${account.isActive ? "sẽ không thể thực hiện thao tác cần đăng nhập. Lịch sử giao dịch được giữ lại." : "sẽ được phép đăng nhập và sử dụng lại tài khoản."}`, action: account.isActive ? "Khóa tài khoản" : "Mở khóa", danger: account.isActive })
    )
      return;
    setPending(true);
    try {
      await json("PATCH", "/api/admin/users/" + account.id + "/status", {
        isActive: !account.isActive,
      });
      result.reload();
      notify("Đã cập nhật tài khoản " + account.username + ".");
    } catch (e) {
      notify(e.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeader eyebrow="Thành viên & quyền truy cập" title="Tài khoản người dùng" description="Tra cứu vai trò, tình trạng tài khoản và quản lý quyền truy cập bằng khóa/mở khóa." />
      <div className="permission-note"><b>Admin</b><span>Quản trị hệ thống</span><b>User</b><span>Mua và bán qua đấu giá</span><small>Vai trò được hệ thống cấp; màn hình này không thay đổi vai trò.</small></div>
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(Object.fromEntries(new FormData(e.currentTarget)));
          setPage(1);
        }}
      >
        <label>
          Tìm kiếm
          <input name="searchTerm" placeholder="Tên đăng nhập hoặc email" />
        </label>
        <label>Hoạt động<select name="isActive"><option value="">Tất cả</option><option value="true">Hoạt động</option><option value="false">Đã khóa</option></select></label>
        <label>
          Vai trò
          <select name="role">
            <option value="">Tất cả</option>
            <option>User</option>
            <option>Admin</option>
          </select>
        </label>
        <label>
          Sắp theo
          <select name="sortBy">
            <option value="username">Tên đăng nhập</option>
            <option value="email">Email</option>
            <option value="createdat">Ngày tạo</option>
          </select>
        </label>
        <label>
          Thứ tự
          <select name="isDescending">
            <option value="false">Tăng dần</option>
            <option value="true">Giảm dần</option>
          </select>
        </label>
        <button className="btn">Áp dụng</button>
      </form>
      <Result result={result}>
        {(data) => (
          <>
            {data.items.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tài khoản</th>
                      <th>Email</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <span className="account-cell"><Avatar user={a} /><span><b>{a.username}</b>
                          <br />
                          {a.fullName || "Chưa có họ tên"}</span></span>
                        </td>
                        <td>{a.email}</td>
                        <td><span className={`role-label ${a.role}`}>{a.role}</span></td>
                        <td><span className={`badge ${a.isActive ? "Active" : "Cancelled"}`}>{a.isActive ? "Hoạt động" : "Đã khóa"}</span></td>
                        <td>
                          {a.id === user.id ? (
                            "Tài khoản của bạn"
                          ) : (
                            <button
                              className="btn secondary"
                              disabled={pending}
                              onClick={() => toggle(a)}
                            >
                              {a.isActive ? "Khóa" : "Mở khóa"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Không tìm thấy tài khoản" description="Thử thay từ khóa hoặc chọn tất cả vai trò." />
            )}
            <Pager
              page={page}
              total={data.totalCount}
              size={data.pageSize}
              onPage={setPage}
            />
          </>
        )}
      </Result>
    </>
  );
}

export function CancelAuction({ item, onDone, notify }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!["Scheduled", "Active"].includes(item.status) || parseApiDate(item.endTime) <= new Date()) return null;
  if (!open)
    return (
      <button className="btn secondary" onClick={() => setOpen(true)}>
        Hủy phiên
      </button>
    );
  async function submit(e) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason")).trim();
    if (!reason) {
      setError("Vui lòng nhập lý do hủy.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await json("PATCH", "/api/admin/products/" + item.id + "/cancel", {
        reason,
      });
      setOpen(false);
      notify("Đã hủy phiên #" + item.id + ".");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Hủy phiên #${item.id}`} busy={busy} onClose={() => { setError(""); setOpen(false); }}><p className="muted">{item.name}. Lý do sẽ được lưu cùng phiên và gửi tới những người liên quan.</p><form className="cancel-form" onSubmit={submit}>
      <label>
        Lý do hủy phiên #{item.id}
        <textarea name="reason" required maxLength={500} autoFocus disabled={busy} placeholder="Nhập lý do cụ thể…" />
      </label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button className="btn danger" disabled={busy}>
          {busy ? "Đang xử lý…" : "Xác nhận hủy"}
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => {
            setError("");
            setOpen(false);
          }}
        >
          Quay lại
        </button>
      </div>
    </form></Modal>
  );
}

function Auctions({ notify }) {
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState({});
  const result = useResult(
    "/api/products?" + query({ ...filters, page, pageSize: 12 }),
  );
  return (
    <>
      <PageHeader eyebrow="Danh mục phiên" title="Quản lý phiên đấu giá" description="Theo dõi giá, thời hạn và trạng thái. Chọn một phiên để xem chi tiết hoặc xử lý." />
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(Object.fromEntries(new FormData(e.currentTarget)));
          setPage(1);
        }}
      >
        <label>
          Tên sản phẩm
          <input name="q" type="search" />
        </label>
        <label>
          Trạng thái
          <select name="status">
            <option value="">Tất cả</option>
            {Object.entries(statusNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="btn">Tìm phiên</button>
      </form>
      <Result result={result}>
        {(data) => (
          <>
            {data.items.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Phiên / người bán</th>
                      <th>Giá hiện tại</th>
                      <th>Trạng thái</th>
                      <th>Kết thúc</th>
                      <th>Xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <a href={"#/product/" + p.id}>
                            #{p.id} · {p.name}
                          </a>
                          <br />
                          {p.sellerName}
                        </td>
                        <td>{money(p.currentPrice)}</td>
                        <td>
                          <span className={"badge " + p.status}>
                            {statusNames[p.status]}
                          </span>
                          {p.cancellationReason && (
                            <p>{p.cancellationReason}</p>
                          )}
                        </td>
                        <td>{date(p.endTime)}</td>
                        <td>
                          <CancelAuction
                            item={p}
                            notify={notify}
                            onDone={result.reload}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Không tìm thấy phiên" description="Thử thay tên sản phẩm hoặc trạng thái đang lọc." />
            )}
            <Pager
              page={page}
              total={data.totalCount}
              size={data.pageSize}
              onPage={setPage}
            />
          </>
        )}
      </Result>
    </>
  );
}

export default function AdminWorkspace({ route, ...props }) {
  const path = route.split("?")[0];
  const orderMatch = path.match(/^\/admin\/orders\/(\d+)$/);
  const orderId = orderMatch ? Number(orderMatch[1]) : null;
  const selectedPath = path === "/admin/products" ? "/admin/auctions" : orderId ? "/admin/orders" : path;
  const identity = useResult("/api/users/me");
  const views = {
    "/admin": Overview,
    "/admin/users": Accounts,
    "/admin/auctions": Auctions,
    /* Alias cũ: /admin/products từng trả về trang trống. */
    "/admin/products": Auctions,
    "/admin/categories": AdminCategories,
    "/admin/orders": AdminOrders,
    "/admin/support": SupportWorkspace,
    "/admin/audit-logs": AuditLogs,
    "/admin/notifications": Notifications,
    "/admin/diagnostics": Diagnostics,
  };
  const View = views[path];
  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <span className="sidebar-caption">Không gian quản trị</span>
        <nav aria-label="Quản trị">
          {menu.map(([path, label], index) => (
            <a
              key={path}
              href={"#" + path}
              aria-current={selectedPath === path ? "page" : undefined}
            >
              <span className="nav-marker" aria-hidden="true">{["◫", "◎", "◇", "▦", "▤", "◉", "⌘"][index]}</span>{label}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot"><span className="role-label Admin">Admin</span><p>Giám sát phiên, thành viên và giao dịch.</p><a href="#/guides/quy-tac-dau-gia">Quy tắc đấu giá ↗</a></div>
      </aside>
      <section className="admin-body">
        <Result result={identity}>{account => {
          if (account.role !== "Admin" || !account.isActive) return <p role="alert">Tài khoản không có quyền quản trị.</p>;
          if (orderId) return <><div className="actions admin-detail-actions"><a className="btn secondary" href="#/admin/orders">← Danh sách đơn</a></div><OrderDetail key={route} id={orderId} {...props} user={account} /></>;
          return View ? <View key={selectedPath} {...props} user={account} /> : <EmptyState title="Không tìm thấy trang quản trị" description="Chọn một mục trong điều hướng hoặc quay về tổng quan."><a className="btn" href="#/admin">Về tổng quan</a></EmptyState>;
        }}</Result>
      </section>
    </div>
  );
}
