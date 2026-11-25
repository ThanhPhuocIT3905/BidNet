import React, { useEffect, useState } from "react";
import { LotPhoto, priceLabel } from "./Lot.jsx";
import { api, date, money, query } from "./api";

const statuses = {
  "": "Tất cả",
  Active: "Đang diễn ra",
  Scheduled: "Sắp diễn ra",
  Completed: "Đã kết thúc",
  Cancelled: "Đã hủy",
};
const defaults = { q: "", category: "", minPrice: "", maxPrice: "" };

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

function Spotlight({ items }) {
  const candidates = items
    .filter((item) => item.imageUrl && item.status !== "Cancelled")
    .sort(
      (a, b) => Number(b.status === "Active") - Number(a.status === "Active"),
    )
    .slice(0, 4);
  const [slide, setSlide] = useState(0);
  const item = candidates[slide % candidates.length];
  if (!item) return null;
  return (
    <section className="spotlight" aria-label="Phiên nổi bật">
      <div className="spot-copy">
        <div className="spot-kicker">
          <i />
          Phiên nổi bật <span>/</span> #{String(item.id).padStart(3, "0")}
        </div>
        <h1>{item.name}</h1>
        <div className="spot-facts">
          <div>
            <small>{priceLabel(item)}</small>
            <strong>{money(item.currentPrice)}</strong>
          </div>
          <div>
            <small>Trạng thái</small>
            <b>{statuses[item.status]}</b>
          </div>
        </div>
        <a className="spot-link" href={"#/product/" + item.id}>
          Xem phiên đấu giá <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="spot-image">
        <LotPhoto item={item} priority />
        {candidates.length > 1 && (
          <div className="slide-controls">
            <button
              aria-label="Phiên nổi bật trước"
              onClick={() =>
                setSlide((slide + candidates.length - 1) % candidates.length)
              }
            >
              ←
            </button>
            <span>
              {(slide % candidates.length) + 1} / {candidates.length}
            </span>
            <button
              aria-label="Phiên nổi bật tiếp theo"
              onClick={() => setSlide((slide + 1) % candidates.length)}
            >
              →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function AuctionRow({ item }) {
  const upcoming = item.status === "Scheduled";
  return (
    <a className="auction-row" href={"#/product/" + item.id}>
      <div className="row-photo">
        <LotPhoto item={item} />
      </div>
      <div className="row-name">
        <small>
          {item.category || "Chưa phân loại"} · #{item.id}
        </small>
        <h3>{item.name}</h3>
        <span className={"badge " + item.status}>{statuses[item.status]}</span>
      </div>
      <div className="row-fact">
        <small>{priceLabel(item)}</small>
        <strong>{money(item.currentPrice)}</strong>
      </div>
      <div className="row-fact row-date">
        <small>{upcoming ? "Bắt đầu" : "Kết thúc"}</small>
        <b>{date(upcoming ? item.startTime : item.endTime)}</b>
      </div>
      <span className="row-arrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

export default function Explore() {
  const [draft, setDraft] = useState(defaults);
  const [filters, setFilters] = useState(defaults);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, retry] = useState(0);
  const [invalid, setInvalid] = useState("");
  const categories = useQuery("/api/Categories", revision);
  const base =
    "/api/products?" +
    query({ ...defaults, status: "", page: 1, pageSize: 12 });
  const featured = useQuery(base, revision);
  const path =
    "/api/products?" + query({ ...filters, status, page, pageSize: 12 });
  const filtered = useQuery(path === base ? null : path, revision);
  const list = path === base ? featured : filtered;
  const data = list.data;
  const pages = data ? Math.ceil(data.totalCount / data.pageSize) : 0;
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
  }
  return (
    <>
      <Spotlight items={featured.data?.items || []} />
      <section className="catalog" aria-label="Danh sách phiên đấu giá">
        <div className="catalog-title">
          <h2>Khám phá phiên đấu giá</h2>
          {data && <span>{data.totalCount} phiên</span>}
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
              placeholder="Tìm sản phẩm…"
              value={draft.q}
              onChange={change}
            />
          </label>
          <label>
            Danh mục
            <select name="category" value={draft.category} onChange={change}>
              <option value="">Tất cả danh mục</option>
              {categories.data?.map((c) => (
                <option key={c.id}>{c.name}</option>
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
          <button className="btn dark">Tìm kiếm</button>
        </form>
        {invalid && (
          <p className="notice error" role="alert">
            {invalid}
          </p>
        )}
        {categories.error && (
          <p className="notice error">
            Chưa tải được danh mục.{" "}
            <button onClick={() => retry(revision + 1)}>Thử lại</button>
          </p>
        )}
        {list.error ? (
          <div className="notice error" role="alert">
            {list.error}{" "}
            <button onClick={() => retry(revision + 1)}>Thử lại</button>
          </div>
        ) : !data ? (
          <p className="loading" role="status">
            Đang tải phiên đấu giá…
          </p>
        ) : data.items.length ? (
          <div className="auction-list">
            {data.items.map((item) => (
              <AuctionRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p>Chưa có phiên phù hợp.</p>
            <button className="btn secondary" onClick={reset}>
              Xóa bộ lọc
            </button>
          </div>
        )}
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
      </section>
    </>
  );
}
