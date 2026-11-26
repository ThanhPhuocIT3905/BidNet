import React, { useEffect, useRef, useState } from "react";
import { LotPhoto, isPlaceholderImage, priceLabel } from "./Lot.jsx";
import { Lightbox, Magnifier } from "./ImageZoom.jsx";
import { CancelAuction } from "./AdminWorkspace";
import useRemote from "./useRemote";
import { Modal, useConfirm } from "./UI.jsx";
import Avatar from "./Avatar.jsx";
import * as signalR from "@microsoft/signalr";
import { API_BASE, api, json, getSession, money, date, parseApiDate } from "./api";
import {
  AuctionCard,
  Countdown,
  FavoriteButton,
  useApi,
  useFavorites,
  useTick,
} from "./widgets.jsx";

// Đọc số tiền VND thành chữ tiếng Việt rõ ràng, tự nhiên (tránh nhầm lẫn hàng triệu, trăm nghìn...)
function readGroup3(n, showZeroHundred) {
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const res = [];
  if (h > 0 || showZeroHundred) {
    res.push(digits[h] + " trăm");
  }
  if (t === 0 && u > 0) {
    if (h > 0 || showZeroHundred) res.push("lẻ");
    res.push(digits[u]);
  } else if (t === 1) {
    res.push("mười");
    if (u === 1) res.push("một");
    else if (u === 5) res.push("lăm");
    else if (u > 0) res.push(digits[u]);
  } else if (t > 1) {
    res.push(digits[t] + " mươi");
    if (u === 1) res.push("mốt");
    else if (u === 4) res.push("tư");
    else if (u === 5) res.push("lăm");
    else if (u > 0) res.push(digits[u]);
  }
  return res.join(" ");
}

export function numberToVietnameseWords(num) {
  if (!num || isNaN(num) || num <= 0) return "";
  num = Math.floor(num);
  if (num === 0) return "Không đồng";
  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const groups = [];
  let temp = num;
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const gText = readGroup3(g, i < groups.length - 1);
      parts.push(gText + (scales[i] ? " " + scales[i] : ""));
    }
  }
  const text = parts.join(" ").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1) + " đồng";
}

// Bảng ánh xạ mã lỗi API → đúng câu thông báo trong đặc tả nghiệp vụ
const BID_ERROR_MESSAGES = {
  bid_too_low: "Giá đặt không hợp lệ. Vui lòng đặt giá cao hơn.",
  bid_increment: "Giá đặt phải tăng theo bước giá quy định.",
  bid_conflict: "Giá đã thay đổi. Vui lòng kiểm tra và đặt lại.",
  auction_not_active: "Phiên đấu giá đã kết thúc. Bạn không thể đặt giá.",
  seller_cannot_bid: "Bạn không thể đặt giá cho sản phẩm của chính mình.",
};

const bidErrorMessage = (failure) => {
  if (failure?.status === 401) return "Vui lòng đăng nhập để tham gia đấu giá.";
  if (failure?.code && BID_ERROR_MESSAGES[failure.code]) return BID_ERROR_MESSAGES[failure.code];
  if (failure?.status === 403 || failure?.code === "seller_cannot_bid")
    return "Bạn không thể đặt giá cho sản phẩm của chính mình.";
  if (failure?.status === 409) {
    if (failure?.code === "auction_not_active")
      return "Phiên đấu giá đã kết thúc. Bạn không thể đặt giá.";
    return "Giá đã thay đổi. Vui lòng kiểm tra và đặt lại.";
  }
  // Không có status: fetch thất bại (mất mạng, backend không chạy) hoặc lỗi 5xx.
  if (!failure?.status || failure.status >= 500)
    return "Không thể gửi giá. Vui lòng thử lại.";
  return BID_ERROR_MESSAGES[failure?.code] || failure.message || "Không thể gửi giá. Vui lòng thử lại.";
};

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
export function Product({ id, user, admin, go, notify, openAuth }) {
  const confirm = useConfirm();
  useTick();
  const bidLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedImage, selectImage] = useState(null);
  const [lightbox, setLightbox] = useState(false);
  const [latestBid, setLatestBid] = useState(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const product = useRemote(() => api(`/api/products/${id}`), [id]),
    bids = useRemote(
      () => api(`/api/products/${id}/bids?page=${historyPage}&pageSize=20`),
      [id, historyPage],
    ),
    images = useRemote(() => api(`/api/products/${id}/images`), [id]);
  const [error, setError] = useState(""),
    [placedBid, setPlacedBid] = useState(null),
    [wonAuction, setWonAuction] = useState(false),
    [bidFailure, setBidFailure] = useState(""),
    [rawAmount, setRawAmount] = useState(""),
    [connected, setConnected] = useState(false);
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavorites();
  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: item?.name || "BidNet", url });
      else {
        await navigator.clipboard.writeText(url);
        notify("Đã sao chép liên kết phiên.");
      }
    } catch {
      notify("Không thể chia sẻ tự động. Hãy sao chép địa chỉ trên trình duyệt.");
    }
  };
  useEffect(() => {
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
        if (live) {
          setConnected(true);
          product.reload();
          bids.reload();
        }
      } catch {
        if (live) setConnected(false);
      }
    });
    c.on("BidAccepted", (event) => {
      if (event?.productId === id) setLatestBid(event);
      product.reload();
      bids.reload();
    });
    c.on("AuctionClosed", (payload) => {
      product.reload();
      // Chỉ chúc mừng đúng người thắng khi phiên kết thúc bình thường.
      if (payload?.status === "Completed" && payload.winnerId != null && payload.winnerId === user?.id)
        setWonAuction(true);
    });
    c.start()
      .then(() => c.invoke("JoinProduct", id))
      .then(() => live && setConnected(true))
      .catch(() => live && setConnected(false));
    return () => {
      live = false;
      c.stop();
    };
  }, [id, user?.id, historyPage]);
  useEffect(() => setLatestBid(null), [id]);
  useEffect(() => {
    const timer = setInterval(() => {
      product.reload();
      bids.reload();
    }, 15000);
    return () => clearInterval(timer);
  }, [id, historyPage]);
  const loadedItem = product.data;
  const item = loadedItem && latestBid?.productId === id
    ? {
        ...loadedItem,
        currentPrice: Math.max(loadedItem.currentPrice, latestBid.currentPrice),
        minimumBid: Math.max(loadedItem.minimumBid || 0, latestBid.minimumBid || 0),
        bidCount: Math.max(loadedItem.bidCount || 0, latestBid.bidCount || 0),
        leadingBidderName: latestBid.bidderName,
      }
    : loadedItem;
  const minBid = item?.minimumBid;
  const increment = item?.minBidIncrement;
  const canBid = item?.status === "Active" &&
    Date.now() >= parseApiDate(item.startTime).getTime() &&
    Date.now() < parseApiDate(item.endTime).getTime();
  // Gallery dùng chung cho lightbox: ảnh chính + ảnh tải lên, bỏ ảnh minh họa
  // danh mục và ảnh trùng.
  const photoList = [];
  const addPhoto = (url, label) => {
    if (isPlaceholderImage(url) || photoList.some((photo) => photo.url === url)) return;
    photoList.push({ url, label });
  };
  addPhoto(item?.imageUrl, "Ảnh chính");
  (images.data || []).forEach((image) => addPhoto(image.url, image.fileName));
  const photo = selectedImage && photoList.some((entry) => entry.url === selectedImage)
    ? selectedImage
    : photoList[0]?.url || "";
  const photoIndex = Math.max(
    0,
    photoList.findIndex((entry) => entry.url === photo),
  );
  const historyItems = bids.data?.items || [];
  const liveHistoryItem = latestBid?.productId === id
    ? {
        id: latestBid.bidId || `live-${latestBid.bidTime}`,
        amount: latestBid.currentPrice,
        bidTime: latestBid.bidTime,
        bidderName: latestBid.bidderName,
      }
    : null;
  const displayedHistory = liveHistoryItem &&
    !historyItems.some((entry) => entry.id === liveHistoryItem.id)
    ? [liveHistoryItem, ...historyItems]
    : historyItems;
  const bid = async (e) => {
    e.preventDefault();
    if (bidLock.current || !canBid || admin || minBid == null) return;

    // Lấy số tiền từ rawAmount (được loại bỏ mọi ký tự phân cách như chấm/phẩy)
    const rawVal = rawAmount || (document.getElementById("amount")?.value || "").replace(/\D/g, "");
    const amount = Number(rawVal);

    // Xử lý kiểm tra đầu vào trước khi gọi API để hiển thị modal tiếng Việt chuẩn đặc tả,
    // không để trình duyệt chặn bằng popup tooltip tiếng Anh mặc định
    if (!amount || isNaN(amount) || amount <= 0 || amount < minBid) {
      setBidFailure(BID_ERROR_MESSAGES.bid_too_low);
      product.reload();
      bids.reload();
      return;
    }

    if (increment != null && increment > 0 && (amount - minBid) % increment !== 0) {
      setBidFailure(BID_ERROR_MESSAGES.bid_increment);
      product.reload();
      bids.reload();
      return;
    }

    bidLock.current = true;
    setSubmitting(true);
    try {
      const result = await json("POST", `/api/products/${id}/bids`, { amount });
      setRawAmount("");
      setLatestBid({
        productId: id,
        bidId: result?.id,
        currentPrice: result?.amount ?? amount,
        minimumBid: (result?.amount ?? amount) + (increment || 0),
        bidCount: Math.max(
          Number(item?.bidCount || 0) + 1,
          Number(bids.data?.totalCount || 0) + 1,
        ),
        bidTime: result?.bidTime || new Date().toISOString(),
        bidderName: result?.bidderName || user.fullName || user.username || "Bạn",
      });
      setPlacedBid({ amount: result?.amount ?? amount });
      product.reload();
      bids.reload();
      setError("");
    } catch (x) {
      setBidFailure(bidErrorMessage(x));
      product.reload();
      bids.reload();
    } finally {
      bidLock.current = false;
      setSubmitting(false);
    }
  };
  const upload = async (e) => {
    e.preventDefault();
    if (mediaBusy) return;
    setMediaBusy(true);
    const form = e.currentTarget;
    try {
      await api(`/api/products/${id}/images`, {
        method: "POST",
        body: new FormData(form),
      });
      images.reload();
      product.reload();
      form.reset();
      notify("Đã tải ảnh lên.");
    } catch (x) {
      setError(x.message);
    } finally {
      setMediaBusy(false);
    }
  };
  const remove = async (imageId) => {
    if (mediaBusy || !await confirm({ title: "Xóa ảnh sản phẩm", message: "Ảnh sẽ được gỡ khỏi phiên đấu giá.", action: "Xóa ảnh", danger: true })) return;
    setMediaBusy(true);
    try {
      await api(`/api/product-images/${imageId}`, { method: "DELETE" });
      images.reload();
      product.reload();
      selectImage(null);
      notify("Đã xóa ảnh.");
    } catch (x) {
      setError(x.message);
    } finally {
      setMediaBusy(false);
    }
  };
  return (
    <>
      {lightbox && photoList.length > 0 && (
        <Lightbox
          photos={photoList}
          index={photoIndex}
          alt={item?.name || "Sản phẩm"}
          onIndexChange={(next) => selectImage(photoList[next].url)}
          onClose={() => setLightbox(false)}
        />
      )}
      {wonAuction && (
        <Modal title="Chúc mừng bạn!" onClose={() => setWonAuction(false)}>
          <div className="bid-success won-modal">
            <span className="bid-success-mark" aria-hidden="true">✓</span>
            <p className="bid-success-amount">Bạn đã thắng phiên đấu giá</p>
            <p className="won-product">{item?.name || `Phiên #${id}`}</p>
            <p className="muted small">Mã phiên: #{id}</p>
            <dl className="bid-success-meta">
              <div>
                <dt>Giá thắng đấu giá</dt>
                <dd>{money(item?.currentPrice)}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>Chờ thanh toán</dd>
              </div>
            </dl>
            <p className="muted small">
              Đơn hàng đã được tạo tự động. Vui lòng cập nhật địa chỉ nhận
              hàng để người bán chuẩn bị giao.
            </p>
          </div>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setWonAuction(false)}>
              Đóng
            </button>
            <button
              className="btn dark"
              autoFocus
              onClick={() => {
                setWonAuction(false);
                go("/orders");
              }}
            >
              Xem đơn hàng
            </button>
          </div>
        </Modal>
      )}
      {bidFailure && (
        <Modal title="Đặt giá không thành công" onClose={() => setBidFailure("")}>
          <div className="bid-success bid-alert">
            <span className="bid-success-mark" aria-hidden="true">!</span>
            <p className="bid-success-amount">{bidFailure}</p>
          </div>
          <div className="dialog-actions">
            <button className="btn dark" autoFocus onClick={() => setBidFailure("")}>
              Đóng
            </button>
          </div>
        </Modal>
      )}
      {placedBid && (
        <Modal title="Đặt giá thành công" onClose={() => setPlacedBid(null)}>
          <div className="bid-success">
            <span className="bid-success-mark" aria-hidden="true">✓</span>
            <p className="bid-success-amount">
              Giá <b>{money(placedBid.amount)}</b> đã được ghi nhận.
            </p>
            <p className="muted small">
              Bạn đang dẫn đầu phiên đấu giá này. Nếu có người trả giá cao hơn,
              hệ thống sẽ gửi thông báo cho bạn.
            </p>
            <dl className="bid-success-meta">
              <div>
                <dt>Giá hiện tại</dt>
                <dd>{money(item?.currentPrice ?? placedBid.amount)}</dd>
              </div>
              <div>
                <dt>Giá đặt tối thiểu tiếp theo</dt>
                <dd>{minBid == null ? "—" : money(minBid)}</dd>
              </div>
            </dl>
          </div>
          <div className="dialog-actions">
            <button className="btn dark" autoFocus onClick={() => setPlacedBid(null)}>
              Đã hiểu
            </button>
          </div>
        </Modal>
      )}
      {product.error && <div className="notice error">{product.error}</div>}
      {product.loading && !item && (
        <div className="loading">Đang tải phiên…</div>
      )}
      {item && (
        <>
          <nav className="breadcrumb" aria-label="Đường dẫn">
            <a href="#/">Trang chủ</a>
            <span>/</span>
            <a href="#/auctions">Đấu giá</a>
            {item.category && (
              <>
                <span>/</span>
                <a href={`#/auctions?category=${encodeURIComponent(item.category)}`}>
                  {item.category}
                </a>
              </>
            )}
            <span>/</span>
            <b>#{id}</b>
          </nav>
          <div className="section-head detail-head">
            <div>
              <div className="eyebrow">
                {item.category || "Chưa phân loại"} · Phiên #{id}
              </div>
              <h1>{item.name}</h1>
            </div>
            <div className="detail-actions">
              <FavoriteButton id={id} />
              <button className="btn ghost" type="button" onClick={share}>
                ↗ Chia sẻ
              </button>
              <Badge value={item.status} />
            </div>
          </div>
          <div className="split product-layout">
            <div>
              <div className="detail-image">
                {photo ? (
                  <Magnifier
                    item={item}
                    src={photo}
                    onOpen={() => setLightbox(true)}
                  />
                ) : (
                  <LotPhoto item={{ ...item, imageUrl: photo }} priority />
                )}
              </div>
              {item.imageUrl?.startsWith("/images/products/") && <p className="small muted" style={{ marginTop: 8 }}>Ảnh tham khảo model từ nhà sản xuất hoặc nhà bán lẻ.</p>}
              <div className="thumbnails">
                {item.imageUrl && !isPlaceholderImage(item.imageUrl) && <button type="button" className="gallery-thumb" aria-label="Xem ảnh chính" onClick={() => selectImage(item.imageUrl)}><img src={item.imageUrl} alt="Ảnh chính" /></button>}
                {images.data?.map((image) => (
                  <div key={image.id}>
                    <button type="button" className="gallery-thumb" onClick={() => selectImage(image.url)} aria-label={`Xem ${image.fileName}`}>
                      <img src={image.url} alt={image.fileName} />
                    </button>
                    {!admin && user?.id === item.sellerId && item.status === "Scheduled" && Date.now() < parseApiDate(item.startTime).getTime() && (
                      <button
                        className="btn secondary"
                        disabled={mediaBusy}
                        onClick={() => remove(image.id)}
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="panel">
                <h2>Thông tin phiên đấu giá</h2>
                <table className="spec-table">
                  <tbody>
                    <tr>
                      <th>Mã phiên</th>
                      <td>#{item.id}</td>
                    </tr>
                    <tr>
                      <th>Danh mục</th>
                      <td>{item.category || "Chưa phân loại"}</td>
                    </tr>
                    <tr>
                      <th>Người bán</th>
                      <td>{item.sellerName}</td>
                    </tr>
                    <tr>
                      <th>Giá khởi điểm</th>
                      <td>{money(item.startingPrice)}</td>
                    </tr>
                    <tr>
                      <th>Bước giá tối thiểu</th>
                      <td>{increment == null ? "Đang tải…" : money(increment)}</td>
                    </tr>
                    <tr>
                      <th>Bắt đầu</th>
                      <td>{date(item.startTime)}</td>
                    </tr>
                    <tr>
                      <th>Kết thúc</th>
                      <td>{date(item.endTime)}</td>
                    </tr>
                    <tr>
                      <th>Trạng thái</th>
                      <td>
                        <Badge value={item.status} />
                      </td>
                    </tr>
                    {item.status === "Completed" && (
                      <tr>
                        <th>Người thắng</th>
                        <td>{item.winnerName || "Không có lượt giá hợp lệ"}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <h2>Mô tả sản phẩm</h2>
                <p className="detail-description">
                  {item.description || "Người bán chưa cung cấp mô tả cho sản phẩm này."}
                </p>
                <p className="muted small">
                  Thông tin do người bán cung cấp. BidNet không xác minh tình trạng thực tế
                  của sản phẩm; người mua nên kiểm tra trước khi thanh toán.
                </p>
              </div>
              <div className="seller-card">
                <Avatar user={{ username: item.sellerName, avatarUrl: item.sellerAvatarUrl }} />
                <div>
                  <small>Người bán</small>
                  <strong>{item.sellerName}</strong>
                  <span>Thành viên từ {item.sellerJoinedAt ? parseApiDate(item.sellerJoinedAt).toLocaleDateString("vi-VN") : "—"}</span>
                </div>
                <a
                  className="btn secondary"
                  href={
                    item.category
                      ? `#/auctions?category=${encodeURIComponent(item.category)}`
                      : "#/auctions"
                  }
                >
                  Phiên cùng danh mục
                </a>
              </div>
              {!admin && user?.id === item.sellerId && item.status === "Scheduled" && Date.now() < parseApiDate(item.startTime).getTime() && (
                <div className="panel">
                  <h2>Quản lý sản phẩm</h2>
                  {item.status === "Scheduled" && (
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
                        Thêm ảnh (JPEG, PNG, WebP, GIF; tối đa 5 MB)
                      </label>
                      <input
                        id="upload"
                        name="file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        required
                      />
                    </div>
                    <button className="btn dark" disabled={mediaBusy}>{mediaBusy ? "Đang tải…" : "Tải ảnh"}</button>
                  </form>
                </div>
              )}
            </div>
            <aside>
              <div className="panel bid-panel">
                <div className="eyebrow">{priceLabel(item)}</div>
                <div className="price">{money(item.currentPrice)}</div>
                <div className="bid-meta">
                  <span>
                    <small>Giá khởi điểm</small>
                    <b>{money(item.startingPrice)}</b>
                  </span>
                  <span>
                    <small>Bước giá</small>
                    <b>{increment == null ? "—" : money(increment)}</b>
                  </span>
                  <span>
                    <small>Lượt đặt</small>
                    <b>{item.bidCount ?? bids.data?.totalCount ?? "—"}</b>
                  </span>
                </div>
                <div className="bid-clock">
                  <small>
                    {item.status === "Scheduled"
                      ? "Phiên sẽ mở sau"
                      : "Thời gian còn lại"}
                  </small>
                  <Countdown item={item} />
                </div>
                <p className="muted small">
                  Bắt đầu: {date(item.startTime)}
                  <br />
                  Kết thúc: {date(item.endTime)}
                </p>
                {item.status === "Completed" && (
                  <p>Người thắng: {item.winnerName || "Không có"}</p>
                )}
                {item.status === "Active" && (
                  <div className="bid-leader" aria-live="polite">
                    <small>Người trả giá cao nhất</small>
                    <strong>{item.leadingBidderName || "Chưa có lượt đặt giá"}</strong>
                    {item.leadingBidderName === user?.username && user && (
                      <span className="badge Active">Bạn đang dẫn đầu</span>
                    )}
                    {item.minimumBid != null && (
                      <span>Giá đặt tối thiểu tiếp theo: <b>{money(item.minimumBid)}</b></span>
                    )}
                  </div>
                )}
                {item.status === "Cancelled" && (
                  <div className="notice error">
                    Lý do hủy: {item.cancellationReason}
                  </div>
                )}
                {item.status === "Active" && !canBid && <p role="status">Phiên hiện không nhận giá. Đang chờ cập nhật trạng thái.</p>}
                {admin && <p className="role-notice">Bạn đang xem với quyền quản trị. Tài khoản Admin không được đặt giá hoặc đăng bán.</p>}
                {canBid && !admin &&
                  user?.id !== item.sellerId &&
                  (user ? (
                    <form onSubmit={bid} noValidate className="bid-form">
                      <div className="field">
                        <label htmlFor="amount">
                          Giá đặt (VND)
                          <small className="bid-hint">
                            {minBid == null ? "Đang tải giá tối thiểu…" : `Tối thiểu ${money(minBid)}`}
                          </small>
                        </label>
                        <div className="bid-input-wrap">
                          <input
                            id="amount"
                            name="amount"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={rawAmount ? Number(rawAmount).toLocaleString("vi-VN") : ""}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "");
                              setRawAmount(digits);
                            }}
                            placeholder={minBid != null ? minBid.toLocaleString("vi-VN") : "0"}
                            disabled={submitting || minBid == null}
                            className="bid-input-currency"
                          />
                          <span className="bid-currency-symbol">₫</span>
                        </div>

                        {rawAmount && Number(rawAmount) > 0 ? (
                          <div className="bid-amount-preview">
                            <div className="bid-preview-row">
                              <span className="bid-preview-label">Số tiền bạn nhập:</span>
                              <b className="bid-preview-val">{money(Number(rawAmount))}</b>
                            </div>
                            <div className="bid-preview-words">
                              Chữ: <em>{numberToVietnameseWords(Number(rawAmount))}</em>
                            </div>
                            {Number(rawAmount) < minBid && (
                              <div className="bid-preview-warning">
                                ⚠️ Giá đặt đang thấp hơn mức giá tối thiểu ({money(minBid)})
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div className="bid-quick">
                        {[0, 1, 2, 5].map((step) => {
                          const target = minBid != null && increment != null ? minBid + step * increment : null;
                          return (
                            <button
                              type="button"
                              key={step}
                              disabled={submitting || minBid == null || increment == null}
                              onClick={() => {
                                if (target != null) setRawAmount(String(target));
                              }}
                            >
                              {target == null ? "—" : step === 0 ? `Tối thiểu (${money(target)})` : `+${step} bước (${money(target)})`}
                            </button>
                          );
                        })}
                      </div>
                      <button className="btn dark" disabled={submitting || minBid == null}>
                        {submitting ? "Đang gửi…" : "Đặt giá"}
                      </button>
                    </form>
                  ) : (
                    <button className="btn" onClick={() => openAuth("login")}>
                      Đăng nhập để đặt giá
                    </button>
                  ))}
                {connected && (
                  <p className="muted small">
                    Đang nhận cập nhật thời gian thực
                  </p>
                )}
                {item.status === "Active" && user?.id === item.sellerId && (
                  <p className="muted small">
                    Bạn là người bán phiên này nên không thể tự đặt giá.
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
                {displayedHistory.length ? (
                  displayedHistory.map((b, index) => (
                    <div className="notification meta-row" key={b.id}>
                      <strong>{b.bidderName}</strong>
                      <strong>{money(b.amount)}</strong>
                      <span className="muted small">{date(b.bidTime)}</span>
                      {index === 0 && <span className="muted small">Mới nhất</span>}
                    </div>
                  ))
                ) : (
                  <p className="muted">{bids.loading ? "Đang tải lịch sử…" : bids.error ? "Không tải được lịch sử đặt giá." : "Chưa có lượt giá."}</p>
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
          <SimilarAuctions
            category={item.category}
            currentId={item.id}
            favorites={favoriteIds}
            toggle={toggleFavorite}
          />
        </>
      )}
    </>
  );
}

function SimilarAuctions({ category, currentId, favorites, toggle }) {
  const path = category
    ? `/api/products?category=${encodeURIComponent(category)}&page=1&pageSize=8`
    : "/api/products?page=1&pageSize=8";
  const remote = useApi(path);
  /* Chỉ gợi ý phiên đang mở: phiên đã kết thúc/hủy không còn đặt giá được. */
  const items = (remote.data?.items || [])
    .filter((item) => item.id !== currentId && item.status === "Active")
    .slice(0, 4);
  if (!items.length) return null;
  return (
    <section className="home-section similar-section">
      <div className="home-section-head">
        <div>
          <h2>Phiên đang mở cùng danh mục</h2>
          <p>Còn thời gian để theo dõi và đặt giá.</p>
        </div>
        <a
          className="section-link"
          href={
            category
              ? `#/auctions?category=${encodeURIComponent(category)}`
              : "#/auctions"
          }
        >
          Xem tất cả <span aria-hidden="true">→</span>
        </a>
      </div>
      <div className="auction-grid">
        {items.map((item) => (
          <AuctionCard
            key={item.id}
            item={item}
            favorite={favorites.includes(item.id)}
            onFavorite={toggle}
          />
        ))}
      </div>
    </section>
  );
}
