import React, { useState, useEffect } from "react";
import { api, json, query, money, date } from "./api";
import { OrderDetail } from "./screens";
import { AdminCategories, Diagnostics } from "./admin";

const menu = [
  ["/admin", "Tổng quan"],
  ["/admin/users", "Tài khoản"],
  ["/admin/auctions", "Phiên đấu giá"],
  ["/admin/categories", "Danh mục"],
  ["/admin/orders", "Tra cứu đơn"],
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
      <p role="alert" className="notice error">
        {result.error} <button onClick={result.reload}>Thử lại</button>
      </p>
    );
  if (result.data === undefined) return <p role="status">Đang tải dữ liệu…</p>;
  return children(result.data);
}

function Overview() {
  const users = useResult("/api/admin/users?pageSize=1");
  const auctions = useResult("/api/products?pageSize=1");
  const categories = useResult("/api/Categories");
  return (
    <>
      <h1>Tổng quan quản trị</h1>
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
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ sortBy: "username" });
  const [pending, setPending] = useState(false);
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
      notify("Đã cập nhật tài khoản " + account.username + ".");
    } catch (e) {
      notify(e.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
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
          <input name="searchTerm" placeholder="Tên đăng nhập hoặc email" />
        </label>
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
                          <b>{a.username}</b>
                          <br />
                          {a.fullName}
                        </td>
                        <td>{a.email}</td>
                        <td>{a.role}</td>
                        <td>{a.isActive ? "Hoạt động" : "Đã khóa"}</td>
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
              <p className="empty">Không tìm thấy tài khoản.</p>
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
  if (!["Scheduled", "Active"].includes(item.status)) return null;
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
    <form className="cancel-form" onSubmit={submit}>
      <label>
        Lý do hủy phiên #{item.id}
        <textarea name="reason" required maxLength={500} />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button className="btn danger" disabled={busy}>
          Xác nhận hủy
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
    </form>
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
              <p className="empty">Không tìm thấy phiên.</p>
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
  return (
    <>
      <h1>Tra cứu đơn hàng</h1>
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setId(Number(new FormData(e.currentTarget).get("orderId")));
        }}
      >
        <label>
          Mã đơn hàng
          <input name="orderId" type="number" min="1" step="1" required />
        </label>
        <button className="btn">Tra cứu</button>
      </form>
      {id && <OrderDetail key={id} id={id} {...props} />}
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
              return <p role="alert">Tài khoản không có quyền quản trị.</p>;
            return View ? (
              <View {...props} user={account} />
            ) : (
              <p>Không tìm thấy trang quản trị.</p>
            );
          }}
        </Result>
      </section>
    </div>
  );
}
