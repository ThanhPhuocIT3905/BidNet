import React, { useEffect, useState } from "react";
import {
  BidGateCard,
  CountdownBox,
  LotPhoto,
  priceLabel,
  SkeletonGrid,
  StatusBadge,
} from "./Lot.jsx";
import { api, money, query } from "./api";

const statuses = {
  "": "Tất cả",
  Active: "Đang diễn ra",
  Scheduled: "Sắp diễn ra",
  Completed: "Đã kết thúc",
  Cancelled: "Đã hủy",
};

const defaults = { q: "", category: "", minPrice: "", maxPrice: "" };

const CATEGORY_ICONS = ["💻", "⌚", "🎨", "🚗", "📱", "📷", "🎧", "💎"];

function parseRouteParams(route) {
  const qs = route?.includes("?") ? route.split("?")[1] : "";
  const sp = new URLSearchParams(qs);
  return {
    q: sp.get("q") || "",
    category: sp.get("category") || "",
    status: sp.get("status") || "",
    minPrice: sp.get("minPrice") || "",
    maxPrice: sp.get("maxPrice") || "",
  };
}

function useQuery(path, revision = 0) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    api(path).then(
      (data) => alive && setResult({ path, revision, data }),
      (error) => alive && setResult({ path, revision, error: error.message }),
    );
    return () => {
      alive = false;
    };
  }, [path, revision]);
  return result?.path === path && result.revision === revision ? result : {};
}

function HeroCarousel({ items }) {
  const slides = items
    .filter((item) => item.status !== "Cancelled")
    .sort((a, b) => {
      const score = (x) =>
        (x.status === "Active" ? 4 : x.status === "Scheduled" ? 2 : 0) +
        (x.imageUrl ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, 4);

  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const activeIdx = slide % Math.max(count, 1);
  const item = slides[activeIdx];

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = setTimeout(() => {
      setSlide((s) => (s + 1) % count);
    }, 6500);
    return () => clearTimeout(id);
  }, [slide, count, paused]);

  if (!item) return null;

  return (
    <section
      className={`hero-banner ${paused ? "paused" : ""}`}
      aria-label="Banner phiên nổi bật"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-copy" key={`copy-${item.id}`}>
        <div className="hero-tag">
          <span>★</span>
          Phiên nổi bật · #{String(item.id).padStart(3, "0")}
        </div>
        <h1>{item.name}</h1>
        <div className="hero-price-strip">
          <div>
            <small>{priceLabel(item)}</small>
            <strong>{money(item.currentPrice)}</strong>
          </div>
          <div>
            <small>Trạng thái</small>
            <StatusBadge value={item.status} />
          </div>
        </div>
        <div style={{ maxWidth: 340 }}>
          <CountdownBox item={item} />
        </div>
        <div className="actions">
          <a className="btn" href={"#/product/" + item.id}>
            {item.status === "Active" ? "Tham gia đấu giá ngay →" : "Xem chi tiết phiên →"}
          </a>
        </div>
      </div>

      <div className="hero-media" key={`media-${item.id}`}>
        <LotPhoto item={item} priority />
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className="hero-arrow prev"
            aria-label="Banner trước"
            onClick={() => setSlide((slide + count - 1) % count)}
          >
            ‹
          </button>
          <button
            type="button"
            className="hero-arrow next"
            aria-label="Banner tiếp theo"
            onClick={() => setSlide((slide + 1) % count)}
          >
            ›
          </button>
          <div className="hero-dots" aria-label="Chọn banner">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={idx === activeIdx ? "active" : ""}
                aria-label={`Banner ${idx + 1}`}
                onClick={() => setSlide(idx)}
              />
            ))}
          </div>
          <div className="hero-progress" aria-hidden="true">
            <div className="hero-progress-bar" key={`prog-${slide}`} />
          </div>
        </>
      )}
    </section>
  );
}

export default function Explore({ route, user }) {
  const initial = parseRouteParams(route);
  const [draft, setDraft] = useState({
    q: initial.q,
    category: initial.category,
    minPrice: initial.minPrice,
    maxPrice: initial.maxPrice,
  });
  const [filters, setFilters] = useState({
    q: initial.q,
    category: initial.category,
    minPrice: initial.minPrice,
    maxPrice: initial.maxPrice,
  });
  const [status, setStatus] = useState(initial.status);
  const [page, setPage] = useState(1);
  const [revision, retry] = useState(0);
  const [invalid, setInvalid] = useState("");

  useEffect(() => {
    const next = parseRouteParams(route);
    setDraft({
      q: next.q,
      category: next.category,
      minPrice: next.minPrice,
      maxPrice: next.maxPrice,
    });
    setFilters({
      q: next.q,
      category: next.category,
      minPrice: next.minPrice,
      maxPrice: next.maxPrice,
    });
    setStatus(next.status);
    setPage(1);
    setInvalid("");
  }, [route]);

  const categories = useQuery("/api/categories", revision);
  const base =
    "/api/products?" + query({ ...defaults, status: "", page: 1, pageSize: 15 });
  const featured = useQuery(base, revision);
  const activeQuery = useQuery(
    "/api/products?" + query({ status: "Active", page: 1, pageSize: 10 }),
    revision,
  );
  const path =
    "/api/products?" + query({ ...filters, status, page, pageSize: 15 });
  const filtered = useQuery(path === base ? null : path, revision);
  const list = path === base ? featured : filtered;
  const data = list.data;
  const pages = data ? Math.ceil(data.totalCount / data.pageSize) : 0;

  const hasFilter =
    Boolean(status) ||
    Boolean(filters.q) ||
    Boolean(filters.category) ||
    Boolean(filters.minPrice) ||
    Boolean(filters.maxPrice);

  function change(event) {
    setInvalid("");
    setDraft({ ...draft, [event.target.name]: event.target.value });
  }

  function submit(event) {
    event.preventDefault();
    if (
      draft.minPrice &&
      draft.maxPrice &&
      Number(draft.minPrice) > Number(draft.maxPrice)
    ) {
      setInvalid("Giá đến phải lớn hơn hoặc bằng giá từ.");
      return;
    }
    setPage(1);
    setFilters({ ...draft, q: draft.q.trim() });
  }

  function reset() {
    setDraft(defaults);
    setFilters(defaults);
    setStatus("");
    setPage(1);
    setInvalid("");
    if (location.hash.includes("?")) location.hash = "/";
  }

  function selectCategory(catName) {
    const nextCat = filters.category === catName ? "" : catName;
    const next = { ...draft, category: nextCat };
    setDraft(next);
    setFilters(next);
    setPage(1);
    document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      {/* 1. Fixed-height Banner Carousel */}
      {!hasFilter && <HeroCarousel items={featured.data?.items || []} />}

      {/* 2. Active Auctions Highlight Section (BidGate style) */}
      {!hasFilter && activeQuery.data?.items?.length > 0 && (
        <section className="bg-section" aria-label="Phiên đang diễn ra">
          <div className="bg-section-head">
            <h2>
              Phiên đấu giá đang diễn ra
              <span className="section-count-pill">
                {activeQuery.data.totalCount} phiên trực tiếp
              </span>
            </h2>
            <button
              type="button"
              className="btn outline sm"
              onClick={() => {
                setStatus("Active");
                setPage(1);
              }}
            >
              Xem tất cả →
            </button>
          </div>
          <div className="bg-card-grid">
            {activeQuery.data.items.slice(0, 5).map((item, idx) => (
              <BidGateCard key={item.id} item={item} index={idx} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Product Categories Panel (BidGate style) */}
      <section className="bg-section" aria-label="Danh mục sản phẩm">
        <div className="bg-section-head">
          <h2>Danh mục sản phẩm</h2>
          {filters.category && (
            <button type="button" className="btn secondary sm" onClick={reset}>
              Đang lọc: {filters.category} ✕
            </button>
          )}
        </div>
        <div className="category-panel">
          {categories.error ? (
            <div className="notice error meta-row">
              <span>Chưa tải được danh mục: {categories.error}</span>
              <button
                className="btn secondary sm"
                onClick={() => retry(revision + 1)}
              >
                Thử lại
              </button>
            </div>
          ) : (
            <div className="category-tiles">
              {categories.data?.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cat-tile ${filters.category === c.name ? "active" : ""}`}
                  onClick={() => selectCategory(c.name)}
                >
                  <span className="cat-tile-icon" aria-hidden="true">
                    {CATEGORY_ICONS[idx % CATEGORY_ICONS.length]}
                  </span>
                  <strong>{c.name}</strong>
                  <small>{c.productCount} sản phẩm</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Full Filterable Auction Catalog */}
      <section
        id="catalog-section"
        className="bg-section"
        aria-label="Tất cả phiên đấu giá"
      >
        <div className="bg-section-head">
          <h2>
            {hasFilter ? "Kết quả lọc phiên đấu giá" : "Tất cả phiên đấu giá"}
            {data && (
              <span className="section-count-pill">{data.totalCount} phiên</span>
            )}
          </h2>
        </div>

        <div className="status-tabs" aria-label="Lọc theo trạng thái">
          {Object.entries(statuses).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => {
                setStatus(key);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="catalog-filter" onSubmit={submit}>
          <label>
            Tên sản phẩm
            <input
              type="search"
              name="q"
              placeholder="Nhập tên sản phẩm…"
              value={draft.q}
              onChange={change}
            />
          </label>
          <label>
            Danh mục
            <select name="category" value={draft.category} onChange={change}>
              <option value="">Tất cả danh mục</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giá từ (₫)
            <input
              name="minPrice"
              type="number"
              min="0"
              placeholder="Thấp nhất"
              value={draft.minPrice}
              onChange={change}
            />
          </label>
          <label>
            Giá đến (₫)
            <input
              name="maxPrice"
              type="number"
              min="0"
              placeholder="Cao nhất"
              value={draft.maxPrice}
              onChange={change}
            />
          </label>
          <button className="btn" type="submit">
            Tìm kiếm
          </button>
          {hasFilter && (
            <button className="btn secondary" type="button" onClick={reset}>
              Xóa lọc
            </button>
          )}
        </form>

        {invalid && (
          <p className="notice error" role="alert">
            {invalid}
          </p>
        )}

        {list.error ? (
          <div className="notice error meta-row" role="alert">
            <span>{list.error}</span>
            <button
              className="btn secondary sm"
              onClick={() => retry(revision + 1)}
            >
              Thử lại
            </button>
          </div>
        ) : !data ? (
          <SkeletonGrid count={5} />
        ) : data.items.length ? (
          <div className="bg-card-grid">
            {data.items.map((item, idx) => (
              <BidGateCard key={item.id} item={item} index={idx} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p>Không tìm thấy phiên đấu giá nào khớp điều kiện.</p>
            <button className="btn secondary" onClick={reset}>
              Xem tất cả phiên
            </button>
          </div>
        )}

        {pages > 1 && (
          <div className="pagination">
            <button
              className="btn secondary sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              ← Trước
            </button>
            <span>
              Trang {page} / {pages}
            </span>
            <button
              className="btn secondary sm"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Sau →
            </button>
          </div>
        )}
      </section>

      {/* 5. Mid-Page Dark Promo Strip */}
      <section className="promo-strip" aria-label="Đăng bán sản phẩm trên BidNet">
        <div>
          <div className="eyebrow" style={{ color: "#93c5fd" }}>
            Sàn đấu giá công nghệ BidNet
          </div>
          <h3>Bạn có sản phẩm muốn đưa lên sàn đấu giá?</h3>
          <p>
            Đăng sản phẩm nhanh chóng, theo dõi lượt trả giá theo thời gian thực và chốt đơn tự động khi hết giờ.
          </p>
        </div>
        <a className="btn" href={user ? "#/product/new" : "#/register"}>
          {user ? "+ Đăng sản phẩm ngay →" : "Đăng ký bán hàng miễn phí →"}
        </a>
      </section>
    </>
  );
}
