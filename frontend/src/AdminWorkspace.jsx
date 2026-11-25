import React, { useState, useEffect } from "react";
import { api, json, query, money, date } from "./api";
import { OrderDetail } from "./screens";
import { AdminCategories, Diagnostics } from "./admin";
import { StatusBadge } from "./Lot.jsx";

const menu = [
  ["/admin", "Tổng quan"],
  ["/admin/users", "Tài khoản"],
  ["/admin/auctions", "Phiên đấu giá"],
  ["/admin/categories", "Danh mục"],
  ["/admin/orders", "Đơn hàng"],
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
      <div role="alert" className="notice error meta-row">
        <span>{result.error}</span>
        <button className="btn secondary sm" onClick={result.reload}>
          Thử lại
        </button>
      </div>
    );
  if (result.data === undefined)
    return (
      <p role="status" className="loading">
        Đang tải dữ liệu…
      </p>
    );
  return children(result.data);
}

function Overview() {
  const users = useResult("/api/admin/users?pageSize=1");
  const auctions = useResult("/api/products?pageSize=1");
  const categories = useResult("/api/categories");
  const orders = useResult("/api/orders?pageSize=1");
  return (
    <>
      <div className="eyebrow">Bảng điều khiển</div>
      <h1>Tổng quan quản trị</h1>
      <div className="admin-metrics">
        {[
          [users, "Tài khoản", "/admin/users"],
          [auctions, "Phiên đấu giá", "/admin/auctions"],
          [categories, "Danh mục", "/admin/categories"],
          [orders, "Đơn hàng", "/admin/orders"],
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
    </>
  );
}

function Pager({ page, total, size, onPage }) {
  const pages = Math.ceil(total / size);
  return (
    pages > 1 && (
      <nav className="pagination" aria-label="Phân trang">
        <button
          className="btn secondary sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Trước
        </button>
        <span>
          Trang {page} / {pages}
        </span>
        <button
          className="btn secondary sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Sau →
        </button>
      </nav>
    )
  );
}

function Accounts({ user, notify }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ sortBy: "username" });
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editError, setEditError] = useState("");

  const result = useResult(
    "/api/admin/users?" + query({ ...filters, page, pageSize: 15 }),
  );

  async function toggle(account) {
    if (
      !window.confirm(
        (account.isActive ? "Khóa" : "Mở khóa") +
          " tài khoản " +
          account.username +
          "?",
      )
    )
      return;
    setPending(true);
    try {
      await json("PATCH", "/api/admin/users/" + account.id + "/status", {
        isActive: !account.isActive,
      });
      result.reload();
      notify("Đã cập nhật trạng thái tài khoản " + account.username + ".");
    } catch (e) {
      notify(e.message);
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setPending(true);
    setEditError("");
    const v = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const payload = {
        username: v.username?.trim() || null,
        email: v.email?.trim() || null,
        fullName: v.fullName ?? null,
        phoneNumber: v.phoneNumber ?? null,
        role: v.role || null,
        password: v.password?.trim() ? v.password : null,
      };
      await json("PUT", `/api/admin/users/${editing.id}`, payload);
      setEditing(null);
      result.reload();
      notify(`Đã cập nhật tài khoản ${v.username || editing.username}.`);
    } catch (ex) {
      setEditError(ex.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="eyebrow">Quản trị</div>
      <h1>Tài khoản người dùng</h1>
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
          <input name="searchTerm" placeholder="Username, email hoặc họ tên" />
        </label>
        <label>
          Vai trò
          <select name="role">
            <option value="">Tất cả</option>
            <option value="User">User</option>
            <option value="Admin">Admin</option>
          </select>
        </label>
        <label>
          Sắp theo
          <select name="sortBy" defaultValue="username">
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
        <button className="btn dark">Áp dụng</button>
      </form>

      {editing && (
        <div className="panel" style={{ borderTop: "4px solid var(--purple)" }}>
          <div className="meta-row" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>
              Chỉnh sửa tài khoản #{editing.id} ({editing.username})
            </h2>
            <button
              type="button"
              className="btn secondary sm"
              onClick={() => {
                setEditing(null);
                setEditError("");
              }}
            >
              Đóng
            </button>
          </div>
          <form key={editing.id} onSubmit={saveEdit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="edUser">Tên đăng nhập</label>
                <input
                  id="edUser"
                  name="username"
                  defaultValue={editing.username}
                  minLength={3}
                  maxLength={50}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="edEmail">Email</label>
                <input
                  id="edEmail"
                  name="email"
                  type="email"
                  defaultValue={editing.email}
                  maxLength={100}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="edName">Họ tên</label>
                <input
                  id="edName"
                  name="fullName"
                  defaultValue={editing.fullName || ""}
                  maxLength={200}
                />
              </div>
              <div className="field">
                <label htmlFor="edPhone">Số điện thoại</label>
                <input
                  id="edPhone"
                  name="phoneNumber"
                  defaultValue={editing.phoneNumber || ""}
                  maxLength={20}
                />
              </div>
              <div className="field">
                <label htmlFor="edRole">Vai trò</label>
                <select
                  id="edRole"
                  name="role"
                  defaultValue={editing.role}
                  disabled={editing.id === user.id}
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="edPass">Đặt mật khẩu mới (để trống nếu giữ nguyên)</label>
                <input
                  id="edPass"
                  name="password"
                  type="password"
                  minLength={8}
                  placeholder="Tối thiểu 8 ký tự"
                />
              </div>
            </div>
            {editError && <div className="notice error">{editError}</div>}
            <div className="actions">
              <button className="btn dark" disabled={pending}>
                Lưu thông tin tài khoản
              </button>
            </div>
          </form>
        </div>
      )}

      <Result result={result}>
        {(data) => (
          <>
            {data.items.length ? (
              <div className="admin-table-card table-wrap">
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
                          <strong>{a.username}</strong>
                          {a.fullName && (
                            <div className="small muted">{a.fullName}</div>
                          )}
                        </td>
                        <td>{a.email}</td>
                        <td>
                          <span className={`role-pill-light ${a.role}`}>
                            {a.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${a.isActive ? "Active" : "Cancelled"}`}>
                            <span className="badge-dot" aria-hidden="true" />
                            {a.isActive ? "Hoạt động" : "Đã khóa"}
                          </span>
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              className="btn secondary sm"
                              disabled={pending}
                              onClick={() => {
                                setEditing(a);
                                setEditError("");
                              }}
                            >
                              Sửa
                            </button>
                            {a.id === user.id ? (
                              <span className="small muted">Đang đăng nhập</span>
                            ) : (
                              <button
                                className={`btn sm ${a.isActive ? "danger" : "dark"}`}
                                disabled={pending}
                                onClick={() => toggle(a)}
                              >
                                {a.isActive ? "Khóa" : "Mở khóa"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">Không tìm thấy tài khoản phù hợp.</p>
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!["Scheduled", "Active"].includes(item.status)) return null;
  if (!open)
    return (
      <button className="btn danger sm" onClick={() => setOpen(true)}>
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
    <form className="cancel-form" onSubmit={submit}>
      <label>
        Lý do hủy phiên #{item.id}
        <textarea name="reason" required maxLength={500} placeholder="Nhập lý do hủy phiên…" />
      </label>
      {error && (
        <div className="notice error" role="alert" style={{ margin: 0 }}>
          {error}
        </div>
      )}
      <div className="actions">
        <button className="btn danger sm" disabled={busy}>
          Xác nhận hủy
        </button>
        <button
          type="button"
          className="btn secondary sm"
          disabled={busy}
          onClick={() => {
            setError("");
            setOpen(false);
          }}
        >
          Quay lại
        </button>
      </div>
    </form>
  );
}

function Auctions({ notify }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const result = useResult(
    "/api/products?" + query({ ...filters, page, pageSize: 12 }),
  );
  return (
    <>
      <div className="eyebrow">Quản trị</div>
      <h1>Quản lý phiên đấu giá</h1>
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
          <input name="q" type="search" placeholder="Tìm theo tên…" />
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
        <button className="btn dark">Tìm phiên</button>
      </form>
      <Result result={result}>
        {(data) => (
          <>
            {data.items.length ? (
              <div className="admin-table-card table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Phiên / Người bán</th>
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
                          <div className="small muted">Người bán: {p.sellerName}</div>
                        </td>
                        <td className="mono" style={{ fontWeight: 700, color: "var(--blue)" }}>
                          {money(p.currentPrice)}
                        </td>
                        <td>
                          <StatusBadge value={p.status} />
                          {p.cancellationReason && (
                            <div className="small muted" style={{ marginTop: 4 }}>
                              Lý do: {p.cancellationReason}
                            </div>
                          )}
                        </td>
                        <td className="small muted">{date(p.endTime)}</td>
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
              <p className="empty">Không tìm thấy phiên đấu giá phù hợp.</p>
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

function OrderLookup(props) {
  const [id, setId] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const list = useResult(
    "/api/orders?" + query({ status, page, pageSize: 10 }),
  );
  return (
    <>
      <div className="eyebrow">Quản trị</div>
      <h1>Quản lý & tra cứu đơn hàng</h1>
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setId(Number(new FormData(e.currentTarget).get("orderId")));
        }}
      >
        <label>
          Tra cứu nhanh theo mã đơn
          <input name="orderId" type="number" min="1" step="1" placeholder="Ví dụ: 3" required />
        </label>
        <button className="btn dark">Tra cứu</button>
        <label>
          Lọc theo trạng thái
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Pending">Chờ địa chỉ</option>
            <option value="Processing">Đang xử lý</option>
            <option value="Shipped">Đang giao hàng</option>
            <option value="Completed">Hoàn tất</option>
            <option value="Cancelled">Đã hủy</option>
          </select>
        </label>
      </form>
      <Result result={list}>
        {(data) => (
          <>
            {data.items.length ? (
              <div className="admin-table-card table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Sản phẩm</th>
                      <th>Người mua ← Người bán</th>
                      <th>Giá chốt</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((o) => (
                      <tr key={o.id}>
                        <td className="mono">#{o.id}</td>
                        <td><strong>{o.productName}</strong></td>
                        <td>
                          {o.buyerName} <span className="muted">←</span> {o.sellerName}
                        </td>
                        <td className="mono" style={{ fontWeight: 700, color: "var(--blue)" }}>
                          {money(o.finalPrice)}
                        </td>
                        <td>
                          <StatusBadge value={o.status} />
                        </td>
                        <td>
                          <button
                            className="btn secondary sm"
                            onClick={() => setId(o.id)}
                          >
                            Xem / Xử lý
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">Chưa có đơn hàng phù hợp.</p>
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
      {id && (
        <OrderDetail
          key={id}
          id={id}
          {...props}
          onUpdated={list.reload}
        />
      )}
    </>
  );
}

export default function AdminWorkspace({ route, ...props }) {
  const identity = useResult("/api/users/me");
  const views = {
    "/admin": Overview,
    "/admin/users": Accounts,
    "/admin/auctions": Auctions,
    "/admin/categories": AdminCategories,
    "/admin/orders": OrderLookup,
    "/admin/diagnostics": Diagnostics,
  };
  const View = views[route];
  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <strong>Quản trị BidNet</strong>
        <nav aria-label="Quản trị">
          {menu.map(([path, label]) => (
            <a
              key={path}
              href={"#" + path}
              aria-current={route === path ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <section className="admin-body">
        <Result result={identity}>
          {(account) => {
            if (account.role !== "Admin" || !account.isActive)
              return (
                <p role="alert" className="notice error">
                  Tài khoản không có quyền quản trị.
                </p>
              );
            return View ? (
              <View {...props} user={account} />
            ) : (
              <p className="empty">Không tìm thấy trang quản trị.</p>
            );
          }}
        </Result>
      </section>
    </div>
  );
}
