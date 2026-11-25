import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { json, getSession, setSession } from "./api";
import {
  MyProducts,
  ProductForm,
  Orders,
  OrderDetail,
  Notifications,
  Profile,
  MyBids,
} from "./screens.jsx";
import AdminWorkspace from "./AdminWorkspace.jsx";
import "./workspace.css";
import { Product } from "./product.jsx";
import Explore from "./Explore.jsx";
import "../styles.css";
import "./catalog.css";

createRoot(document.getElementById("app")).render(<App />);

const asObject = (form) => Object.fromEntries(new FormData(form).entries());

function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/");
  const [session, setLogin] = useState(getSession);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "/");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    function expired() {
      setLogin(null);
      location.hash = "/login";
      setToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    addEventListener("bidnet:expired", expired);
    return () => removeEventListener("bidnet:expired", expired);
  }, []);
  const go = (path) => {
    location.hash = path;
    setRoute(path);
    scrollTo(0, 0);
  };
  const notify = (message) => setToast(message);
  const login = (data) => {
    setSession(data);
    setLogin(data);
    go(data.user.role === "Admin" ? "/admin" : "/");
    notify(`Xin chào ${data.user.fullName || data.user.username}`);
  };
  const logout = () => {
    setSession(null);
    setLogin(null);
    go("/");
    notify("Đã đăng xuất.");
  };
  const user = session?.user;
  const admin = user?.role === "Admin";
  const common = { go, notify, user, admin };
  const nav = [
    ["/", "Khám phá"],
    ...(user
      ? [
          ["/my-products", "Sản phẩm của tôi"],
          ["/orders", "Đơn hàng"],
          ["/notifications", "Thông báo"],
          ["/profile", "Tài khoản"],
        ]
      : []),
    ...(admin ? [["/admin", "Quản trị"]] : []),
  ];
  let page;
  if (route === "/" || route.startsWith("/products?"))
    page = <Explore {...common} />;
  else if (/^\/product\/\d+$/.test(route))
    page = <Product key={route} id={Number(route.split("/")[2])} {...common} />;
  else if (route === "/login" || route === "/register")
    page = <Auth key={route} mode={route.slice(1)} login={login} {...common} />;
  else if (!user) page = <Gate go={go} />;
  else if (route === "/my-products") page = <MyProducts {...common} />;
  else if (route === "/product/new" || /^\/product\/\d+\/edit$/.test(route))
    page = (
      <ProductForm
        key={route}
        id={route === "/product/new" ? null : Number(route.split("/")[2])}
        {...common}
      />
    );
  else if (route === "/orders") page = <Orders {...common} />;
  else if (/^\/order\/\d+$/.test(route))
    page = (
      <OrderDetail key={route} id={Number(route.split("/")[2])} {...common} />
    );
  else if (route === "/notifications") page = <Notifications {...common} />;
  else if (route === "/profile")
    page = (
      <Profile
        {...common}
        onProfile={(updated) => {
          const next = { ...session, user: updated };
          setSession(next);
          setLogin(next);
        }}
      />
    );
  else if (route === "/my-bids") page = <MyBids {...common} />;
  else if (route === "/admin" || route.startsWith("/admin/"))
    page = admin ? (
      <AdminWorkspace route={route} {...common} />
    ) : (
      <section className="empty">
        <h1>Truy cập bị từ chối</h1>
        <p>Khu vực này dành cho quản trị viên.</p>
        <a className="btn secondary" href="#/">
          Về trang khám phá
        </a>
      </section>
    );
  else
    page = (
      <div className="empty">
        Không tìm thấy trang hoặc bạn không có quyền truy cập.
      </div>
    );
  return (
    <>
      <header className="top">
        <div className="top-inner">
          <a className="brand" aria-label="BidNet – Trang chủ" href="#/">
            Bid<span>Net</span>
          </a>
          <nav className="nav">
            {nav.map(([href, label]) => (
              <a
                key={href}
                className={
                  route === href ||
                  (href === "/admin" && route.startsWith("/admin/"))
                    ? "active"
                    : ""
                }
                href={`#${href}`}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="nav-right">
            {user ? (
              <>
                <span>{user.fullName || user.username}</span>
                <button className="btn ghost" onClick={logout}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <a href="#/login">Đăng nhập</a>
                <a className="btn" href="#/register">
                  Đăng ký
                </a>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="wrap">{page}</main>
      <footer className="footer">BidNet · Sàn đấu giá trực tuyến</footer>
      {toast && (
        <div id="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}

function Gate({ go }) {
  return (
    <div className="panel form-wrap">
      <h1>Vui lòng đăng nhập</h1>
      <p className="muted">Tính năng này cần tài khoản BidNet.</p>
      <button className="btn" onClick={() => go("/login")}>
        Đăng nhập
      </button>
    </div>
  );
}

function Auth({ mode, login, go }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const register = mode === "register";
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const v = asObject(e.currentTarget);
    try {
      if (register) {
        await json("POST", "/api/auth/register", {
          username: v.username,
          email: v.email,
          password: v.password,
          fullName: v.fullName || null,
          phoneNumber: v.phoneNumber || null,
        });
        const result = await json("POST", "/api/auth/login", {
          usernameOrEmail: v.username,
          password: v.password,
        });
        login(result);
      } else
        login(
          await json("POST", "/api/auth/login", {
            usernameOrEmail: v.usernameOrEmail,
            password: v.password,
          }),
        );
    } catch (ex) {
      setError(ex.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel form-wrap">
      <div className="eyebrow">Tài khoản BidNet</div>
      <h1>{register ? "Tạo tài khoản" : "Đăng nhập"}</h1>
      <p className="muted">
        {register
          ? "Bắt đầu đăng bán và tham gia các phiên đấu giá."
          : "Chào mừng bạn quay lại."}
      </p>
      <form onSubmit={submit}>
        {register ? (
          <>
            <Field
              label="Tên đăng nhập"
              name="username"
              autoComplete="username"
              maxLength={50}
              required
              minLength={3}
            />
            <Field
              label="Email"
              name="email"
              autoComplete="email"
              maxLength={100}
              type="email"
              required
            />
            <Field label="Họ và tên" name="fullName" maxLength={200} />
            <Field
              label="Số điện thoại"
              name="phoneNumber"
              type="tel"
              maxLength={20}
            />
          </>
        ) : (
          <Field
            label="Tên đăng nhập hoặc email"
            name="usernameOrEmail"
            required
          />
        )}
        <Field
          label="Mật khẩu"
          name="password"
          type="password"
          required
          minLength={register ? 8 : undefined}
        />
        {error && <div className="notice error">{error}</div>}
        <button className="btn dark" disabled={busy}>
          {busy ? "Đang xử lý…" : register ? "Đăng ký" : "Đăng nhập"}
        </button>
      </form>
      <p className="muted small">
        {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
        <a href={register ? "#/login" : "#/register"}>
          {register ? "Đăng nhập" : "Đăng ký"}
        </a>
      </p>
    </div>
  );
}
function Field({ label, name, value, type = "text", ...props }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        defaultValue={value}
        type={type}
        {...props}
      />
    </div>
  );
}
