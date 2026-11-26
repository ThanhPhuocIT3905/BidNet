import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";

const asObject = (form) => Object.fromEntries(new FormData(form).entries());

function PasswordField({
  label,
  id,
  name,
  autoComplete,
  minLength,
  disabled,
  className = "field",
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <div className="auth-password">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={128}
          required
          disabled={disabled}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        </button>
      </div>
    </div>
  );
}

// Một modal dùng chung cho đăng nhập/đăng ký để giữ nguyên trang đang xem.
export function AuthModal({ tab, onTab, onClose, onLogin }) {
  const ref = useRef(null);
  const close = () => {
    if (ref.current?.open) ref.current.close();
    onClose();
  };
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("input")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  const register = tab === "register";
  return (
    <dialog
      ref={ref}
      className="auth-dialog"
      aria-labelledby="auth-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <button
        className="icon-button auth-close"
        type="button"
        aria-label="Đóng cửa sổ đăng nhập"
        onClick={close}
      >
        ×
      </button>
      <div className="auth-card">
        <span className="brand auth-brand">
          Bid<span>Net</span>
        </span>
        <h2 id="auth-title">
          {register ? "Tạo tài khoản mới" : "Chào mừng bạn trở lại!"}
        </h2>
        <p className="auth-sub">
          {register
            ? "Tham gia cộng đồng đấu giá trực tuyến"
            : "Đăng nhập để tham gia đấu giá trực tuyến"}
        </p>
        <div className="auth-tabs" role="tablist" aria-label="Đăng nhập hoặc đăng ký">
          {[
            ["login", "Đăng nhập"],
            ["register", "Đăng ký"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => onTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {register ? (
          <RegisterForm onLogin={onLogin} onTab={onTab} />
        ) : (
          <LoginForm onLogin={onLogin} onTab={onTab} />
        )}
      </div>
    </dialog>
  );
}

function LoginForm({ onLogin, onTab }) {
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setHint("");
    const value = asObject(event.currentTarget);
    try {
      onLogin(
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            usernameOrEmail: value.usernameOrEmail,
            password: value.password,
          }),
        }),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="auth-username">Email hoặc tên đăng nhập</label>
        <input
          id="auth-username"
          name="usernameOrEmail"
          autoComplete="username"
          maxLength={100}
          required
          disabled={busy}
        />
      </div>
      <PasswordField
        label="Mật khẩu"
        id="auth-password"
        name="password"
        autoComplete="current-password"
        disabled={busy}
      />
      <button
        type="button"
        className="auth-forgot"
        onClick={() => {
          setError("");
          setHint(
            "Hệ thống chưa hỗ trợ đặt lại mật khẩu tự động. Vui lòng liên hệ quản trị viên qua trang Liên hệ.",
          );
        }}
      >
        Quên mật khẩu?
      </button>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {hint && (
        <div className="notice" role="status">
          {hint}
        </div>
      )}
      <button className="btn dark auth-submit" disabled={busy}>
        {busy ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
      <p className="auth-switch">
        Chưa có tài khoản?{" "}
        <button type="button" onClick={() => onTab("register")}>
          Đăng ký ngay
        </button>
      </p>
    </form>
  );
}

function RegisterForm({ onLogin, onTab }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const value = asObject(form);
    setError("");
    if (value.password !== value.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!form.elements.agree.checked) {
      setError("Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: value.username,
          email: value.email,
          password: value.password,
          fullName: value.fullName,
          phoneNumber: value.phoneNumber || null,
        }),
      });
      onLogin(
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            usernameOrEmail: value.username,
            password: value.password,
          }),
        }),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="auth-form auth-register-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="auth-fullname">Họ và tên *</label>
        <input
          id="auth-fullname"
          name="fullName"
          autoComplete="name"
          maxLength={200}
          required
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="auth-email">Email *</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={100}
          required
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="auth-register-username">Tên đăng nhập *</label>
        <input
          id="auth-register-username"
          name="username"
          autoComplete="username"
          maxLength={50}
          minLength={3}
          pattern="[a-zA-Z0-9_.\-]{3,50}"
          title="3–50 chữ cái, chữ số, dấu chấm, gạch ngang hoặc gạch dưới"
          required
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="auth-phone">Số điện thoại</label>
        <input
          id="auth-phone"
          name="phoneNumber"
          type="tel"
          autoComplete="tel"
          maxLength={20}
          disabled={busy}
        />
      </div>
      <PasswordField
        label="Mật khẩu *"
        id="auth-register-password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        disabled={busy}
        className="field"
      />
      <PasswordField
        label="Xác nhận mật khẩu *"
        id="auth-confirm-password"
        name="confirmPassword"
        autoComplete="new-password"
        minLength={8}
        disabled={busy}
        className="field"
      />
      <label className="auth-terms">
        <input type="checkbox" name="agree" disabled={busy} />
        <span>
          Tôi đồng ý với{" "}
          <a href="#/policies/dieu-khoan-su-dung" target="_blank" rel="noreferrer">
            Điều khoản sử dụng
          </a>{" "}
          và{" "}
          <a href="#/policies/chinh-sach-bao-mat" target="_blank" rel="noreferrer">
            Chính sách bảo mật
          </a>
          .
        </span>
      </label>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <button className="btn dark auth-submit" disabled={busy}>
        {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
      </button>
      <p className="auth-switch">
        Đã có tài khoản?{" "}
        <button type="button" onClick={() => onTab("login")}>
          Đăng nhập
        </button>
      </p>
    </form>
  );
}
