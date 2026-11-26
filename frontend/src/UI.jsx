import React, { createContext, useContext, useEffect, useId, useRef, useState } from "react";

export function Modal({ title, children, onClose, busy = false, className = "" }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector('[data-initial-focus], input:not(:disabled), textarea:not(:disabled)')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className={`dialog ${className}`.trim()} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" type="button" disabled={busy} aria-label="Đóng hộp thoại" onClick={onClose}>×</button></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}

const ConfirmContext = createContext(null);
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolve = useRef(null);
  const confirm = options => new Promise(done => {
    resolve.current?.(false);
    resolve.current = done;
    setRequest(typeof options === "string" ? { title: "Xác nhận thao tác", message: options } : options);
  });
  const close = accepted => { resolve.current?.(accepted); resolve.current = null; setRequest(null); };
  useEffect(() => () => resolve.current?.(false), []);
  return <ConfirmContext.Provider value={confirm}>{children}{request &&
    <Modal title={request.title} onClose={() => close(false)}><p>{request.message}</p><div className="dialog-actions">
      <button className="btn secondary" autoFocus onClick={() => close(false)}>Quay lại</button>
      <button className={`btn ${request.danger ? "danger" : "dark"}`} onClick={() => close(true)}>{request.action || "Xác nhận"}</button>
    </div></Modal>}</ConfirmContext.Provider>;
}
export const useConfirm = () => useContext(ConfirmContext);

export function PageHeader({ eyebrow, title, description, children }) {
  return <header className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{children && <div className="actions">{children}</div>}</header>;
}

export function EmptyState({ title, description, children }) {
  return <div className="empty"><span className="empty-symbol" aria-hidden="true">—</span><h2>{title}</h2>{description && <p>{description}</p>}{children}</div>;
}

export function LoadingState({ label = "Đang tải dữ liệu…" }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className="notice error" role="alert"><strong>Không thể hoàn tất yêu cầu</strong><p>{message}</p>{onRetry && <button className="btn secondary" onClick={onRetry}>Thử lại</button>}</div>;
}

function moneyToWords(num) {
  if (!Number.isFinite(num) || num <= 0) return "";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ đồng`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} triệu đồng`;
  if (num >= 1_000) return `${(num / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} nghìn đồng`;
  return `${num.toLocaleString("vi-VN")} đồng`;
}

export function MoneyInput({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  placeholder = "0",
  disabled = false,
  required = false,
  ariaLabel,
  showHint = true,
  className = "",
}) {
  const isControlled = value !== undefined;
  const [inner, setInner] = useState(() => String(defaultValue ?? "").replace(/\D/g, ""));
  const raw = (isControlled ? String(value ?? "") : inner).replace(/\D/g, "");
  const numeric = raw ? Number(raw) : 0;
  const formatted = raw ? numeric.toLocaleString("vi-VN") : "";

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!isControlled) setInner(digits);
    onChange?.(digits);
  };

  return (
    <div className={`bn-money-field ${className}`}>
      <div className="bn-money-box">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={formatted}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
        />
        <span className="bn-money-unit" aria-hidden="true">VNĐ</span>
      </div>
      {name && <input type="hidden" name={name} value={raw} />}
      {showHint && numeric > 0 && (
        <small className="bn-money-hint">
          {numeric.toLocaleString("vi-VN")} ₫ ({moneyToWords(numeric)})
        </small>
      )}
    </div>
  );
}
