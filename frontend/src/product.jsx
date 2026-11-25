import React, { useEffect, useState } from "react";
import { LotPhoto, priceLabel } from "./Lot.jsx";
import { CancelAuction } from "./AdminWorkspace";
import * as signalR from "@microsoft/signalr";
import { mediaUrl, API_BASE, api, json, getSession, money, date } from "./api";

function useRemote(fn, deps = []) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try {
      setData(await fn());
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
const Badge = ({ value }) => (
  <span className={`badge ${value}`}>
    {{
      Scheduled: "Sắp diễn ra",
      Active: "Đang diễn ra",
      Completed: "Đã kết thúc",
      Cancelled: "Đã hủy",
    }[value] || value}
  </span>
);
export function Product({ id, user, admin, go, notify }) {
  const [historyPage, setHistoryPage] = useState(1);
  const product = useRemote(() => api(`/api/products/${id}`), [id]),
    bids = useRemote(
      () => api(`/api/products/${id}/bids?page=${historyPage}&pageSize=20`),
      [id, historyPage],
    ),
    images = useRemote(() => api(`/api/products/${id}/images`), [id]);
  const [error, setError] = useState(""),
    [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!user) return;
    let live = true;
    const c = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/auction`, {
        accessTokenFactory: () => getSession()?.accessToken || "",
      })
      .withAutomaticReconnect()
      .build();
    c.onreconnecting(() => live && setConnected(false));
    c.onclose(() => live && setConnected(false));
    c.onreconnected(async () => {
      try {
        await c.invoke("JoinProduct", id);
        if (live) setConnected(true);
      } catch {
        if (live) setConnected(false);
      }
    });
    c.on("BidAccepted", () => {
      product.reload();
      bids.reload();
    });
    c.on("AuctionClosed", () => product.reload());
    c.start()
      .then(() => c.invoke("JoinProduct", id))
      .then(() => live && setConnected(true))
      .catch(() => live && setConnected(false));
    return () => {
      live = false;
      c.stop();
    };
  }, [id, user?.id, historyPage]);
  useEffect(() => {
    const timer = setInterval(() => {
      product.reload();
      bids.reload();
    }, 15000);
    return () => clearInterval(timer);
  }, [id, historyPage]);
  const item = product.data;
  const bid = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      const amount = Number(new FormData(form).get("amount"));
      await json("POST", `/api/products/${id}/bids`, { amount });
      form.reset();
      notify("Đặt giá thành công.");
      product.reload();
      bids.reload();
      setError("");
    } catch (x) {
      setError(x.message);
      product.reload();
    }
  };
  const upload = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await api(`/api/products/${id}/images/upload`, {
        method: "POST",
        body: new FormData(form),
      });
      images.reload();
      product.reload();
      form.reset();
      notify("Đã tải ảnh lên.");
    } catch (x) {
      setError(x.message);
    }
  };
  const remove = async (imageId) => {
    if (!confirm("Xóa ảnh này?")) return;
    try {
      await api(`/api/products/${id}/images/${imageId}`, { method: "DELETE" });
      images.reload();
      product.reload();
      notify("Đã xóa ảnh.");
    } catch (x) {
      setError(x.message);
    }
  };
  return (
    <>
      {product.error && <div className="notice error">{product.error}</div>}
      {product.loading && !item && (
        <div className="loading">Đang tải phiên…</div>
      )}
      {item && (
        <>
          <div className="section-head">
            <div>
              <a className="detail-back" href="#/">
                ← Khám phá
              </a>
              <div className="eyebrow">Phiên #{id}</div>
              <h1>{item.name}</h1>
            </div>
            <Badge value={item.status} />
          </div>
          <div className="split">
            <div>
              <div className="detail-image">
                <LotPhoto
                  item={{
                    ...item,
                    imageUrl: item.imageUrl || images.data?.[0]?.url,
                  }}
                  priority
                />
              </div>
              <div className="thumbnails">
                {images.data?.map((image) => (
                  <div key={image.id}>
                    <a
                      href={mediaUrl(image.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={mediaUrl(image.url)} alt={image.fileName} />
                    </a>
                    {(admin || user?.id === item.sellerId) && (
                      <button
                        className="btn secondary"
                        onClick={() => remove(image.id)}
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="panel">
                <h2>Mô tả</h2>
                <p>{item.description || "Chưa có mô tả."}</p>
                <p className="muted">
                  Danh mục: {item.category || "Chưa phân loại"} · Người bán:{" "}
                  {item.sellerName}
                </p>
              </div>
              {(admin || user?.id === item.sellerId) && (
                <div className="panel">
                  <h2>Quản lý sản phẩm</h2>
                  {user?.id === item.sellerId &&
                    item.status === "Scheduled" && (
                      <button
                        className="btn secondary"
                        onClick={() => go(`/product/${id}/edit`)}
                      >
                        Sửa sản phẩm
                      </button>
                    )}
                  <form onSubmit={upload}>
                    <div className="field">
                      <label htmlFor="upload">
                        Thêm ảnh (JPEG, PNG, WebP; tối đa 5 MB)
                      </label>
                      <input
                        id="upload"
                        name="file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        required
                      />
                    </div>
                    <button className="btn dark">Tải ảnh</button>
                  </form>
                </div>
              )}
            </div>
            <aside>
              <div className="panel">
                <div className="eyebrow">{priceLabel(item)}</div>
                <div className="price">{money(item.currentPrice)}</div>
                <p>Giá khởi điểm: {money(item.startingPrice)}</p>
                <p className="muted">
                  Bắt đầu: {date(item.startTime)}
                  <br />
                  Kết thúc: {date(item.endTime)}
                </p>
                {item.status === "Completed" && (
                  <p>Người thắng: {item.winnerName || "Không có"}</p>
                )}
                {item.status === "Cancelled" && (
                  <div className="notice error">
                    Lý do hủy: {item.cancellationReason}
                  </div>
                )}
                {item.status === "Active" &&
                  user?.id !== item.sellerId &&
                  (user ? (
                    <form onSubmit={bid}>
                      <div className="field">
                        <label htmlFor="amount">Giá đặt (VND)</label>
                        <input
                          id="amount"
                          name="amount"
                          type="number"
                          min="1"
                          step="1"
                          required
                        />
                      </div>
                      <button className="btn dark">Đặt giá</button>
                    </form>
                  ) : (
                    <button className="btn" onClick={() => go("/login")}>
                      Đăng nhập để đặt giá
                    </button>
                  ))}
                {connected && (
                  <p className="muted small">
                    Đang nhận cập nhật thời gian thực
                  </p>
                )}
                {error && <div className="notice error">{error}</div>}
                {admin && (
                  <CancelAuction
                    item={item}
                    notify={notify}
                    onDone={product.reload}
                  />
                )}
              </div>
              <div className="panel">
                <h2>Lịch sử đặt giá</h2>
                {bids.error && <div className="notice error">{bids.error}</div>}
                {bids.data?.items?.length ? (
                  bids.data.items.map((b) => (
                    <div className="notification meta-row" key={b.id}>
                      <strong>{money(b.amount)}</strong>
                      <span className="muted small">{date(b.bidTime)}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">Chưa có lượt giá.</p>
                )}
                {bids.data?.totalCount > 20 && (
                  <div className="pagination">
                    <button
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((p) => p - 1)}
                    >
                      Trước
                    </button>
                    Trang {historyPage}
                    <button
                      disabled={historyPage * 20 >= bids.data.totalCount}
                      onClick={() => setHistoryPage((p) => p + 1)}
                    >
                      Sau
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
