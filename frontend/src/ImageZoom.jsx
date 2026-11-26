import React, { useEffect, useRef, useState } from "react";
import { LotPhoto } from "./Lot.jsx";

// Ảnh chính: rê chuột để phóng to quanh con trỏ, bấm để mở lightbox.
export function Magnifier({ item, src, onOpen }) {
  const [origin, setOrigin] = useState(null);
  const [failed, setFailed] = useState(false);

  if (failed) return <LotPhoto item={{ ...item, imageUrl: "" }} priority />;

  const track = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div
      className={`magnifier${origin ? " is-zoomed" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`Xem ảnh lớn: ${item.name}`}
      onMouseMove={track}
      onMouseLeave={() => setOrigin(null)}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <img
        src={src}
        alt={item.name}
        draggable="false"
        loading="eager"
        onError={() => setFailed(true)}
        style={
          origin
            ? {
                transform: "scale(2.3)",
                transformOrigin: `${origin.x}% ${origin.y}%`,
              }
            : undefined
        }
      />
      <span className="magnifier-hint" aria-hidden="true">
        ⌕ Di chuột để phóng to · Bấm để xem lớn
      </span>
    </div>
  );
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

// Lightbox toàn màn hình: phóng to/thu nhỏ, kéo ảnh, chuyển ảnh trong gallery.
export function Lightbox({ photos, index, onIndexChange, onClose, alt }) {
  const dialogRef = useRef(null);
  const stageRef = useRef(null);
  const drag = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    dialog.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  // Đổi ảnh thì trả về mức zoom mặc định để không bị lệch khung.
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [index]);

  const clampOffset = (next, value = scale) => {
    const stage = stageRef.current;
    if (!stage || value <= 1) return { x: 0, y: 0 };
    const maxX = (stage.clientWidth * (value - 1)) / 2;
    const maxY = (stage.clientHeight * (value - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  const applyScale = (value) => {
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
    setScale(next);
    setOffset((current) => clampOffset(current, next));
  };

  const show = (step) => {
    if (photos.length < 2) return;
    onIndexChange((index + step + photos.length) % photos.length);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) > 6) current.moved = true;
    if (scale > 1) {
      setOffset(
        clampOffset({ x: current.ox + dx, y: current.oy + dy }),
      );
    }
  };

  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (!current || current.moved) return;
    // Chạm (hoặc bấm) vào ảnh: bật/tắt zoom — hỗ trợ cả màn hình cảm ứng.
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      applyScale(2.5);
    }
  };

  const photo = photos[index];

  return (
    <dialog
      ref={dialogRef}
      className="lightbox"
      aria-label={`Xem ảnh: ${alt}`}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") show(-1);
        else if (event.key === "ArrowRight") show(1);
        else if (event.key === "+" || event.key === "=") applyScale(scale + 0.5);
        else if (event.key === "-") applyScale(scale - 0.5);
      }}
    >
      <div className="lightbox-bar">
        <span className="lightbox-count">
          {photos.length > 1 ? `${index + 1} / ${photos.length}` : "Ảnh sản phẩm"}
        </span>
        <div className="lightbox-tools">
          <button
            type="button"
            onClick={() => applyScale(scale - 0.5)}
            disabled={scale <= MIN_SCALE}
            aria-label="Thu nhỏ ảnh"
          >
            −
          </button>
          <span className="lightbox-zoom">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => applyScale(scale + 0.5)}
            disabled={scale >= MAX_SCALE}
            aria-label="Phóng to ảnh"
          >
            +
          </button>
          <button
            type="button"
            className="lightbox-close"
            onClick={onClose}
            aria-label="Đóng chế độ xem ảnh"
          >
            ×
          </button>
        </div>
      </div>
      <div
        className="lightbox-stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        {photo && (
          <img
            src={photo.url}
            alt={photo.label || alt}
            draggable="false"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              cursor: scale > 1 ? "grab" : "zoom-in",
            }}
          />
        )}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="lightbox-nav prev"
              aria-label="Ảnh trước"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => show(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="lightbox-nav next"
              aria-label="Ảnh sau"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => show(1)}
            >
              ›
            </button>
          </>
        )}
      </div>
      {photo?.label && <div className="lightbox-caption">{photo.label}</div>}
    </dialog>
  );
}
