import React, { useEffect, useState } from "react";
import { api, money, parseApiDate } from "./api";
import { LotPhoto, priceLabel } from "./Lot.jsx";

export const statusNames = {
  "": "Tất cả",
  Active: "Đang diễn ra",
  Scheduled: "Sắp diễn ra",
  Completed: "Đã kết thúc",
  Cancelled: "Đã hủy",
};

export function StatusBadge({ value }) {
  return <span className={`badge ${value || ""}`}>{statusNames[value] || value}</span>;
}

export function useTick(active = true) {
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
}

function split(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}
const pad = (n) => String(n).padStart(2, "0");

// Đồng hồ đếm ngược dùng dữ liệu UTC của API. Khi phiên chưa mở, đếm tới StartTime;
// khi đang mở, đếm tới EndTime. Trạng thái Completed/Cancelled không chạy đồng hồ.
export function Countdown({ item, compact = false }) {
  const finished = item.status === "Completed" || item.status === "Cancelled";
  useTick(!finished);
  if (finished) {
    return (
      <span className={`countdown done ${compact ? "compact" : ""}`}>
        {item.status === "Completed" ? "Đã kết thúc" : "Phiên đã hủy"}
      </span>
    );
  }
  const scheduled = item.status === "Scheduled";
  const target = parseApiDate(scheduled ? item.startTime : item.endTime);
  if (!target) return null;
  const remain = target.getTime() - Date.now();
  if (remain <= 0) {
    return (
      <span className={`countdown done ${compact ? "compact" : ""}`}>
        {scheduled ? "Sắp mở phiên" : "Đang chốt kết quả"}
      </span>
    );
  }
  const { d, h, m, s } = split(remain);
  if (compact) {
    return (
      <span className="countdown compact" title={scheduled ? "Thời gian tới khi mở phiên" : "Thời gian còn lại"}>
        {scheduled ? "Mở sau " : "Còn "}
        {d > 0 ? `${d} ngày ` : ""}
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    );
  }
  return (
    <div className="countdown-boxes" aria-label={scheduled ? "Thời gian tới khi mở phiên" : "Thời gian còn lại"}>
      {[
        [d, "ngày"],
        [h, "giờ"],
        [m, "phút"],
        [s, "giây"],
      ].map(([value, label]) => (
        <div key={label}>
          <strong>{pad(value)}</strong>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

export function AuctionCard({ item, favorite = false, onFavorite }) {
  return (
    <article className="auction-card">
      <a className="auction-card-media" href={`#/product/${item.id}`} tabIndex={-1} aria-hidden="true">
        <LotPhoto item={item} />
        <StatusBadge value={item.status} />
        <Countdown item={item} compact />
      </a>
      <div className="auction-card-body">
        <span className="auction-card-cat">{item.category || "Chưa phân loại"} · #{item.id}</span>
        <h3>
          <a href={`#/product/${item.id}`}>{item.name}</a>
        </h3>
        <div className="auction-card-foot">
          <div>
            <small>{priceLabel(item)}</small>
            <strong>{money(item.currentPrice)}</strong>
          </div>
          <a className="card-arrow" href={`#/product/${item.id}`} aria-label={`Xem ${item.name}`}>
            ↗
          </a>
        </div>
      </div>
      {onFavorite && (
        <button
          type="button"
          className={`fav-toggle ${favorite ? "on" : ""}`}
          aria-pressed={favorite}
          aria-label={favorite ? "Bỏ theo dõi phiên" : "Theo dõi phiên"}
          title={favorite ? "Bỏ theo dõi" : "Thêm vào yêu thích"}
          onClick={() => onFavorite(item.id)}
        >
          {favorite ? "♥" : "♡"}
        </button>
      )}
    </article>
  );
}

const FAV_KEY = "bidnet.favorites";
const readFavorites = () => {
  try {
    const value = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
};
const emit = () => dispatchEvent(new Event("bidnet:favorites"));

export function useFavorites() {
  const [ids, setIds] = useState(readFavorites);
  useEffect(() => {
    const sync = () => setIds(readFavorites());
    addEventListener("bidnet:favorites", sync);
    addEventListener("storage", sync);
    return () => {
      removeEventListener("bidnet:favorites", sync);
      removeEventListener("storage", sync);
    };
  }, []);
  const toggle = (id) => {
    const next = readFavorites().includes(Number(id))
      ? readFavorites().filter((x) => x !== Number(id))
      : [...readFavorites(), Number(id)];
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
    setIds(next);
    emit();
  };
  return { ids, toggle };
}

export function FavoriteButton({ id, className = "" }) {
  const { ids, toggle } = useFavorites();
  const on = ids.includes(Number(id));
  return (
    <button
      type="button"
      className={`btn ghost watch-btn ${on ? "on" : ""} ${className}`}
      aria-pressed={on}
      onClick={() => toggle(id)}
    >
      {on ? "♥ Đang theo dõi" : "♡ Theo dõi"}
    </button>
  );
}

export function useApi(path, revision = 0) {
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
  return result?.path === path && result.revision === revision
    ? { ...result, loading: false }
    : { loading: Boolean(path) };
}
