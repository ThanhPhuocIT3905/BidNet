import React, { useEffect, useState } from "react";
import { date, mediaUrl, money, parseApiDate } from "./api";

export const STATUS_LABELS = {
  Scheduled: "Sắp diễn ra",
  Active: "Đang diễn ra",
  Completed: "Đã kết thúc",
  Cancelled: "Đã hủy",
  Pending: "Chờ địa chỉ",
  Processing: "Đang xử lý",
  Shipped: "Đang giao hàng",
};

export function StatusBadge({ value }) {
  return (
    <span className={`badge ${value}`}>
      <span className="badge-dot" aria-hidden="true" />
      {STATUS_LABELS[value] || value}
    </span>
  );
}

export function GavelIcon({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </svg>
  );
}

function getTimeParts(targetIso, nowMs) {
  const target = parseApiDate(targetIso);
  if (!target) return null;
  const diff = Math.floor((target.getTime() - nowMs) / 1000);
  if (diff <= 0) return { done: true, diff: 0, d: "00", h: "00", m: "00", s: "00" };
  const pad = (n) => String(n).padStart(2, "0");
  return {
    done: false,
    diff,
    d: pad(Math.floor(diff / 86400)),
    h: pad(Math.floor((diff % 86400) / 3600)),
    m: pad(Math.floor((diff % 3600) / 60)),
    s: pad(diff % 60),
  };
}

/** BidGate-style 4-column Countdown Module (Ngày | Giờ | Phút | Giây) */
export function CountdownBox({ item, large = false }) {
  const [now, setNow] = useState(() => Date.now());
  const isLive = item?.status === "Active";
  const isUpcoming = item?.status === "Scheduled";

  useEffect(() => {
    if (!isLive && !isUpcoming) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isLive, isUpcoming]);

  if (!item) return null;

  if (!isLive && !isUpcoming) {
    return (
      <div className={`bg-countdown-box ${large ? "large" : ""}`}>
        <div className="bg-countdown-title">
          {item.status === "Cancelled" ? "Trạng thái phiên" : "Kết thúc lúc"}
        </div>
        <div className="bg-countdown-ended mono">
          {item.status === "Cancelled" ? "Đã bị hủy" : date(item.endTime)}
        </div>
      </div>
    );
  }

  const target = isLive ? item.endTime : item.startTime;
  const parts = getTimeParts(target, now) || { diff: 0, d: "00", h: "00", m: "00", s: "00" };
  const isUrgent = isLive && parts.diff > 0 && parts.diff <= 3600;

  return (
    <div className={`bg-countdown-box ${large ? "large" : ""} ${isUrgent ? "urgent" : ""}`}>
      <div className="bg-countdown-title">
        {isLive ? "Thời gian còn lại" : "Bắt đầu sau"}
      </div>
      <div className="bg-countdown-grid">
        <div className="bg-countdown-cell">
          <strong>{parts.d}</strong>
          <span>Ngày</span>
        </div>
        <div className="bg-countdown-cell">
          <strong>{parts.h}</strong>
          <span>Giờ</span>
        </div>
        <div className="bg-countdown-cell">
          <strong>{parts.m}</strong>
          <span>Phút</span>
        </div>
        <div className="bg-countdown-cell sec">
          <strong>{parts.s}</strong>
          <span>Giây</span>
        </div>
      </div>
    </div>
  );
}

/** BidGate-style Compact Auction Card */
export function BidGateCard({ item, index = 0 }) {
  return (
    <a
      className="bg-card"
      href={"#/product/" + item.id}
      style={{ "--i": index }}
    >
      <div className="bg-card-media">
        <LotPhoto item={item} />
        <div className="bg-card-badge">
          <StatusBadge value={item.status} />
        </div>
      </div>
      <div className="bg-card-body">
        <CountdownBox item={item} />
        <h3 className="bg-card-title" title={item.name}>
          {item.name}
        </h3>
        <div className="bg-card-footer">
          <span className="bg-card-price">{money(item.currentPrice)}</span>
          <span className="bg-gavel-btn" title="Xem & đặt giá">
            <GavelIcon size={14} />
          </span>
        </div>
      </div>
    </a>
  );
}

export function SkeletonGrid({ count = 5 }) {
  return (
    <div className="bg-card-grid" aria-label="Đang tải sản phẩm">
      {Array.from({ length: count }).map((_, idx) => (
        <div className="bg-skeleton-card" key={idx}>
          <div className="bg-skeleton-bar bg-skeleton-media" />
          <div style={{ padding: "10px 10px 0", display: "grid", gap: 8 }}>
            <div className="bg-skeleton-bar" style={{ height: 48 }} />
            <div className="bg-skeleton-bar" style={{ height: 15, width: "86%" }} />
            <div className="bg-skeleton-bar" style={{ height: 14, width: "58%" }} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <div className="bg-skeleton-bar" style={{ height: 18, width: "55%" }} />
              <div className="bg-skeleton-bar" style={{ height: 26, width: 26 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LotPhoto({ item, priority = false }) {
  const [failed, setFailed] = useState(null);
  const src = mediaUrl(item?.imageUrl);
  if (src && failed !== item.imageUrl) {
    return (
      <img
        src={src}
        alt={item.name}
        loading={priority ? "eager" : "lazy"}
        onError={() => setFailed(item.imageUrl)}
      />
    );
  }
  return (
    <div className="lot-fallback" aria-label="Chưa có ảnh sản phẩm">
      <span>PHIÊN ĐẤU GIÁ</span>
      <b>#{String(item?.id || 0).padStart(3, "0")}</b>
    </div>
  );
}

export function priceLabel(item) {
  if (item.status === "Scheduled") return "Giá khởi điểm";
  if (item.status === "Completed" && item.winnerId) return "Giá trúng đấu giá";
  if (item.status === "Completed" || item.status === "Cancelled")
    return "Giá cuối phiên";
  return "Giá hiện tại";
}
