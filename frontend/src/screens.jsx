import React, { useEffect, useState } from "react";
import { api, json, money, date, getSession, parseApiDate } from "./api";
import useRemote from "./useRemote";
import { OrderHistory } from "./Workflows.jsx";
import ProfilePage from "./ProfilePage.jsx";
import { LoadingState, ErrorState } from "./UI.jsx";

function Feedback({ loading, error, reload }) {
  return (
    <>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && <LoadingState />}
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
const Badge = ({ value }) => (
  <span className={`badge ${value}`}>
    {{
      Scheduled: "Sắp diễn ra",
      Active: "Đang diễn ra",
      Completed: "Đã kết thúc",
      Cancelled: "Đã hủy",
      Pending: "Chờ xử lý",
      Paid: "Đã thanh toán",
      Delivered: "Đã giao",
    }[value] || value}
  </span>
);
function Pager({ data, page, onPage }) {
  const total = Math.ceil((data?.totalCount || 0) / (data?.pageSize || 20));
  return total > 1 ? (
    <div className="pagination">
      <button
        className="btn secondary"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        Trước
      </button>
      <span>
        Trang {page}/{total}
      </span>
      <button
        className="btn secondary"
        disabled={page === total}
        onClick={() => onPage(page + 1)}
      >
        Sau
      </button>
    </div>
  ) : null;
}

export function MyProducts({ go }) {
  const [page, setPage] = useState(1),
    r = useRemote(
      () => api(`/api/products/me?page=${page}&pageSize=12`),
      [page],
    );
  return (
    <>
      <div className="section-head">
        <h1>Sản phẩm của tôi</h1>
        <button className="btn" onClick={() => go("/product/new")}>
          Đăng sản phẩm
        </button>
      </div>
      <Feedback {...r} />
      <div className="grid">
        {r.data?.items?.map((x) => (
          <article className="card" key={x.id}>
            <div className="card-image">
              {x.imageUrl ? <img src={x.imageUrl} alt={x.name} /> : "◇"}
            </div>
            <div className="card-body">
              <Badge value={x.status} />
              <h3>{x.name}</h3>
              <div className="price">{money(x.currentPrice)}</div>
              <div className="actions">
                <button
                  className="btn dark"
                  onClick={() => go(`/product/${x.id}`)}
                >
                  Chi tiết
                </button>
                {x.status === "Scheduled" && (
                  <button
                    className="btn secondary"
                    onClick={() => go(`/product/${x.id}/edit`)}
                  >
                    Sửa
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!r.loading && !r.error && !r.data?.items?.length && (
        <div className="empty">Bạn chưa đăng sản phẩm nào.</div>
      )}
      <Pager data={r.data} page={page} onPage={setPage} />
    </>
  );
}

export function ProductForm({ id, go, notify, user }) {
  const product = useRemote(
    () => (id ? api(`/api/products/${id}`) : Promise.resolve({})),
    [id],
  );
  const categories = useRemote(() => api("/api/Categories"), []);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const v = values(e);
    setBusy(true);
    setError("");
    try {
      const start = new Date(v.startTime),
        end = new Date(v.endTime);
      if (start <= new Date() || end <= start)
        throw new Error(
          "Thời gian bắt đầu phải ở tương lai và thời gian kết thúc phải sau thời gian bắt đầu.",
        );
      const body = {
        version: id ? product.data.version : undefined,
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
      notify("Đã lưu sản phẩm.");
      go(`/product/${saved.id}`);
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };
  const local = (x) =>
    x
      ? new Date(
          parseApiDate(x).getTime() -
            parseApiDate(x).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
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
    return <p className="empty">Bạn không thể sửa phiên này.</p>;
  return (
    <div className="panel form-wrap">
      <h1>{id ? "Sửa sản phẩm" : "Đăng sản phẩm"}</h1>
      <p className="muted">
        Chọn thời gian theo giờ địa phương. Chỉ sửa được phiên chưa bắt đầu và
        chưa có lượt đặt giá.
      </p>
      <form onSubmit={submit}>
        <Field
          label="Tên sản phẩm"
          name="name"
          value={x.name}
          required
          maxLength={200}
        />
        <div className="field">
          <label htmlFor="description">Mô tả</label>
          <textarea
            id="description"
            name="description"
            defaultValue={x.description || ""}
            maxLength={2000}
          />
        </div>
        <div className="form-grid">
          <Field
            label="Giá khởi điểm (VND)"
            name="startingPrice"
            type="number"
            min={1000}
            max={100000000000}
            step={1}
            value={x.startingPrice}
            required
          />
          <div className="field">
            <label htmlFor="categoryId">Danh mục</label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={x.categoryId || ""}
            >
              <option value="">Chưa chọn</option>
              {categories.data?.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Bắt đầu"
            name="startTime"
            type="datetime-local"
            value={local(x.startTime)}
            required
          />
          <Field
            label="Kết thúc"
            name="endTime"
            type="datetime-local"
            value={local(x.endTime)}
            required
          />
        </div>
        <Field
          label="URL ảnh chính (tùy chọn)"
          name="imageUrl"
          type="text"
          value={x.imageUrl}
        />
        {error && <div className="notice error">{error}</div>}
        <button className="btn dark" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu sản phẩm"}
        </button>
      </form>
    </div>
  );
}

export function Orders({ go }) {
  const r = useRemote(() => api("/api/Orders/me"), []);
  return (
    <>
      <div className="section-head">
        <h1>Đơn hàng của tôi</h1>
      </div>
      <Feedback {...r} />
      <div className="panel table-wrap">
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
            {r.data?.map((o) => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td>{o.productName}</td>
                <td>{money(o.finalPrice)}</td>
                <td>
                  {o.buyerId === getSession()?.user.id
                    ? "Người mua"
                    : "Người bán"}
                </td>
                <td>
                  <Badge value={o.status} />
                </td>
                <td>
                  <button
                    className="btn secondary"
                    onClick={() => go(`/order/${o.id}`)}
                  >
                    Chi tiết
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!r.loading && !r.error && !r.data?.length && (
          <div className="empty">Chưa có đơn hàng liên quan.</div>
        )}
      </div>
    </>
  );
}
export function OrderDetail({ id, user, notify }) {
  const r = useRemote(() => api(`/api/Orders/${id}`), [id]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mutate = async (method, path, body) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await json(method, path, { ...body, version: r.data.version });
      notify("Đã cập nhật đơn hàng.");
      await r.reload();
    } catch (e) {
      setError(e.message);
      await r.reload();
    } finally {
      setBusy(false);
    }
  };
  const o = r.data;
  return (
    <>
      <Feedback {...r} />
      {o && (
        <div className="panel form-wrap">
          <h1>Đơn hàng #{id}</h1>
          <h2>{o.productName}</h2>
          <div className="meta-row">
            <div className="price">{money(o.finalPrice)}</div>
            <Badge value={o.status} />
          </div>
          <p>
            Người mua: {o.buyerName}
            <br />
            Người bán: {o.sellerName}
            <br />
            Ngày tạo: {date(o.createdAt)}
          </p>
          <p>Địa chỉ: {o.shippingAddress || "Chưa cập nhật"}</p>
          <p>Người nhận: {o.recipientName || "Chưa cập nhật"} · {o.recipientPhone || "Chưa có số điện thoại"}</p>
          <p>Nhận tiền: {date(o.paidAt)} · Hoàn tất: {date(o.completedAt)}</p>
          {o.cancellationReason && <p>Lý do hủy: {o.cancellationReason}</p>}
          {user.role !== "Admin" && <a href={`#/contact?orderId=${id}`}>Yêu cầu hỗ trợ đơn hàng</a>}
          {user.id === o.buyerId && ["Pending", "Paid"].includes(o.status) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate("PATCH", `/api/Orders/${id}/shipping-address`, {
                  shippingAddress: values(e).shippingAddress,
                  recipientName: values(e).recipientName,
                  recipientPhone: values(e).recipientPhone,
                });
              }}
            >
              <Field
                label="Địa chỉ giao hàng"
                name="shippingAddress"
                value={o.shippingAddress}
                maxLength={500}
                required
              />
               <Field label="Tên người nhận" name="recipientName" value={o.recipientName} maxLength={200} required />
               <Field label="Điện thoại người nhận" name="recipientPhone" value={o.recipientPhone} maxLength={20} required />
               <button className="btn dark" disabled={busy}>Lưu địa chỉ</button>
            </form>
          )}
          {(user.id === o.sellerId || user.role === "Admin") &&
            ["Pending", "Paid"].includes(o.status) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate("PATCH", `/api/Orders/${id}/status`, {
                    status: values(e).status,
                    note: values(e).note,
                  });
                }}
              >
                <div className="field">
                  <label htmlFor="orderStatus">Chuyển trạng thái</label>
                  <select id="orderStatus" name="status">
                    {(o.status === "Pending"
                      ? ["Paid", "Cancelled"]
                      : ["Delivered"]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {
                          {
                            Paid: "Xác nhận đã nhận tiền",
                            Delivered: "Xác nhận đã giao hàng",
                            Cancelled: "Đã hủy",
                          }[s]
                        }
                      </option>
                    ))}
                  </select>
                </div>
                <p className="muted small">Chỉ xác nhận sau khi đã kiểm tra giao dịch hoặc giao nhận thực tế.</p>
                <Field label="Ghi chú (bắt buộc khi hủy)" name="note" maxLength={500} />
                <button className="btn secondary" disabled={busy}>Cập nhật trạng thái</button>
              </form>
            )}
          {error && <div className="notice error">{error}</div>}
          <OrderHistory id={id} version={o.version} />
        </div>
      )}
    </>
  );
}
export function Notifications({ notify }) {
  const [busy, setBusy] = useState(false);
  const r = useRemote(() => api("/api/Notifications/me"), []);
  const update = async (path) => {
    if (busy) return;
    setBusy(true);
    try {
      await api(path, { method: "PATCH" });
      await r.reload();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="section-head">
        <h1>Thông báo</h1>
        <button
          className="btn secondary"
          disabled={busy || !r.data?.some((n) => !n.isRead)}
          onClick={() => update("/api/Notifications/read-all")}
        >
          Đọc tất cả
        </button>
      </div>
      <Feedback {...r} />
      <div className="panel">
        {r.data?.map((n) => (
          <div
            className={`notification ${n.isRead ? "" : "unread"}`}
            key={n.id}
          >
            <div className="meta-row">
              <h3>{n.title}</h3>
              <span className="small muted">{date(n.createdAt)}</span>
            </div>
            <p>{n.message}</p>
            {(n.ticketId || n.orderId || n.productId) && <a className="btn secondary" href={n.ticketId ? `#/support/${n.ticketId}` : n.orderId ? `#/order/${n.orderId}` : `#/product/${n.productId}`}>Xem chi tiết</a>}
            {!n.isRead && (
              <button
                className="btn secondary"
                onClick={() => update(`/api/Notifications/${n.id}/read`)}
                disabled={busy}
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
        ))}
        {!r.loading && !r.error && !r.data?.length && (
          <div className="empty">Chưa có thông báo.</div>
        )}
      </div>
    </>
  );
}
export function Profile(props) { return <ProfilePage {...props} />; }
export function MyBids({ go }) {
  const [page, setPage] = useState(1),
    r = useRemote(
      () => api(`/api/users/me/bids?page=${page}&pageSize=20`),
      [page],
    );
  return (
    <>
      <div className="section-head">
        <h1>Lịch sử đặt giá của tôi</h1>
      </div>
      <Feedback {...r} />
      <div className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Phiên</th>
              <th>Số tiền</th>
              <th>Thời điểm</th>
            </tr>
          </thead>
          <tbody>
            {r.data?.items?.map((b) => (
              <tr key={b.id}>
                <td>#{b.id}</td>
                <td>
                  <button
                    className="btn secondary"
                    onClick={() => go(`/product/${b.productId}`)}
                  >
                    Sản phẩm #{b.productId}
                  </button>
                </td>
                <td>{money(b.amount)}</td>
                <td>{date(b.bidTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!r.loading && !r.error && !r.data?.items?.length && (
          <div className="empty">Chưa có lượt giá.</div>
        )}
      </div>
      <Pager data={r.data} page={page} onPage={setPage} />
    </>
  );
}
