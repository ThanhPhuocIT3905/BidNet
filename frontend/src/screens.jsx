import React, { useEffect, useState } from "react";
import {
  api,
  json,
  money,
  date,
  getSession,
  parseApiDate,
  emitNotificationsChanged,
} from "./api";
import { CountdownBox, LotPhoto, StatusBadge } from "./Lot.jsx";

function useRemote(load, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try {
      setData(await load());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
  }, deps);
  return { data, error, loading, reload };
}

function Feedback({ loading, error }) {
  return (
    <>
      {error && <div className="notice error">{error}</div>}
      {loading && <div className="loading">Đang tải dữ liệu…</div>}
    </>
  );
}

function Field({ label, name, value, type = "text", ...props }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={value ?? ""}
        {...props}
      />
    </div>
  );
}

const values = (e) =>
  Object.fromEntries(new FormData(e.currentTarget).entries());

function Pager({ data, page, onPage }) {
  const total = Math.ceil((data?.totalCount || 0) / (data?.pageSize || 20));
  return total > 1 ? (
    <div className="pagination">
      <button
        className="btn secondary sm"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        ← Trước
      </button>
      <span>
        Trang {page} / {total}
      </span>
      <button
        className="btn secondary sm"
        disabled={page === total}
        onClick={() => onPage(page + 1)}
      >
        Sau →
      </button>
    </div>
  ) : null;
}

export function MyProducts({ go }) {
  const [page, setPage] = useState(1);
  const r = useRemote(
    () => api(`/api/products/me?page=${page}&pageSize=12`),
    [page],
  );
  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Kênh người bán</div>
          <h1>Sản phẩm của tôi</h1>
        </div>
        <button className="btn" onClick={() => go("/product/new")}>
          + Đăng sản phẩm mới
        </button>
      </div>
      <Feedback {...r} />
      <div className="grid">
        {r.data?.items?.map((x) => (
          <article className="card" key={x.id}>
            <div className="card-image">
              <LotPhoto item={x} />
              <div className="card-badge-float">
                <StatusBadge value={x.status} />
              </div>
              <span className="card-id-float">#{String(x.id).padStart(3, "0")}</span>
            </div>
            <div className="card-body">
              <div className="card-category">
                {x.category || "Chưa phân loại"}
              </div>
              <h3>{x.name}</h3>
              <div className="price">{money(x.currentPrice)}</div>
              <CountdownBox item={x} />
              <div className="actions" style={{ marginTop: "auto", paddingTop: 10 }}>
                <button
                  className="btn dark sm"
                  onClick={() => go(`/product/${x.id}`)}
                >
                  Chi tiết
                </button>
                {x.status === "Scheduled" && (
                  <button
                    className="btn secondary sm"
                    onClick={() => go(`/product/${x.id}/edit`)}
                  >
                    Chỉnh sửa
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!r.loading && !r.error && !r.data?.items?.length && (
        <div className="empty">
          <p>Bạn chưa đăng sản phẩm đấu giá nào.</p>
          <button className="btn dark" onClick={() => go("/product/new")}>
            + Đăng sản phẩm đầu tiên
          </button>
        </div>
      )}
      <Pager data={r.data} page={page} onPage={setPage} />
    </>
  );
}

function toLocalInput(dateObj) {
  return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function ProductForm({ id, go, notify, user }) {
  const product = useRemote(
    () => (id ? api(`/api/products/${id}`) : Promise.resolve({})),
    [id],
  );
  const categories = useRemote(() => api("/api/categories"), []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const v = values(e);
    setBusy(true);
    setError("");
    try {
      const start = new Date(v.startTime);
      const end = new Date(v.endTime);
      if (start <= new Date() || end <= start)
        throw new Error(
          "Thời gian bắt đầu phải ở tương lai và thời gian kết thúc phải sau thời gian bắt đầu.",
        );
      const body = {
        name: v.name,
        description: v.description || null,
        startingPrice: Number(v.startingPrice),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        categoryId: v.categoryId ? Number(v.categoryId) : null,
        imageUrl: v.imageUrl || null,
      };
      const saved = await json(
        id ? "PUT" : "POST",
        id ? `/api/products/${id}` : "/api/products",
        body,
      );
      notify(id ? "Đã cập nhật sản phẩm." : "Đã tạo phiên đấu giá thành công!");
      go(`/product/${saved.id}`);
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };

  if (product.loading || product.error) return <Feedback {...product} />;
  if (categories.loading || categories.error)
    return <Feedback {...categories} />;

  const x = product.data || {};
  if (
    id &&
    (x.sellerId !== user.id ||
      x.status !== "Scheduled" ||
      parseApiDate(x.startTime) <= new Date())
  )
    return (
      <div className="empty">
        <p>Bạn không thể sửa phiên này (chỉ chủ sản phẩm được sửa trước khi phiên mở).</p>
        <button className="btn secondary" onClick={() => go(`/product/${id}`)}>
          Quay lại chi tiết phiên
        </button>
      </div>
    );

  const defaultStart = x.startTime
    ? toLocalInput(parseApiDate(x.startTime))
    : toLocalInput(new Date(Date.now() + 10 * 60 * 1000));
  const defaultEnd = x.endTime
    ? toLocalInput(parseApiDate(x.endTime))
    : toLocalInput(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

  return (
    <div className="panel form-wrap">
      <div className="eyebrow">{id ? `Phiên #${id}` : "Tạo phiên mới"}</div>
      <h1>{id ? "Chỉnh sửa sản phẩm" : "Đăng sản phẩm đấu giá"}</h1>
      <p className="muted">
        Chọn thời gian theo giờ máy bạn (hệ thống tự đổi sang UTC và tác vụ nền sẽ tự mở phiên khi đến giờ).
      </p>
      <form onSubmit={submit}>
        <Field
          label="Tên sản phẩm"
          name="name"
          placeholder="Ví dụ: MacBook Pro M3 14 inch"
          value={x.name}
          required
          maxLength={200}
        />
        <div className="field">
          <label htmlFor="description">Mô tả chi tiết</label>
          <textarea
            id="description"
            name="description"
            placeholder="Tình trạng, phụ kiện đi kèm, bảo hành…"
            defaultValue={x.description || ""}
            maxLength={2000}
          />
        </div>
        <div className="form-grid">
          <Field
            label="Giá khởi điểm (VND, số nguyên ≥ 1.000)"
            name="startingPrice"
            type="number"
            min={1000}
            max={100000000000}
            step={1}
            value={x.startingPrice || 100000}
            required
          />
          <div className="field">
            <label htmlFor="categoryId">Danh mục</label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={x.categoryId || ""}
            >
              <option value="">Chưa chọn danh mục</option>
              {categories.data?.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Thời gian bắt đầu"
            name="startTime"
            type="datetime-local"
            value={defaultStart}
            required
          />
          <Field
            label="Thời gian kết thúc"
            name="endTime"
            type="datetime-local"
            value={defaultEnd}
            required
          />
        </div>
        <Field
          label="URL ảnh đại diện (tùy chọn — có thể tải ảnh từ máy sau khi tạo)"
          name="imageUrl"
          type="text"
          placeholder="https://... hoặc để trống"
          value={x.imageUrl}
        />
        {error && <div className="notice error">{error}</div>}
        <div className="actions">
          <button className="btn dark" disabled={busy}>
            {busy ? "Đang lưu…" : id ? "Lưu thay đổi" : "Đăng phiên đấu giá"}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => go(id ? `/product/${id}` : "/my-products")}
          >
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}

export function Orders({ go }) {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("all");
  const r = useRemote(
    () => api(`/api/orders/me?role=${roleFilter}&page=${page}&pageSize=20`),
    [roleFilter, page],
  );
  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Giao dịch sau đấu giá</div>
          <h1>Đơn hàng của tôi</h1>
        </div>
      </div>
      <div className="status-tabs" aria-label="Lọc vai trò đơn hàng">
        {[
          ["all", "Tất cả đơn hàng"],
          ["buyer", "Đơn tôi thắng (Người mua)"],
          ["seller", "Đơn tôi bán (Người bán)"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={roleFilter === key}
            onClick={() => {
              setRoleFilter(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <Feedback {...r} />
      <div className="panel table-wrap" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Sản phẩm</th>
              <th>Giá chốt</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {r.data?.items?.map((o) => {
              const isBuyer = o.buyerId === getSession()?.user.id;
              return (
                <tr key={o.id}>
                  <td className="mono">#{o.id}</td>
                  <td>
                    <strong>{o.productName}</strong>
                    <div className="small muted">{date(o.createdAt)}</div>
                  </td>
                  <td className="mono" style={{ fontWeight: 700, color: "var(--blue)" }}>
                    {money(o.finalPrice)}
                  </td>
                  <td>
                    <span className={`role-pill-light ${isBuyer ? "" : "Admin"}`}>
                      {isBuyer ? "Người mua" : "Người bán"}
                    </span>
                  </td>
                  <td>
                    <StatusBadge value={o.status} />
                  </td>
                  <td>
                    <button
                      className="btn secondary sm"
                      onClick={() => go(`/order/${o.id}`)}
                    >
                      Chi tiết →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!r.loading && !r.error && !r.data?.items?.length && (
          <div className="empty" style={{ border: 0, borderRadius: 0 }}>
            Chưa có đơn hàng nào trong mục này.
          </div>
        )}
      </div>
      <Pager data={r.data} page={page} onPage={setPage} />
    </>
  );
}

const ORDER_STEPS = [
  ["Pending", "1", "Chờ địa chỉ"],
  ["Processing", "2", "Đang xử lý"],
  ["Shipped", "3", "Đang giao"],
  ["Completed", "4", "Hoàn tất"],
];

export function OrderDetail({ id, user, notify, onUpdated }) {
  const r = useRemote(() => api(`/api/orders/${id}`), [id]);
  const [error, setError] = useState("");
  const mutate = async (method, path, body) => {
    setError("");
    try {
      await json(method, path, body);
      notify("Đã cập nhật đơn hàng thành công.");
      r.reload();
      onUpdated?.();
      emitNotificationsChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  const o = r.data;
  const admin = user.role === "Admin";
  const isBuyer = o && user.id === o.buyerId;
  const isSeller = o && user.id === o.sellerId;

  const states =
    !o || ["Cancelled", "Completed"].includes(o.status)
      ? []
      : [
          ...(admin ? ["Processing", "Pending", "Cancelled"] : []),
          ...((admin || isSeller) && o.shippingAddress ? ["Shipped"] : []),
          ...(admin || (isBuyer && o.status !== "Pending") ? ["Completed"] : []),
        ].filter((state) => state !== o.status);

  const stepIdx = o ? ORDER_STEPS.findIndex(([k]) => k === o.status) : -1;

  return (
    <>
      <Feedback {...r} />
      {o && (
        <div className="panel form-wrap" style={{ maxWidth: 740 }}>
          <div className="meta-row">
            <div>
              <div className="eyebrow">Đơn hàng #{id}</div>
              <h1 style={{ margin: "4px 0 0" }}>{o.productName}</h1>
            </div>
            <StatusBadge value={o.status} />
          </div>

          {o.status === "Cancelled" ? (
            <div className="notice error" style={{ marginTop: 18 }}>
              Đơn hàng này đã bị hủy bởi Quản trị viên.
            </div>
          ) : (
            <div className="order-stepper" aria-label="Tiến độ đơn hàng">
              {ORDER_STEPS.map(([key, num, label], idx) => {
                const cls =
                  idx < stepIdx
                    ? "done"
                    : idx === stepIdx
                      ? key === "Completed"
                        ? "done"
                        : "current"
                      : "";
                return (
                  <div key={key} className={`step-node ${cls}`}>
                    <span>{idx < stepIdx || (idx === stepIdx && key === "Completed") ? "✓" : num}</span>
                    <div>{label}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bid-price-banner">
            <div className="eyebrow">Giá trúng đấu giá</div>
            <div className="price">{money(o.finalPrice)}</div>
            <div className="meta-row small muted">
              <span>Người mua: <strong>{o.buyerName}</strong></span>
              <span>Người bán: <strong>{o.sellerName}</strong></span>
              <span>Ngày tạo: {date(o.createdAt)}</span>
            </div>
          </div>

          <div className="notice" style={{ marginBottom: 18 }}>
            <strong>Địa chỉ giao hàng:</strong>{" "}
            {o.shippingAddress || "Chưa cập nhật (người mua vui lòng nhập bên dưới)"}
            {o.completedAt && (
              <div className="small muted" style={{ marginTop: 4 }}>
                Hoàn tất lúc: {date(o.completedAt)}
              </div>
            )}
          </div>

          {isBuyer && ["Pending", "Processing"].includes(o.status) && (
            <form
              style={{ marginBottom: 18 }}
              onSubmit={(e) => {
                e.preventDefault();
                mutate("PATCH", `/api/orders/${id}/shipping-address`, {
                  shippingAddress: values(e).shippingAddress,
                });
              }}
            >
              <Field
                label="Cập nhật địa chỉ nhận hàng"
                name="shippingAddress"
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP…"
                value={o.shippingAddress}
                maxLength={500}
                required
              />
              <button className="btn dark">Lưu địa chỉ giao hàng</button>
            </form>
          )}

          {states.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate("PATCH", `/api/orders/${id}/status`, {
                  status: values(e).status,
                });
              }}
            >
              <div className="field">
                <label htmlFor="orderStatus">Chuyển trạng thái đơn hàng</label>
                <select id="orderStatus" name="status">
                  {states.map((s) => (
                    <option key={s} value={s}>
                      {
                        {
                          Processing: "Đang xử lý (Processing)",
                          Shipped: "Đang giao hàng (Shipped)",
                          Pending: "Chờ địa chỉ (Pending)",
                          Completed: "Xác nhận đã nhận & Hoàn tất (Completed)",
                          Cancelled: "Hủy đơn hàng (Cancelled)",
                        }[s]
                      }
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn">Cập nhật trạng thái</button>
            </form>
          )}

          {isSeller && !o.shippingAddress && o.status === "Pending" && (
            <div className="notice warn">
              Đang chờ người mua (<strong>{o.buyerName}</strong>) nhập địa chỉ nhận hàng trước khi bạn chuyển sang Đang giao.
            </div>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>
      )}
    </>
  );
}

export function Notifications({ notify }) {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const r = useRemote(
    () =>
      api(
        `/api/notifications?unreadOnly=${unreadOnly}&page=${page}&pageSize=20`,
      ),
    [unreadOnly, page],
  );

  const update = async (path, msg) => {
    try {
      await api(path, { method: "PATCH" });
      r.reload();
      emitNotificationsChanged();
      if (msg) notify(msg);
    } catch (e) {
      notify(e.message);
    }
  };

  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Cập nhật hoạt động</div>
          <h1>Thông báo</h1>
        </div>
        <button
          className="btn secondary"
          disabled={!r.data?.totalCount}
          onClick={() =>
            update("/api/notifications/read-all", "Đã đánh dấu đọc tất cả thông báo.")
          }
        >
          ✓ Đọc tất cả
        </button>
      </div>
      <div className="status-tabs">
        <button
          type="button"
          aria-pressed={!unreadOnly}
          onClick={() => {
            setUnreadOnly(false);
            setPage(1);
          }}
        >
          Tất cả thông báo
        </button>
        <button
          type="button"
          aria-pressed={unreadOnly}
          onClick={() => {
            setUnreadOnly(true);
            setPage(1);
          }}
        >
          Chỉ chưa đọc
        </button>
      </div>
      <Feedback {...r} />
      <div className="panel">
        {r.data?.items?.map((n) => (
          <div
            className={`notification ${n.isRead ? "" : "unread"}`}
            key={n.id}
          >
            <div className="meta-row">
              <h3>
                {!n.isRead && (
                  <span
                    className="badge Active"
                    style={{ marginRight: 8, verticalAlign: "middle" }}
                  >
                    Mới
                  </span>
                )}
                {n.title}
              </h3>
              <span className="small muted">{date(n.createdAt)}</span>
            </div>
            <p>{n.message}</p>
            {!n.isRead && (
              <button
                className="btn secondary sm"
                onClick={() => update(`/api/notifications/${n.id}/read`)}
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
        ))}
        {!r.loading && !r.error && !r.data?.items?.length && (
          <div className="empty" style={{ border: 0 }}>
            {unreadOnly
              ? "Bạn đã đọc hết tất cả thông báo!"
              : "Chưa có thông báo nào."}
          </div>
        )}
      </div>
      <Pager data={r.data} page={page} onPage={setPage} />
    </>
  );
}

export function Profile({ go, onProfile, notify }) {
  const r = useRemote(() => api("/api/users/me"), []);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const v = values(e);
      const x = await json("PUT", "/api/users/me", {
        fullName: v.fullName || null,
        phoneNumber: v.phoneNumber || null,
      });
      onProfile(x);
      r.reload();
      notify("Đã lưu hồ sơ cá nhân.");
    } catch (x) {
      setError(x.message);
    }
  };

  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Tài khoản BidNet</div>
          <h1>Hồ sơ cá nhân</h1>
        </div>
        <button className="btn secondary" onClick={() => go("/my-bids")}>
          Xem lịch sử đặt giá →
        </button>
      </div>
      <Feedback {...r} />
      {r.data && (
        <div className="panel form-wrap">
          <div className="profile-banner">
            <div className="profile-avatar-lg">
              {(r.data.fullName || r.data.username).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="actions" style={{ marginBottom: 4 }}>
                <strong style={{ fontSize: 18 }}>
                  {r.data.fullName || r.data.username}
                </strong>
                <span className={`role-pill-light ${r.data.role}`}>
                  {r.data.role}
                </span>
                <span className={`badge ${r.data.isActive ? "Active" : "Cancelled"}`}>
                  <span className="badge-dot" aria-hidden="true" />
                  {r.data.isActive ? "Hoạt động" : "Đã khóa"}
                </span>
              </div>
              <div className="small muted">
                @{r.data.username} · {r.data.email}
              </div>
            </div>
          </div>
          <form onSubmit={submit}>
            <Field
              label="Họ và tên"
              name="fullName"
              maxLength={200}
              value={r.data.fullName}
            />
            <Field
              label="Số điện thoại"
              name="phoneNumber"
              type="tel"
              maxLength={20}
              value={r.data.phoneNumber}
            />
            {error && <div className="notice error">{error}</div>}
            <button className="btn dark">Lưu hồ sơ</button>
          </form>
        </div>
      )}
    </>
  );
}

export function MyBids({ go }) {
  const [page, setPage] = useState(1);
  const r = useRemote(
    () => api(`/api/users/me/bids?page=${page}&pageSize=20`),
    [page],
  );
  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Hoạt động đấu giá</div>
          <h1>Lịch sử đặt giá của tôi</h1>
        </div>
        <button className="btn secondary" onClick={() => go("/profile")}>
          ← Hồ sơ cá nhân
        </button>
      </div>
      <Feedback {...r} />
      <div className="panel table-wrap" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Mã lượt</th>
              <th>Phiên đấu giá</th>
              <th>Số tiền đã đặt</th>
              <th>Thời điểm</th>
            </tr>
          </thead>
          <tbody>
            {r.data?.items?.map((b) => (
              <tr key={b.id}>
                <td className="mono">#{b.id}</td>
                <td>
                  <button
                    className="btn secondary sm"
                    onClick={() => go(`/product/${b.productId}`)}
                  >
                    {b.productName || `Sản phẩm #${b.productId}`} ↗
                  </button>
                </td>
                <td className="mono" style={{ fontWeight: 700, color: "var(--blue)" }}>
                  {money(b.amount)}
                </td>
                <td className="muted">{date(b.bidTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!r.loading && !r.error && !r.data?.items?.length && (
          <div className="empty" style={{ border: 0, borderRadius: 0 }}>
            Bạn chưa thực hiện lượt đặt giá nào.
          </div>
        )}
      </div>
      <Pager data={r.data} page={page} onPage={setPage} />
    </>
  );
}
