import React, { useMemo, useState } from "react";
import { api, query } from "./api";
import { AuctionCard, useApi, useFavorites, statusNames } from "./widgets.jsx";
import { MoneyInput } from "./UI.jsx";

const defaults = { q: "", category: "", minPrice: "", maxPrice: "" };
const statusOptions = [
  ["", "Tất cả trạng thái"],
  ["Active", "Đang diễn ra"],
  ["Scheduled", "Sắp diễn ra"],
  ["Completed", "Đã kết thúc"],
  ["Cancelled", "Đã hủy"],
];
const sortOptions = [
  ["newest", "Mới nhất"],
  ["ending_soon", "Sắp kết thúc"],
  ["most_bids", "Nhiều lượt đặt giá"],
  ["price_asc", "Giá thấp đến cao"],
  ["price_desc", "Giá cao đến thấp"],
];

export default function Explore({ route }) {
  const params = useMemo(() => new URLSearchParams((route || "").split("?")[1] || ""), [route]);
  const initial = useMemo(
    () => ({
      q: params.get("q") || "",
      category: params.get("category") || "",
      minPrice: params.get("minPrice") || "",
      maxPrice: params.get("maxPrice") || "",
    }),
    [params],
  );
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [status, setStatus] = useState(params.get("status") || "");
  const [sort, setSort] = useState(params.get("sort") || "newest");
  const [page, setPage] = useState(1);
  const [revision, retry] = useState(0);
  const [invalid, setInvalid] = useState("");
  const { ids, toggle } = useFavorites();
  const categories = useApi("/api/Categories", revision);
  const path =
    "/api/products?" + query({ ...filters, status, sort, page, pageSize: 12 });
  const list = useApi(path, revision);
  const data = list.data;
  const pages = data ? Math.ceil(data.totalCount / data.pageSize) : 0;

  function change(event) {
    setInvalid("");
    setDraft({ ...draft, [event.target.name]: event.target.value });
  }
  function submit(event) {
    event.preventDefault();
    if (draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice)) {
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
    setSort("newest");
    setPage(1);
    setInvalid("");
  }
  const activeChips = [
    filters.q && ["q", `Từ khóa: ${filters.q}`],
    filters.category && ["category", filters.category],
    filters.minPrice && ["minPrice", `Từ ${Number(filters.minPrice).toLocaleString("vi-VN")} ₫`],
    filters.maxPrice && ["maxPrice", `Đến ${Number(filters.maxPrice).toLocaleString("vi-VN")} ₫`],
    status && ["status", statusNames[status]],
  ].filter(Boolean);

  return (
    <>
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <a href="#/">Trang chủ</a>
        <span>/</span>
        <b>Đấu giá</b>
      </nav>
      <div className="page-head search-head">
        <div>
          <span className="eyebrow">Tìm kiếm & lọc</span>
          <h1>Phiên đấu giá</h1>
          <p>
            Tìm sản phẩm theo danh mục, mức giá và thời gian đấu giá.
          </p>
        </div>
        {data && (
          <strong className="result-count">
            {data.totalCount} <span>kết quả</span>
          </strong>
        )}
      </div>

      <div className="search-layout">
        <aside className="filter-panel" aria-label="Bộ lọc">
          <div className="filter-title">
            <h2>Bộ lọc</h2>
            <button type="button" className="link-btn" onClick={reset}>
              Xóa tất cả
            </button>
          </div>
          <form onSubmit={submit}>
            <div className="filter-group">
              <label htmlFor="filter-q">Từ khóa</label>
              <input
                id="filter-q"
                type="search"
                name="q"
                placeholder="Tên sản phẩm…"
                value={draft.q}
                onChange={change}
              />
            </div>
            <fieldset className="filter-group">
              <legend>Danh mục</legend>
              <label className="check-row">
                <input
                  type="radio"
                  name="category"
                  value=""
                  checked={!draft.category}
                  onChange={change}
                />
                <span>Tất cả danh mục</span>
              </label>
              {categories.data?.map((category) => (
                <label className="check-row" key={category.id}>
                  <input
                    type="radio"
                    name="category"
                    value={category.name}
                    checked={draft.category === category.name}
                    onChange={change}
                  />
                  <span>
                    {category.name}
                    <small>{category.productCount ?? 0}</small>
                  </span>
                </label>
              ))}
              {categories.error && <small className="error-text">{categories.error}</small>}
            </fieldset>
            <fieldset className="filter-group">
              <legend>Khoảng giá hiện tại</legend>
              <div className="price-range">
                <MoneyInput
                  value={draft.minPrice}
                  onChange={(val) => setDraft((c) => ({ ...c, minPrice: val }))}
                  placeholder="Từ"
                  ariaLabel="Giá từ"
                  showHint={false}
                />
                <span>—</span>
                <MoneyInput
                  value={draft.maxPrice}
                  onChange={(val) => setDraft((c) => ({ ...c, maxPrice: val }))}
                  placeholder="Đến"
                  ariaLabel="Giá đến"
                  showHint={false}
                />
              </div>
            </fieldset>
            <fieldset className="filter-group">
              <legend>Trạng thái</legend>
              {statusOptions.map(([value, label]) => (
                <label className="check-row" key={value || "all"}>
                  <input
                    type="radio"
                    name="status"
                    value={value}
                    checked={status === value}
                    onChange={() => {
                      setStatus(value);
                      setPage(1);
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            {invalid && (
              <p className="notice error" role="alert">
                {invalid}
              </p>
            )}
            <button className="btn dark filter-submit">Áp dụng bộ lọc</button>
          </form>
        </aside>

        <section className="search-results" aria-label="Kết quả">
          <div className="results-toolbar">
            <div className="active-chips">
              {activeChips.length ? (
                activeChips.map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => {
                      if (key === "status") setStatus("");
                      else setFilters({ ...filters, [key]: "" });
                      setDraft({ ...draft, [key]: "" });
                      setPage(1);
                    }}
                    title="Bỏ lọc này"
                  >
                    {label} <span aria-hidden="true">×</span>
                  </button>
                ))
              ) : (
                <span className="muted small">Chưa chọn bộ lọc nào</span>
              )}
            </div>
            <label className="sort-control">
              Sắp xếp
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                {sortOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {list.error ? (
            <div className="notice error" role="alert">
              {list.error}{" "}
              <button className="link-btn" onClick={() => retry(revision + 1)}>
                Thử lại
              </button>
            </div>
          ) : !data ? (
            <div className="card-grid-skeleton" aria-label="Đang tải phiên đấu giá" />
          ) : data.items.length ? (
            <>
              <div className="auction-grid">
                {data.items.map((item) => (
                  <AuctionCard
                    key={item.id}
                    item={item}
                    favorite={ids.includes(item.id)}
                    onFavorite={toggle}
                  />
                ))}
              </div>
              {pages > 1 && (
                <div className="pagination">
                  <button
                    className="btn secondary"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Trước
                  </button>
                  <span>
                    Trang {page} / {pages}
                  </span>
                  <button
                    className="btn secondary"
                    disabled={page >= pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Sau
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty">
              <p>Chưa có phiên phù hợp với bộ lọc.</p>
              <button className="btn secondary" onClick={reset}>
                Xóa bộ lọc
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
