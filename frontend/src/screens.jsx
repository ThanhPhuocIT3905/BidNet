import React, { useEffect, useState, useRef } from "react";
import { api, json, money, date, getSession, parseApiDate } from "./api";
import useRemote from "./useRemote";
import { OrderHistory } from "./Workflows.jsx";
import ProfilePage from "./ProfilePage.jsx";
import { LoadingState, ErrorState, Modal } from "./UI.jsx";
import { numberToVietnameseWords } from "./product.jsx";

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
      Pending: "Chờ thanh toán",
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

export function MyProducts({ go, notify }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [layout, setLayout] = useState("grid");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [cancelingItem, setCancelingItem] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPreset, setCancelPreset] = useState("Sản phẩm không còn khả dụng");
  const [deletingItem, setDeletingItem] = useState(null);
  const [busy, setBusy] = useState(false);

  const r = useRemote(
    () => api("/api/products/me?page=1&pageSize=100"),
    [],
  );

  const allItems = r.data?.items || [];

  const total = allItems.length;
  const scheduledCount = allItems.filter((x) => x.status === "Scheduled").length;
  const activeCount = allItems.filter((x) => x.status === "Active").length;
  const completedCount = allItems.filter((x) => x.status === "Completed").length;
  const cancelledCount = allItems.filter((x) => x.status === "Cancelled").length;

  const filtered = allItems.filter((x) => {
    if (statusFilter !== "All" && x.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = (x.name || "").toLowerCase().includes(q);
      const matchCat = (x.category || "").toLowerCase().includes(q);
      const matchDesc = (x.description || "").toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchDesc) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === "price_desc") return b.currentPrice - a.currentPrice;
    if (sortBy === "price_asc") return a.currentPrice - b.currentPrice;
    if (sortBy === "ending_soon") return new Date(a.endTime) - new Date(b.endTime);
    return 0;
  });

  const pageSize = 12;
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const pagedItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handleCancelProduct = async () => {
    if (!cancelingItem || busy) return;
    setBusy(true);
    const finalReason = cancelPreset === "Khác"
      ? (cancelReason.trim() || "Người bán hủy phiên đấu giá.")
      : (cancelReason.trim() ? `${cancelPreset}: ${cancelReason.trim()}` : cancelPreset);
    try {
      await json("PATCH", `/api/products/${cancelingItem.id}/cancel`, {
        reason: finalReason
      });
      notify ? notify("Đã hủy phiên đấu giá thành công.") : alert("Đã hủy phiên đấu giá.");
      setCancelingItem(null);
      setCancelReason("");
      r.reload();
    } catch (err) {
      alert(err.message || "Không thể hủy phiên đấu giá.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingItem || busy) return;
    setBusy(true);
    try {
      await api(`/api/products/${deletingItem.id}`, { method: "DELETE" });
      notify ? notify("Đã xóa sản phẩm khỏi danh sách.") : alert("Đã xóa sản phẩm.");
      setDeletingItem(null);
      r.reload();
    } catch (err) {
      alert(err.message || "Không thể xóa sản phẩm.");
    } finally {
      setBusy(false);
    }
  };

  const renderPriceInfo = (item) => {
    if (item.status === "Scheduled") {
      return (
        <div className="seller-price-info">
          <small>Giá khởi điểm</small>
          <strong>{money(item.startingPrice)}</strong>
        </div>
      );
    }
    if (item.status === "Active") {
      return (
        <div className="seller-price-info active">
          <small>Giá hiện tại</small>
          <strong>{money(item.currentPrice)}</strong>
        </div>
      );
    }
    if (item.status === "Completed") {
      return (
        <div className="seller-price-info completed">
          <small>{item.winnerName ? "Giá thắng cuộc" : "Giá chốt"}</small>
          <strong>{money(item.currentPrice)}</strong>
          {item.winnerName && <span className="winner-tag">Thắng: {item.winnerName}</span>}
        </div>
      );
    }
    return (
      <div className="seller-price-info cancelled">
        <small>Giá khởi điểm</small>
        <strong>{money(item.startingPrice)}</strong>
        {item.cancellationReason && (
          <span className="reason-tag" title={item.cancellationReason}>
            Lý do: {item.cancellationReason}
          </span>
        )}
      </div>
    );
  };

  const renderMetaState = (item) => {
    const bids = item.bidCount || 0;
    if (item.status === "Scheduled") {
      return <span className="seller-status-pill scheduled">0 lượt đặt · Chờ mở phiên</span>;
    }
    if (item.status === "Active") {
      return <span className="seller-status-pill active">{bids} lượt đặt · Đang mở phiên</span>;
    }
    if (item.status === "Completed") {
      return <span className="seller-status-pill completed">{bids} lượt đặt · Đã đóng phiên</span>;
    }
    return <span className="seller-status-pill cancelled">{bids} lượt đặt · Đã hủy</span>;
  };

  return (
    <div className="seller-dashboard">
      <div className="seller-header">
        <div>
          <h1>Sản phẩm của tôi</h1>
          <p className="muted">Quản lý sản phẩm và các phiên đấu giá của bạn trên sàn BidNet</p>
        </div>
        <button className="btn" onClick={() => go("/product/new")}>
          + Đăng sản phẩm
        </button>
      </div>

      <div className="seller-metrics-grid">
        <button
          type="button"
          className={`seller-metric-box ${statusFilter === "All" ? "selected" : ""}`}
          onClick={() => { setStatusFilter("All"); setPage(1); }}
        >
          <div className="metric-number">{total}</div>
          <div className="metric-label">Tổng sản phẩm</div>
        </button>
        <button
          type="button"
          className={`seller-metric-box ${statusFilter === "Scheduled" ? "selected" : ""}`}
          onClick={() => { setStatusFilter("Scheduled"); setPage(1); }}
        >
          <div className="metric-number">{scheduledCount}</div>
          <div className="metric-label">Sắp diễn ra</div>
        </button>
        <button
          type="button"
          className={`seller-metric-box ${statusFilter === "Active" ? "selected" : ""}`}
          onClick={() => { setStatusFilter("Active"); setPage(1); }}
        >
          <div className="metric-number active-color">{activeCount}</div>
          <div className="metric-label">Đang đấu giá</div>
        </button>
        <button
          type="button"
          className={`seller-metric-box ${statusFilter === "Completed" ? "selected" : ""}`}
          onClick={() => { setStatusFilter("Completed"); setPage(1); }}
        >
          <div className="metric-number completed-color">{completedCount}</div>
          <div className="metric-label">Đã bán</div>
        </button>
        <button
          type="button"
          className={`seller-metric-box ${statusFilter === "Cancelled" ? "selected" : ""}`}
          onClick={() => { setStatusFilter("Cancelled"); setPage(1); }}
        >
          <div className="metric-number cancelled-color">{cancelledCount}</div>
          <div className="metric-label">Đã hủy</div>
        </button>
      </div>

      <div className="seller-toolbar">
        <div className="seller-search-box">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm theo tên, danh mục..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button type="button" className="clear-search" onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>

        <div className="seller-filters">
          <div className="seller-tabs">
            {[
              ["All", "Tất cả"],
              ["Scheduled", "Sắp diễn ra"],
              ["Active", "Đang đấu giá"],
              ["Completed", "Đã bán"],
              ["Cancelled", "Đã hủy"],
            ].map(([val, label]) => (
              <button
                type="button"
                key={val}
                className={`seller-tab-btn ${statusFilter === val ? "active" : ""}`}
                onClick={() => { setStatusFilter(val); setPage(1); }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="seller-right-tools">
            <select
              className="seller-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="price_desc">Giá cao nhất</option>
              <option value="price_asc">Giá thấp nhất</option>
              <option value="ending_soon">Sắp kết thúc</option>
            </select>

            <div className="seller-layout-switch">
              <button
                type="button"
                className={`layout-btn ${layout === "grid" ? "active" : ""}`}
                title="Dạng lưới"
                onClick={() => setLayout("grid")}
              >
                ⊞
              </button>
              <button
                type="button"
                className={`layout-btn ${layout === "list" ? "active" : ""}`}
                title="Dạng danh sách"
                onClick={() => setLayout("list")}
              >
                ☰
              </button>
            </div>
          </div>
        </div>
      </div>

      <Feedback {...r} />

      {!r.loading && !r.error && filtered.length === 0 && (
        <div className="empty seller-empty">
          <div className="empty-symbol">📦</div>
          <h2>Không tìm thấy sản phẩm nào</h2>
          <p className="muted">
            {search ? "Không có sản phẩm nào khớp với từ khóa tìm kiếm." : "Bạn chưa có sản phẩm nào ở trạng thái này."}
          </p>
          <button className="btn" onClick={() => go("/product/new")}>
            Đăng sản phẩm mới
          </button>
        </div>
      )}

      {layout === "grid" ? (
        <div className="grid seller-card-grid">
          {pagedItems.map((x) => (
            <article className="card seller-card-item" key={x.id}>
              <div className="card-image seller-card-img">
                <img
                  src={x.imageUrl || "/images/products/fujifilm-xt30-ii.webp"}
                  alt={x.name}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/images/products/fujifilm-xt30-ii.webp";
                  }}
                />
                <span className="seller-badge-pos">
                  <Badge value={x.status} />
                </span>
              </div>
              <div className="card-body seller-card-body">
                <div className="seller-category-tag">{x.category || "Chưa phân loại"} · #{x.id}</div>
                <h3 className="seller-card-title" title={x.name}>{x.name}</h3>
                
                {renderPriceInfo(x)}

                <div className="seller-meta-row">
                  {renderMetaState(x)}
                </div>

                <div className="seller-time-meta">
                  <small>Bắt đầu: {date(x.startTime)}</small>
                  <small>Kết thúc: {date(x.endTime)}</small>
                </div>

                <div className="actions seller-actions-row">
                  <button
                    className="btn dark"
                    onClick={() => go(`/product/${x.id}`)}
                  >
                    Xem chi tiết
                  </button>
                  {x.status === "Scheduled" && (
                    <button
                      className="btn secondary"
                      onClick={() => go(`/product/${x.id}/edit`)}
                    >
                      Sửa
                    </button>
                  )}
                  
                  <div className="action-menu-wrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn icon-btn-menu"
                      title="Thao tác khác"
                      onClick={() => setOpenMenuId(openMenuId === x.id ? null : x.id)}
                    >
                      ⋮
                    </button>
                    {openMenuId === x.id && (
                      <div className="seller-dropdown-menu">
                        <button type="button" onClick={() => { setOpenMenuId(null); go(`/product/${x.id}`); }}>
                          👁 Chi tiết phiên
                        </button>
                        {x.status === "Scheduled" && (
                          <button type="button" onClick={() => { setOpenMenuId(null); go(`/product/${x.id}/edit`); }}>
                            ✏ Chỉnh sửa thông tin
                          </button>
                        )}
                        {(x.status === "Scheduled" || (x.status === "Active" && !x.bidCount)) && (
                          <button
                            type="button"
                            className="danger-action"
                            onClick={() => { setOpenMenuId(null); setCancelingItem(x); setCancelReason(""); }}
                          >
                            🚫 Hủy phiên đấu giá
                          </button>
                        )}
                        {x.status === "Scheduled" && !x.bidCount && (
                          <button
                            type="button"
                            className="danger-action"
                            onClick={() => { setOpenMenuId(null); setDeletingItem(x); }}
                          >
                            🗑 Xóa sản phẩm
                          </button>
                        )}
                        {(x.status === "Completed" || x.status === "Cancelled") && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              go(`/product/new?clone=${x.id}`);
                            }}
                          >
                            🔄 Đăng lại sản phẩm
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel table-wrap seller-table-wrap">
          <table className="table seller-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Trạng thái</th>
                <th>Mức giá</th>
                <th>Lượt đặt</th>
                <th>Thời gian</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((x) => (
                <tr key={x.id}>
                  <td>
                    <div className="seller-table-item">
                      <img
                        src={x.imageUrl || "/images/products/fujifilm-xt30-ii.webp"}
                        alt={x.name}
                        className="table-thumb"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/images/products/fujifilm-xt30-ii.webp";
                        }}
                      />
                      <div>
                        <strong>{x.name}</strong>
                        <small className="muted block">#{x.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{x.category || "—"}</td>
                  <td><Badge value={x.status} /></td>
                  <td>{renderPriceInfo(x)}</td>
                  <td>
                    <b>{x.bidCount || 0}</b> lượt
                  </td>
                  <td>
                    <small className="block">Bắt đầu: {date(x.startTime)}</small>
                    <small className="block muted">Kết thúc: {date(x.endTime)}</small>
                  </td>
                  <td>
                    <div className="seller-row-actions">
                      <button className="btn sm dark" onClick={() => go(`/product/${x.id}`)}>
                        Chi tiết
                      </button>
                      {x.status === "Scheduled" && (
                        <button className="btn sm secondary" onClick={() => go(`/product/${x.id}/edit`)}>
                          Sửa
                        </button>
                      )}
                      {(x.status === "Scheduled" || (x.status === "Active" && !x.bidCount)) && (
                        <button
                          className="btn sm danger"
                          onClick={() => { setCancelingItem(x); setCancelReason(""); }}
                        >
                          Hủy
                        </button>
                      )}
                      {x.status === "Scheduled" && !x.bidCount && (
                        <button
                          className="btn sm ghost"
                          onClick={() => setDeletingItem(x)}
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination seller-pagination">
          <button
            className="btn secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Trước
          </button>
          <span>
            Trang {page} / {totalPages} (Hiển thị {filtered.length} sản phẩm)
          </span>
          <button
            className="btn secondary"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </button>
        </div>
      )}

      {cancelingItem && (
        <Modal title="Hủy phiên đấu giá" onClose={() => setCancelingItem(null)}>
          <div className="cancel-modal-content">
            <p className="modal-desc">
              Vui lòng chọn hoặc cung cấp lý do hủy phiên cho sản phẩm:
            </p>
            <div className="modal-product-summary">
              <img
                src={cancelingItem.imageUrl || "/images/products/fujifilm-xt30-ii.webp"}
                alt={cancelingItem.name}
              />
              <div>
                <strong>{cancelingItem.name}</strong>
                <div className="muted small">
                  Trạng thái: <Badge value={cancelingItem.status} /> · Số lượt đặt: {cancelingItem.bidCount || 0} lượt
                </div>
              </div>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="cancelPreset">Lý do hủy phổ biến</label>
              <select
                id="cancelPreset"
                value={cancelPreset}
                onChange={(e) => setCancelPreset(e.target.value)}
              >
                <option value="Sản phẩm không còn khả dụng">Sản phẩm không còn khả dụng</option>
                <option value="Sai thông tin sản phẩm hoặc giá">Sai thông tin sản phẩm hoặc giá</option>
                <option value="Lý do cá nhân của người bán">Lý do cá nhân của người bán</option>
                <option value="Khác">Lý do khác (tự nhập bên dưới)</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="cancelReason">Chi tiết lý do hủy *</label>
              <textarea
                id="cancelReason"
                rows={3}
                placeholder="Nhập lý do cụ thể gửi tới người tham gia..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <div className="modal-warning-box">
              ⚠️ <strong>Lưu ý quan trọng:</strong> Phiên đấu giá sẽ bị đóng vĩnh viễn và không thể mở lại hoặc tiếp nhận lượt đặt giá mới.
            </div>
          </div>
          <div className="dialog-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setCancelingItem(null)}
            >
              Quay lại
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={handleCancelProduct}
            >
              {busy ? "Đang hủy…" : "Xác nhận hủy phiên"}
            </button>
          </div>
        </Modal>
      )}

      {deletingItem && (
        <Modal title="Xóa sản phẩm?" onClose={() => setDeletingItem(null)}>
          <div className="delete-modal-content">
            <p className="modal-desc">
              Bạn có chắc chắn muốn xóa sản phẩm này khỏi danh sách quản lý của mình không?
            </p>
            <div className="modal-product-summary">
              <img
                src={deletingItem.imageUrl || "/images/products/fujifilm-xt30-ii.webp"}
                alt={deletingItem.name}
              />
              <div>
                <strong>{deletingItem.name}</strong>
                <div className="muted small">
                  Giá khởi điểm: <b>{money(deletingItem.startingPrice)}</b>
                </div>
                <div className="muted small">
                  Trạng thái: <Badge value={deletingItem.status} />
                </div>
              </div>
            </div>
            <div className="modal-warning-box" style={{ marginTop: 14 }}>
              ⚠️ Sản phẩm chưa có lượt đặt giá sẽ được xóa khỏi hệ thống và không thể phục hồi.
            </div>
          </div>
          <div className="dialog-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setDeletingItem(null)}
            >
              Quay lại
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={handleDeleteProduct}
            >
              {busy ? "Đang xóa…" : "Xác nhận xóa"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ProductForm({ id, go, notify, user }) {
  const [step, setStep] = useState(1);
  const product = useRemote(
    () => (id ? api(`/api/products/${id}`) : Promise.resolve({})),
    [id],
  );
  const categories = useRemote(() => api("/api/Categories"), []);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState("Đã qua sử dụng (đẹp 99%)");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startingPrice, setStartingPrice] = useState("1000000");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sampleImages = [
    { name: "Xe đạp Trek FX 2 Disc", url: "/images/products/trek-fx2-disc.webp" },
    { name: "Đồng hồ Seiko Presage", url: "/images/products/seiko-srpb43.webp" },
    { name: "Apple Watch Series 8", url: "/images/products/apple-watch-series-8.webp" },
    { name: "iPhone 15 Pro Max", url: "/images/products/iphone-15-pro-max.webp" },
    { name: "MacBook Air M3 15 inch", url: "/images/products/macbook-air-m3.webp" },
    { name: "Tai nghe Sony WH-1000XM5", url: "/images/products/sony-wh-1000xm5.webp" },
    { name: "Nồi chiên Philips HD9252", url: "/images/products/philips-hd9252.webp" },
    { name: "Máy ảnh Fujifilm X-T30 II", url: "/images/products/fujifilm-xt30-ii.webp" },
  ];

  const local = (x) =>
    x
      ? new Date(
          parseApiDate(x).getTime() -
            parseApiDate(x).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";

  useEffect(() => {
    if (id && product.data?.id) {
      const p = product.data;
      setName(p.name || "");
      setCategoryId(p.categoryId ? String(p.categoryId) : "");
      setDescription(p.description || "");
      setImageUrl(p.imageUrl || "");
      setStartingPrice(String(p.startingPrice || 1000000));
      setStartTime(local(p.startTime));
      setEndTime(local(p.endTime));
    } else if (!id) {
      const now = new Date();
      const s = new Date(now.getTime() + 10 * 60000);
      const e = new Date(now.getTime() + 3 * 86400000);
      const formatIso = (d) =>
        new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setStartTime(formatIso(s));
      setEndTime(formatIso(e));
    }
  }, [id, product.data]);

  const setDurationDays = (days) => {
    const base = startTime ? new Date(startTime) : new Date();
    const newEnd = new Date(base.getTime() + days * 86400000);
    const formatIso = (d) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEndTime(formatIso(newEnd));
  };

  const handleNext = (e) => {
    e.preventDefault();
    setError("");
    if (step === 1) {
      if (!name.trim()) {
        setError("Vui lòng nhập tên sản phẩm.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      const price = Number(startingPrice);
      if (!price || price < 1000) {
        setError("Giá khởi điểm tối thiểu phải từ 1.000 ₫.");
        return;
      }
      const s = new Date(startTime);
      const en = new Date(endTime);
      if (s <= new Date()) {
        setError("Thời gian bắt đầu phải ở tương lai.");
        return;
      }
      if (en <= s) {
        setError("Thời gian kết thúc phải sau thời gian bắt đầu.");
        return;
      }
      setStep(4);
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (start <= new Date() || end <= start) {
        throw new Error("Thời gian bắt đầu phải ở tương lai và thời gian kết thúc phải sau thời gian bắt đầu.");
      }
      const fullDesc = description.trim()
        ? `[Tình trạng: ${condition}]\n${description.trim()}`
        : `[Tình trạng: ${condition}]`;
      const body = {
        version: id ? product.data.version : undefined,
        name: name.trim(),
        description: fullDesc,
        startingPrice: Number(startingPrice),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        categoryId: categoryId ? Number(categoryId) : null,
        imageUrl: imageUrl.trim() || null,
      };
      const saved = await json(
        id ? "PUT" : "POST",
        id ? `/api/products/${id}` : "/api/products",
        body,
      );
      notify ? notify(id ? "Đã lưu thay đổi sản phẩm." : "Đăng sản phẩm thành công!") : alert("Đã lưu sản phẩm.");
      go(`/product/${saved.id}`);
    } catch (x) {
      setError(x.message || "Không thể lưu sản phẩm.");
    } finally {
      setBusy(false);
    }
  };

  if (product.loading || product.error) return <Feedback {...product} />;
  if (categories.loading || categories.error) return <Feedback {...categories} />;
  const x = product.data || {};
  if (
    id &&
    (x.sellerId !== user.id ||
      x.status !== "Scheduled" ||
      parseApiDate(x.startTime) <= new Date())
  )
    return <p className="empty">Bạn không thể sửa phiên này vì đã bắt đầu hoặc không thuộc quyền sở hữu.</p>;

  const selectedCategoryObj = categories.data?.find((c) => String(c.id) === String(categoryId));

  return (
    <div className="product-wizard-wrap">
      <div className="wizard-header">
        <div className="breadcrumb" style={{ marginBottom: 8 }}>
          <a href="#/my-products">Sản phẩm của tôi</a>
          <span>/</span>
          <b>{id ? "Chỉnh sửa sản phẩm" : "Đăng sản phẩm mới"}</b>
        </div>
        <h1>{id ? "Chỉnh sửa phiên đấu giá" : "Đăng sản phẩm lên sàn đấu giá"}</h1>
        <p className="muted">
          Hoàn thành 4 bước bên dưới để niêm yết sản phẩm và thiết lập phiên đấu giá minh bạch trên BidNet.
        </p>

        <div className="wizard-progress">
          {[
            { num: 1, title: "Thông tin" },
            { num: 2, title: "Hình ảnh" },
            { num: 3, title: "Đấu giá" },
            { num: 4, title: "Xác nhận" },
          ].map((s) => (
            <div
              key={s.num}
              className={`wizard-step-node ${step === s.num ? "active" : step > s.num ? "completed" : ""}`}
              onClick={() => step > s.num && setStep(s.num)}
            >
              <div className="step-circle">{step > s.num ? "✓" : s.num}</div>
              <div className="step-label">{s.title}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel wizard-card">
        {error && <div className="notice error" style={{ marginBottom: 18 }}>{error}</div>}

        {step === 1 && (
          <form onSubmit={handleNext}>
            <h2>Bước 1: Thông tin cơ bản</h2>
            <p className="muted small">
              Cung cấp thông tin chi tiết, trung thực để người mua an tâm tham gia trả giá.
            </p>

            <div className="field">
              <div className="field-header-flex">
                <label htmlFor="pname">Tên sản phẩm *</label>
                <small className="muted">{name.length}/200 ký tự</small>
              </div>
              <input
                id="pname"
                type="text"
                required
                maxLength={200}
                placeholder="Ví dụ: Xe đạp Trek FX 2 Disc Gen 3 - Size M"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="pcat">Danh mục sản phẩm *</label>
                <select
                  id="pcat"
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">-- Chọn danh mục --</option>
                  {categories.data?.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="pcond">Tình trạng sản phẩm *</label>
                <select
                  id="pcond"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                >
                  <option value="Mới 100% nguyên hộp">Mới 100% nguyên hộp</option>
                  <option value="Đã qua sử dụng (đẹp 99%)">Đã qua sử dụng (đẹp 99%)</option>
                  <option value="Đã qua sử dụng còn tốt">Đã qua sử dụng còn tốt</option>
                  <option value="Đồ cổ / Sưu tầm vintage">Đồ cổ / Sưu tầm vintage</option>
                  <option value="Có vết xước nhẹ">Có vết xước nhẹ</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="pdesc">Mô tả sản phẩm</label>
              <textarea
                id="pdesc"
                rows={5}
                maxLength={2000}
                placeholder="Mô tả chi tiết nguồn gốc, tình trạng thực tế, bảo hành, phụ kiện đi kèm..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="wizard-actions">
              <button type="button" className="btn ghost" onClick={() => go("/my-products")}>
                Hủy bỏ
              </button>
              <button type="submit" className="btn dark">
                Tiếp tục: Thêm hình ảnh →
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleNext}>
            <h2>Bước 2: Hình ảnh sản phẩm</h2>
            <p className="muted small">
              Sản phẩm có hình ảnh rõ nét, nhiều góc chụp sẽ thu hút nhiều lượt đặt giá hơn.
            </p>

            <div className="field">
              <label htmlFor="pimg">URL ảnh đại diện chính</label>
              <input
                id="pimg"
                type="url"
                placeholder="https://res.cloudinary.com/... hoặc /images/products/..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>

            <div className="sample-images-section">
              <label className="small muted block" style={{ marginBottom: 6 }}>
                Gợi ý ảnh mẫu chất lượng cao (bấm để chọn nhanh):
              </label>
              <div className="sample-img-pills">
                {sampleImages.map((s, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className={`sample-pill ${imageUrl === s.url ? "active" : ""}`}
                    onClick={() => setImageUrl(s.url)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="image-preview-box">
              <div className="preview-label">Xem trước hình ảnh:</div>
              <div className="preview-frame">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/images/products/fujifilm-xt30-ii.webp";
                    }}
                  />
                ) : (
                  <div className="preview-placeholder">
                    <span>Chưa có ảnh (sẽ hiển thị biểu tượng mặc định)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="wizard-actions">
              <button type="button" className="btn secondary" onClick={() => setStep(1)}>
                ← Quay lại bước 1
              </button>
              <button type="submit" className="btn dark">
                Tiếp tục: Thiết lập đấu giá →
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleNext}>
            <h2>Bước 3: Thiết lập đấu giá & Thời gian</h2>
            <p className="muted small">
              Quy định mức giá khởi điểm và thời gian mở/đóng phiên đấu giá tự động.
            </p>

            <div className="field">
              <label htmlFor="pprice">Giá khởi điểm (VND) *</label>
              <div className="bid-input-wrap">
                <input
                  id="pprice"
                  type="text"
                  inputMode="numeric"
                  required
                  value={startingPrice ? Number(startingPrice.replace(/\D/g, "")).toLocaleString("vi-VN") : ""}
                  onChange={(e) => setStartingPrice(e.target.value.replace(/\D/g, ""))}
                  className="bid-input-currency"
                />
                <span className="bid-currency-symbol">₫</span>
              </div>
              {startingPrice && Number(startingPrice) > 0 && (
                <div className="bid-amount-preview">
                  <div className="bid-preview-words">
                    Bằng chữ: <em>{numberToVietnameseWords(Number(startingPrice))}</em>
                  </div>
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="pstart">Thời gian bắt đầu *</label>
                <input
                  id="pstart"
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <small className="muted">Khuyến nghị: để cách hiện tại ít nhất 5-10 phút.</small>
              </div>

              <div className="field">
                <label htmlFor="pend">Thời gian kết thúc *</label>
                <input
                  id="pend"
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                <div className="duration-shortcuts">
                  <span className="small muted">Chọn nhanh:</span>
                  {[1, 3, 5, 7].map((days) => (
                    <button
                      type="button"
                      key={days}
                      className="duration-pill"
                      onClick={() => setDurationDays(days)}
                    >
                      {days} ngày
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="wizard-actions">
              <button type="button" className="btn secondary" onClick={() => setStep(2)}>
                ← Quay lại bước 2
              </button>
              <button type="submit" className="btn dark">
                Tiếp tục: Xác nhận thông tin →
              </button>
            </div>
          </form>
        )}

        {step === 4 && (
          <div>
            <h2>Bước 4: Xác nhận & Đăng bán</h2>
            <p className="muted small">
              Kiểm tra lại toàn bộ thông tin trước khi chính thức niêm yết sản phẩm lên sàn BidNet.
            </p>

            <div className="wizard-confirmation-grid">
              <div className="wizard-preview-col">
                <div className="card preview-card-box">
                  <div className="card-image">
                    <img
                      src={imageUrl || "/images/products/fujifilm-xt30-ii.webp"}
                      alt={name}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/images/products/fujifilm-xt30-ii.webp";
                      }}
                    />
                    <span className="seller-badge-pos">
                      <Badge value="Scheduled" />
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="seller-category-tag">{selectedCategoryObj?.name || "Chưa phân loại"}</div>
                    <h3>{name || "Tên sản phẩm"}</h3>
                    <div className="seller-price-info">
                      <small>Giá khởi điểm</small>
                      <strong>{money(Number(startingPrice) || 0)}</strong>
                    </div>
                    <div className="muted small">
                      Bằng chữ: <em>{numberToVietnameseWords(Number(startingPrice) || 0)}</em>
                    </div>
                  </div>
                </div>
              </div>

              <div className="wizard-summary-col">
                <table className="spec-table wizard-summary-table">
                  <tbody>
                    <tr>
                      <th>Tên sản phẩm</th>
                      <td><strong>{name}</strong></td>
                    </tr>
                    <tr>
                      <th>Danh mục</th>
                      <td>{selectedCategoryObj?.name || "Chưa chọn"}</td>
                    </tr>
                    <tr>
                      <th>Tình trạng</th>
                      <td>{condition}</td>
                    </tr>
                    <tr>
                      <th>Giá khởi điểm</th>
                      <td><strong style={{ color: "var(--green-dark)" }}>{money(Number(startingPrice) || 0)}</strong></td>
                    </tr>
                    <tr>
                      <th>Bắt đầu</th>
                      <td>{date(startTime)}</td>
                    </tr>
                    <tr>
                      <th>Kết thúc</th>
                      <td>{date(endTime)}</td>
                    </tr>
                    <tr>
                      <th>Mô tả</th>
                      <td style={{ whiteSpace: "pre-wrap" }}>{description || "Chưa có mô tả"}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="wizard-policy-box">
                  <h4>📋 Cam kết người bán</h4>
                  <ul className="small muted" style={{ paddingLeft: 18, margin: "6px 0 0" }}>
                    <li>Tôi cam kết sản phẩm đúng với hình ảnh và mô tả tình trạng thực tế.</li>
                    <li>Tôi hiểu rằng phiên đấu giá khi đã có người đặt giá sẽ không thể tự ý hủy bỏ.</li>
                    <li>Sẵn sàng hỗ trợ vận chuyển và xác nhận giao dịch khi có người thắng phiên.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="wizard-actions" style={{ marginTop: 24 }}>
              <button type="button" className="btn secondary" disabled={busy} onClick={() => setStep(3)}>
                ← Quay lại bước 3
              </button>
              <button type="button" className="btn dark" disabled={busy} onClick={submit}>
                {busy ? "Đang xử lý…" : (id ? "Lưu thay đổi sản phẩm" : "🚀 Xác nhận & Đăng sản phẩm")}
              </button>
            </div>
          </div>
        )}
      </div>
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
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER_DEMO");
  const mutate = async (method, path, body, successMessage = "Đã cập nhật đơn hàng.") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await json(method, path, { ...body, version: r.data.version });
      notify(successMessage);
      await r.reload();
    } catch (e) {
      setError(e.message);
      await r.reload();
    } finally {
      setBusy(false);
    }
  };
  const o = r.data;
  const canPay = o && user.id === o.buyerId && user.role === "User" &&
    o.status === "Pending" && o.paymentStatus === "UNPAID";
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
          <p>Trạng thái thanh toán: {o.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}</p>
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
          {canPay && (
            <section className="demo-payment" aria-labelledby="demo-payment-title">
              <div className="demo-payment-heading">
                <div>
                  <span className="demo-payment-kicker">DEMO PAYMENT</span>
                  <h2 id="demo-payment-title">Chọn phương thức thanh toán</h2>
                </div>
                <span className="demo-payment-notice">Không dùng tiền thật</span>
              </div>
              <div className="demo-payment-methods" role="radiogroup" aria-label="Phương thức thanh toán demo">
                {[
                  ["BANK_TRANSFER_DEMO", "Chuyển khoản ngân hàng", "VietQR minh họa · Demo"],
                  ["MOMO_DEMO", "Ví MoMo", "Mô phỏng ví điện tử · Demo"],
                ].map(([method, label, description]) => (
                  <button
                    key={method}
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === method}
                    className={`demo-payment-method${paymentMethod === method ? " selected" : ""}`}
                    onClick={() => setPaymentMethod(method)}
                  >
                    <span className={`demo-payment-mark ${method === "MOMO_DEMO" ? "momo" : "bank"}`}>
                      {method === "MOMO_DEMO" ? "M" : "QR"}
                    </span>
                    <span><strong>{label}</strong><small>{description}</small></span>
                    <span className="demo-payment-radio" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="demo-payment-instructions">
                {paymentMethod === "BANK_TRANSFER_DEMO" ? (
                  <>
                    <div className="demo-qr" aria-hidden="true">
                      <svg viewBox="0 0 96 96">
                        <rect width="96" height="96" rx="4" fill="white" />
                        <path d="M8 8h28v28H8zm6 6v16h16V14zm42-6h28v28H56zm6 6v16h16V14zM8 56h28v28H8zm6 6v16h16V62zm34-52h6v6h-6zm0 12h6v6h-6zm-8 8h6v6h-6zm8 8h6v6h-6zm12 8h6v6h-6zm12 0h6v6h-6zm-36 8h6v6h-6zm12 0h6v6h-6zm24 0h6v6h-6zm-36 8h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6zm-24 8h6v6h-6zm12 0h6v6h-6zm12 0h6v6h-6zm-36 8h6v6h-6zm12 0h6v6h-6zm24 0h6v6h-6z" fill="#172b25" />
                        <text x="48" y="52" textAnchor="middle" fill="#146657" fontSize="10" fontWeight="700">DEMO</text>
                      </svg>
                    </div>
                    <p><strong>QR minh họa</strong><br />Không thể dùng để chuyển khoản. Bấm nút bên dưới để hoàn tất thanh toán giả lập.</p>
                  </>
                ) : (
                  <p><strong>Ví MoMo Demo</strong><br />Giao dịch chỉ mô phỏng trong BidNet, không mở ứng dụng ví và không trừ tiền.</p>
                )}
              </div>
              <div className="demo-payment-total">
                <span>Số tiền cần thanh toán</span>
                <strong>{money(o.finalPrice)}</strong>
              </div>
              <button
                type="button"
                className="btn dark demo-payment-submit"
                disabled={busy}
                onClick={() => mutate("POST", `/api/Orders/${id}/payment`, { paymentMethod }, "Thanh toán demo thành công.")}
              >
                {busy ? "Đang xử lý demo…" : "Thanh toán Demo"}
              </button>
            </section>
          )}
          {o.paymentStatus === "PAID" && o.paymentMethod && (
            <section className="demo-payment-success" role="status">
              <span className="demo-success-icon" aria-hidden="true">✓</span>
              <div>
                <span className="demo-payment-kicker">DEMO PAYMENT</span>
                <h2>Thanh toán thành công!</h2>
                <strong className="demo-success-amount">{money(o.finalPrice)}</strong>
                {o.paymentTransactionId && <p>Mã giao dịch: <code>{o.paymentTransactionId}</code></p>}
                <p>Không phát sinh giao dịch tiền thật.</p>
              </div>
            </section>
          )}
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
                      ? ["Cancelled"]
                      : ["Delivered"]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {
                          {
                            Delivered: "Xác nhận đã giao hàng",
                            Cancelled: "Đã hủy",
                          }[s]
                        }
                      </option>
                    ))}
                  </select>
                </div>
                <p className="muted small">Chỉ người mua mới có thể hoàn tất thanh toán demo; người bán xác nhận giao hàng sau khi thanh toán.</p>
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
