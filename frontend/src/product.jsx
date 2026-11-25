import React, { useEffect, useRef, useState } from "react";
import {
  BidGateCard,
  CountdownBox,
  GavelIcon,
  LotPhoto,
  priceLabel,
  StatusBadge,
} from "./Lot.jsx";
import { CancelAuction } from "./AdminWorkspace";
import * as signalR from "@microsoft/signalr";
import {
  mediaUrl,
  API_BASE,
  api,
  json,
  getSession,
  money,
  date,
  emitNotificationsChanged,
} from "./api";

function useRemote(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await fn());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
  }, deps);

  return {
    data,
    error,
    loading,
    reload: () => load(false),
    silentReload: () => load(true),
  };
}

export function Product({ id, user, admin, go, notify }) {
  const [historyPage, setHistoryPage] = useState(1);
  const [activeTab, setActiveTab] = useState("info");
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [brokenThumbs, setBrokenThumbs] = useState({});
  const [bidAmount, setBidAmount] = useState("");
  const [bidBusy, setBidBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [priceFlash, setPriceFlash] = useState(false);
  const prevPriceRef = useRef(null);

  const product = useRemote(() => api(`/api/products/${id}`), [id]);
  const bids = useRemote(
    () => api(`/api/products/${id}/bids?page=${historyPage}&pageSize=20`),
    [id, historyPage],
  );
  const images = useRemote(() => api(`/api/products/${id}/images`), [id]);
  const related = useRemote(() => api(`/api/products?page=1&pageSize=6`), [id]);

  // Reset UI state when navigating between products
  useEffect(() => {
    setActiveTab("info");
    setSelectedUrl(null);
    setHistoryPage(1);
    setBidAmount("");
    setError("");
    setPriceFlash(false);
    prevPriceRef.current = null;
  }, [id]);

  // Pulse price banner whenever currentPrice increases live (via SignalR or bid)
  useEffect(() => {
    const price = product.data?.currentPrice;
    if (price == null) return;
    if (prevPriceRef.current !== null && prevPriceRef.current !== price) {
      setPriceFlash(true);
      const t = setTimeout(() => setPriceFlash(false), 950);
      prevPriceRef.current = price;
      return () => clearTimeout(t);
    }
    prevPriceRef.current = price;
  }, [product.data?.currentPrice]);

  // Lưu ref để SignalR và polling luôn gọi bản reload mới nhất mà không ngắt kết nối khi đổi trang lịch sử giá.
  const reloadRef = useRef({ product: null, bids: null });
  reloadRef.current = {
    product: product.silentReload,
    bids: bids.silentReload,
  };

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
        reloadRef.current.product?.();
        reloadRef.current.bids?.();
      } catch {
        if (live) setConnected(false);
      }
    });
    c.on("BidAccepted", () => {
      reloadRef.current.product?.();
      reloadRef.current.bids?.();
      emitNotificationsChanged();
    });
    c.on("AuctionClosed", () => {
      reloadRef.current.product?.();
      emitNotificationsChanged();
    });

    c.start()
      .then(() => c.invoke("JoinProduct", id))
      .then(() => live && setConnected(true))
      .catch(() => live && setConnected(false));

    return () => {
      live = false;
      c.stop();
    };
  }, [id, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      reloadRef.current.product?.();
      reloadRef.current.bids?.();
    }, 15000);
    return () => clearInterval(timer);
  }, [id]);

  const item = product.data;
  const hasBids = (bids.data?.totalCount || 0) > 0;
  const minBid = item
    ? hasBids
      ? Number(item.currentPrice) + 1000
      : Number(item.startingPrice)
    : 1000;

  const gallery = [];
  if (item?.imageUrl)
    gallery.push({ id: "main", url: item.imageUrl, fileName: item.name });
  for (const img of images.data || []) {
    if (!gallery.some((g) => g.url === img.url)) gallery.push(img);
  }
  const activeUrl =
    selectedUrl && gallery.some((g) => g.url === selectedUrl)
      ? selectedUrl
      : gallery[0]?.url;

  const relatedItems = (related.data?.items || [])
    .filter((x) => x.id !== Number(id))
    .slice(0, 5);

  const placeBid = async (e) => {
    e.preventDefault();
    setBidBusy(true);
    setError("");
    try {
      const amount = Number(bidAmount);
      await json("POST", `/api/products/${id}/bids`, { amount });
      setBidAmount("");
      notify(`Đặt giá ${money(amount)} thành công!`);
      product.silentReload();
      bids.silentReload();
      emitNotificationsChanged();
    } catch (x) {
      setError(x.message);
      product.silentReload();
      bids.silentReload();
    } finally {
      setBidBusy(false);
    }
  };

  const uploadFile = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    try {
      const created = await api(`/api/products/${id}/images/upload`, {
        method: "POST",
        body: new FormData(form),
      });
      if (created?.url) setSelectedUrl(created.url);
      images.reload();
      product.silentReload();
      form.reset();
      notify("Đã tải ảnh lên thành công.");
    } catch (x) {
      setError(x.message);
    }
  };

  const addImageUrl = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const url = String(new FormData(form).get("url") || "").trim();
    if (!url) return;
    setError("");
    try {
      const created = await json("POST", `/api/products/${id}/images/url`, {
        url,
      });
      if (created?.url) setSelectedUrl(created.url);
      images.reload();
      product.silentReload();
      form.reset();
      notify("Đã thêm URL ảnh vào sản phẩm.");
    } catch (x) {
      setError(x.message);
    }
  };

  const removeImage = async (imageId) => {
    if (!confirm("Xóa ảnh này khỏi sản phẩm?")) return;
    setError("");
    try {
      await api(`/api/products/${id}/images/${imageId}`, { method: "DELETE" });
      images.reload();
      product.silentReload();
      notify("Đã xóa ảnh.");
    } catch (x) {
      setError(x.message);
    }
  };

  const isSeller = Boolean(user && item && user.id === item.sellerId);
  const canManage = Boolean(admin || isSeller);
  const sellerInitial = (item?.sellerName || "B").charAt(0).toUpperCase();

  return (
    <>
      {product.error && <div className="notice error">{product.error}</div>}
      {product.loading && !item && (
        <div className="loading">Đang tải chi tiết phiên đấu giá…</div>
      )}
      {item && (
        <>
          {/* BidGate-style Breadcrumb */}
          <nav className="breadcrumb" aria-label="Điều hướng">
            <a href="#/">Trang chủ</a>
            <span aria-hidden="true">›</span>
            <a
              href={
                item.category
                  ? `#/?category=${encodeURIComponent(item.category)}`
                  : "#/"
              }
            >
              {item.category || "Tất cả sản phẩm"}
            </a>
            <span aria-hidden="true">›</span>
            <strong>{item.name}</strong>
          </nav>

          {/* BidGate 2:1 Detail Split */}
          <div className="split">
            {/* LEFT COLUMN: Gallery + Pill Tabs */}
            <div>
              <div className="detail-image">
                <div
                  key={activeUrl || "empty"}
                  className="detail-image-stage"
                >
                  <LotPhoto item={{ ...item, imageUrl: activeUrl }} priority />
                </div>
                {activeUrl && (
                  <a
                    className="detail-image-link"
                    href={mediaUrl(activeUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Xem ảnh gốc ↗
                  </a>
                )}
              </div>

              {gallery.length > 0 && (
                <div className="thumbnails">
                  {gallery.map((image) => (
                    <div className="thumb-card" key={image.id}>
                      <button
                        type="button"
                        className={`thumb-btn ${activeUrl === image.url ? "active" : ""}`}
                        onClick={() => setSelectedUrl(image.url)}
                        title={image.fileName}
                      >
                        {brokenThumbs[image.url] ? (
                          <div
                            className="lot-fallback"
                            style={{ fontSize: 10 }}
                          >
                            <b style={{ fontSize: 13, margin: 0 }}>IMG</b>
                          </div>
                        ) : (
                          <img
                            src={mediaUrl(image.url)}
                            alt={image.fileName}
                            onError={() =>
                              setBrokenThumbs((prev) => ({
                                ...prev,
                                [image.url]: true,
                              }))
                            }
                          />
                        )}
                      </button>
                      {canManage && typeof image.id === "number" && (
                        <button
                          type="button"
                          className="btn secondary sm"
                          onClick={() => removeImage(image.id)}
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* BidGate Pill Tab Bar */}
              <div className="detail-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "info"}
                  onClick={() => setActiveTab("info")}
                >
                  Thông tin sản phẩm
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "bids"}
                  onClick={() => setActiveTab("bids")}
                >
                  Lịch sử đặt giá ({bids.data?.totalCount || 0})
                </button>
                {canManage && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "manage"}
                    onClick={() => setActiveTab("manage")}
                  >
                    Quản lý & Hình ảnh
                  </button>
                )}
              </div>

              {activeTab === "info" && (
                <div className="panel tab-panel-anim" key="tab-info" style={{ marginTop: 0 }}>
                  <h2>Thông số phiên đấu giá</h2>
                  <table className="spec-table">
                    <tbody>
                      <tr>
                        <th>Mã phiên đấu giá</th>
                        <td className="mono">#{String(id).padStart(3, "0")}</td>
                      </tr>
                      <tr>
                        <th>Danh mục</th>
                        <td>{item.category || "Chưa phân loại"}</td>
                      </tr>
                      <tr>
                        <th>Giá khởi điểm</th>
                        <td className="mono">{money(item.startingPrice)}</td>
                      </tr>
                      <tr>
                        <th>Giá hiện tại</th>
                        <td
                          className="mono"
                          style={{ color: "var(--blue)", fontWeight: 700 }}
                        >
                          {money(item.currentPrice)}
                        </td>
                      </tr>
                      <tr>
                        <th>Thời gian bắt đầu</th>
                        <td>{date(item.startTime)}</td>
                      </tr>
                      <tr>
                        <th>Thời gian kết thúc</th>
                        <td>{date(item.endTime)}</td>
                      </tr>
                      <tr>
                        <th>Người đăng bán</th>
                        <td>{item.sellerName}</td>
                      </tr>
                      {item.status === "Completed" && (
                        <tr>
                          <th>Người trúng đấu giá</th>
                          <td>
                            {item.winnerName || "Không có lượt đặt giá"}
                          </td>
                        </tr>
                      )}
                      {item.status === "Cancelled" &&
                        item.cancellationReason && (
                          <tr>
                            <th>Lý do hủy phiên</th>
                            <td>{item.cancellationReason}</td>
                          </tr>
                        )}
                    </tbody>
                  </table>

                  <h2 style={{ marginTop: 22 }}>Mô tả chi tiết</h2>
                  <p
                    style={{
                      whiteSpace: "pre-line",
                      margin: 0,
                      color: "var(--ink-soft)",
                    }}
                  >
                    {item.description ||
                      "Người bán chưa cập nhật mô tả chi tiết cho sản phẩm này."}
                  </p>
                </div>
              )}

              {activeTab === "bids" && (
                <div className="panel tab-panel-anim" key="tab-bids" style={{ marginTop: 0 }}>
                  <div className="meta-row" style={{ marginBottom: 14 }}>
                    <h2 style={{ margin: 0 }}>
                      Lịch sử đặt giá ({bids.data?.totalCount || 0} lượt)
                    </h2>
                    <span className="small muted">
                      Danh tính người đặt được bảo mật
                    </span>
                  </div>
                  {bids.error && (
                    <div className="notice error">{bids.error}</div>
                  )}
                  {bids.data?.items?.length ? (
                    bids.data.items.map((b, idx) => (
                      <div className="bid-row" key={b.id}>
                        <div>
                          <strong>{money(b.amount)}</strong>
                          {historyPage === 1 && idx === 0 && (
                            <span
                              className="badge Active"
                              style={{ marginLeft: 8 }}
                            >
                              Cao nhất
                            </span>
                          )}
                        </div>
                        <span className="muted small">{date(b.bidTime)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>
                      Chưa có lượt đặt giá nào cho phiên này.
                    </p>
                  )}
                  {bids.data?.totalCount > 20 && (
                    <div className="pagination">
                      <button
                        className="btn secondary sm"
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage((p) => p - 1)}
                      >
                        ← Trước
                      </button>
                      <span>Trang {historyPage}</span>
                      <button
                        className="btn secondary sm"
                        disabled={historyPage * 20 >= bids.data.totalCount}
                        onClick={() => setHistoryPage((p) => p + 1)}
                      >
                        Sau →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "manage" && canManage && (
                <div className="panel tab-panel-anim" key="tab-manage" style={{ marginTop: 0 }}>
                  <div className="meta-row" style={{ marginBottom: 14 }}>
                    <h2 style={{ margin: 0 }}>Quản lý sản phẩm & Hình ảnh</h2>
                    {isSeller && item.status === "Scheduled" && (
                      <button
                        className="btn outline sm"
                        onClick={() => go(`/product/${id}/edit`)}
                      >
                        Chỉnh sửa thông tin phiên
                      </button>
                    )}
                  </div>
                  <div className="form-grid">
                    <form onSubmit={uploadFile}>
                      <div className="field">
                        <label htmlFor="upload">
                          Tải ảnh từ máy (JPEG, PNG, WebP ≤ 5 MB)
                        </label>
                        <input
                          id="upload"
                          name="file"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          required
                        />
                      </div>
                      <button className="btn dark sm">Tải ảnh lên</button>
                    </form>
                    <form onSubmit={addImageUrl}>
                      <div className="field">
                        <label htmlFor="imgUrl">
                          Hoặc thêm URL ảnh (HTTPS)
                        </label>
                        <input
                          id="imgUrl"
                          name="url"
                          type="url"
                          placeholder="https://..."
                          required
                        />
                      </div>
                      <button className="btn secondary sm">Thêm URL ảnh</button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Sticky BidGate Auction Box */}
            <aside className="sticky-aside">
              <div className="panel bid-box">
                <div className="meta-row" style={{ marginBottom: 8 }}>
                  <span className="eyebrow">
                    Phiên #{String(id).padStart(3, "0")} ·{" "}
                    {item.category || "Đấu giá"}
                  </span>
                  <StatusBadge value={item.status} />
                </div>

                <h1
                  style={{
                    margin: "0 0 12px",
                    fontSize: "clamp(20px, 2vw, 24px)",
                    lineHeight: 1.3,
                    color: "var(--black)",
                  }}
                >
                  {item.name}
                </h1>

                <div className={`bid-price-banner ${priceFlash ? "price-flash" : ""}`}>
                  <div className="eyebrow">{priceLabel(item)}</div>
                  <div className="price">{money(item.currentPrice)}</div>
                  <div className="meta-row small muted">
                    <span>Khởi điểm: {money(item.startingPrice)}</span>
                    <button
                      type="button"
                      style={{
                        border: 0,
                        background: "transparent",
                        color: "var(--blue)",
                        fontWeight: 700,
                        padding: 0,
                      }}
                      onClick={() => setActiveTab("bids")}
                    >
                      {bids.data?.totalCount || 0} lượt đặt giá ›
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <CountdownBox item={item} large />
                </div>

                {item.status === "Completed" && (
                  <div className="notice warn">
                    Người chiến thắng:{" "}
                    <strong>
                      {item.winnerName || "Không có lượt đặt giá"}
                    </strong>
                  </div>
                )}

                {item.status === "Cancelled" && (
                  <div className="notice error">
                    <strong>Phiên đã bị hủy</strong>
                    {item.cancellationReason && (
                      <div>Lý do: {item.cancellationReason}</div>
                    )}
                  </div>
                )}

                {item.status === "Active" && isSeller && (
                  <div className="notice">
                    Bạn là người đăng bán phiên này nên không thể tự đặt giá.
                  </div>
                )}

                {item.status === "Active" &&
                  !isSeller &&
                  (user ? (
                    <form onSubmit={placeBid}>
                      <div className="field">
                        <label htmlFor="amount">
                          Giá đặt của bạn (tối thiểu {money(minBid)})
                        </label>
                        <input
                          id="amount"
                          name="amount"
                          type="number"
                          min={minBid}
                          step="1"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          placeholder={`Nhập từ ${minBid} trở lên`}
                          required
                        />
                      </div>
                      <div
                        className="quick-bids"
                        aria-label="Chọn nhanh mức giá"
                      >
                        {[0, 50000, 100000, 500000].map((extra) => {
                          const target = minBid + extra;
                          return (
                            <button
                              key={extra}
                              type="button"
                              className="quick-chip"
                              onClick={() => setBidAmount(String(target))}
                            >
                              {extra === 0
                                ? `Tối thiểu (${money(target)})`
                                : `+${new Intl.NumberFormat("vi-VN").format(extra)}`}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        className="btn"
                        style={{ width: "100%", padding: "11px 16px" }}
                        disabled={bidBusy}
                      >
                        <GavelIcon size={16} />
                        {bidBusy ? "Đang gửi lượt giá…" : "Đặt giá ngay"}
                      </button>
                    </form>
                  ) : (
                    <button
                      className="btn"
                      style={{ width: "100%", padding: "11px 16px" }}
                      onClick={() => go("/login")}
                    >
                      <GavelIcon size={16} />
                      Đăng nhập để tham gia đặt giá
                    </button>
                  ))}

                {connected && (
                  <div className="live-pill">
                    <span className="badge-dot" aria-hidden="true" />
                    Trực tiếp · SignalR đã kết nối
                  </div>
                )}

                {error && <div className="notice error">{error}</div>}

                {/* Seller summary card (BidGate style) */}
                <div className="seller-card-mini">
                  <div className="seller-avatar-mini" aria-hidden="true">
                    {sellerInitial}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--black)",
                      }}
                    >
                      {item.sellerName}
                    </div>
                    <div className="small muted">
                      Người đăng bán xác thực · BidNet
                    </div>
                  </div>
                </div>

                {admin && (
                  <div style={{ marginTop: 14 }}>
                    <CancelAuction
                      item={item}
                      notify={notify}
                      onDone={product.silentReload}
                    />
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/* Bottom Section: Related Auctions (BidGate style 5-col row) */}
          {relatedItems.length > 0 && (
            <section style={{ marginTop: 32 }}>
              <div className="bg-section-head">
                <h2>Phiên đấu giá khác</h2>
                <a className="btn outline sm" href="#/">
                  Xem tất cả →
                </a>
              </div>
              <div className="bg-card-grid">
                {relatedItems.map((x, idx) => (
                  <BidGateCard key={x.id} item={x} index={idx} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
