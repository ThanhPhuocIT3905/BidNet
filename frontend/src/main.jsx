import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, json, getSession, setSession, query } from "./api";
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
import { Product } from "./product.jsx";
import Explore from "./Explore.jsx";
import { GavelIcon } from "./Lot.jsx";
import "../styles.css";
import "./catalog.css";
import "./workspace.css";

createRoot(document.getElementById("app")).render(<App />);

const asObject = (form) => Object.fromEntries(new FormData(form).entries());

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, "0");
  const timeStr = `${pad(now.getHours())} : ${pad(now.getMinutes())} : ${pad(now.getSeconds())}`;
  const weekday = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ][now.getDay()];
  const dateStr = `${weekday}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  return (
    <div className="header-clock" title="Giờ hệ thống">
      <strong>{timeStr}</strong>
      <span>{dateStr}</span>
    </div>
  );
}

function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/");
  const [session, setLogin] = useState(getSession);
  const [toast, setToast] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [categories, setCategories] = useState([]);
  const [openMenu, setOpenMenu] = useState(null); // "cat" | "auctions" | null
  const [headerQuery, setHeaderQuery] = useState("");
  const headerRef = useRef(null);

  useEffect(() => {
    const onHash = () => {
      setRoute(location.hash.slice(1) || "/");
      setOpenMenu(null);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    api("/api/categories")
      .then((data) => Array.isArray(data) && setCategories(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    function expired() {
      setLogin(null);
      setUnreadCount(0);
      location.hash = "/login";
      setToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    addEventListener("bidnet:expired", expired);
    return () => removeEventListener("bidnet:expired", expired);
  }, []);

  const user = session?.user;
  const admin = user?.role === "Admin";

  const refreshUnread = useCallback(async () => {
    if (!getSession()?.accessToken) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await api("/api/notifications/unread-count");
      setUnreadCount(data?.unreadCount || 0);
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    refreshUnread();
    const timer = setInterval(refreshUnread, 30000);
    addEventListener("bidnet:notifications", refreshUnread);
    return () => {
      clearInterval(timer);
      removeEventListener("bidnet:notifications", refreshUnread);
    };
  }, [user?.id, refreshUnread]);

  const go = (path) => {
    location.hash = path;
    setRoute(path);
    setOpenMenu(null);
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
    setUnreadCount(0);
    go("/");
    notify("Đã đăng xuất.");
  };

  const navigateExplore = (params) => {
    const qs = query(params);
    go(qs ? `/?${qs}` : "/");
  };

  const submitHeaderSearch = (e) => {
    e.preventDefault();
    navigateExplore({ q: headerQuery.trim() });
  };

  const [baseRoute] = route.split("?");
  const common = { go, notify, user, admin };

  let page;
  if (baseRoute === "/" || baseRoute === "/products")
    page = <Explore route={route} {...common} />;
  else if (/^\/product\/\d+$/.test(baseRoute))
    page = (
      <Product key={baseRoute} id={Number(baseRoute.split("/")[2])} {...common} />
    );
  else if (baseRoute === "/login" || baseRoute === "/register")
    page = (
      <Auth key={baseRoute} mode={baseRoute.slice(1)} login={login} {...common} />
    );
  else if (!user) page = <Gate go={go} />;
  else if (baseRoute === "/my-products") page = <MyProducts {...common} />;
  else if (
    baseRoute === "/product/new" ||
    /^\/product\/\d+\/edit$/.test(baseRoute)
  )
    page = (
      <ProductForm
        key={baseRoute}
        id={baseRoute === "/product/new" ? null : Number(baseRoute.split("/")[2])}
        {...common}
      />
    );
  else if (baseRoute === "/orders") page = <Orders {...common} />;
  else if (/^\/order\/\d+$/.test(baseRoute))
    page = (
      <OrderDetail
        key={baseRoute}
        id={Number(baseRoute.split("/")[2])}
        {...common}
      />
    );
  else if (baseRoute === "/notifications") page = <Notifications {...common} />;
  else if (baseRoute === "/profile")
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
  else if (baseRoute === "/my-bids") page = <MyBids {...common} />;
  else if (baseRoute === "/admin" || baseRoute.startsWith("/admin/"))
    page = admin ? (
      <AdminWorkspace route={baseRoute} {...common} />
    ) : (
      <section className="empty">
        <h1>Truy cập bị từ chối</h1>
        <p>Khu vực này dành riêng cho quản trị viên (Admin).</p>
        <a className="btn secondary" href="#/">
          Về trang chủ
        </a>
      </section>
    );
  else
    page = (
      <div className="empty">
        <h2>Không tìm thấy trang</h2>
        <p>Đường dẫn không tồn tại hoặc bạn không có quyền truy cập.</p>
        <a className="btn" href="#/">
          Về trang chủ
        </a>
      </div>
    );

  const initials = (user?.fullName || user?.username || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <header className="site-header" ref={headerRef}>
        {/* Row 1: Crisp White Utility + Category + Search + Live Clock + Auth */}
        <div className="header-row-1">
          <div className="header-inner">
            <a className="brand" href="#/" aria-label="BidNet Trang chủ">
              <span className="brand-mark">
                <GavelIcon size={18} />
              </span>
              Bid<span className="brand-accent">Net</span>
            </a>

            <div className="header-cat-wrap">
              <button
                type="button"
                className="header-cat-btn"
                aria-expanded={openMenu === "cat"}
                onClick={() => setOpenMenu(openMenu === "cat" ? null : "cat")}
              >
                <span>Danh mục sản phẩm</span>
                <span aria-hidden="true">▾</span>
              </button>
              {openMenu === "cat" && (
                <div className="header-dropdown" role="menu">
                  <button
                    type="button"
                    onClick={() => navigateExplore({})}
                  >
                    <span>Tất cả danh mục</span>
                  </button>
                  {categories.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => navigateExplore({ category: c.name })}
                    >
                      <span>{c.name}</span>
                      <span className="small muted mono">{c.productCount}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form className="header-search" onSubmit={submitHeaderSearch}>
              <button
                type="submit"
                className="header-search-icon"
                aria-label="Tìm kiếm"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>
              <input
                type="search"
                placeholder="Tìm kiếm sản phẩm đấu giá…"
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
              />
            </form>

            <div className="header-right">
              <LiveClock />
              {user ? (
                <>
                  <a className="user-chip" href="#/profile" title="Hồ sơ cá nhân">
                    <span className="user-avatar" aria-hidden="true">
                      {initials}
                    </span>
                    <span className="user-chip-name">
                      {user.fullName || user.username}
                    </span>
                    <span className={`role-pill ${user.role}`}>{user.role}</span>
                  </a>
                  <button className="btn ghost sm" onClick={logout}>
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <a className="btn outline sm" href="#/register">
                    Đăng ký
                  </a>
                  <a className="btn sm" href="#/login">
                    Đăng nhập
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Dark Black-Blue-Purple Primary Nav Bar */}
        <div className="header-row-2">
          <nav className="nav-bar-inner" aria-label="Điều hướng chính">
            <a
              className={`nav-link ${baseRoute === "/" ? "active" : ""}`}
              href="#/"
            >
              Trang chủ
            </a>
            <div className="nav-dropdown-wrap">
              <button
                type="button"
                className={`nav-link ${openMenu === "auctions" ? "active" : ""}`}
                aria-expanded={openMenu === "auctions"}
                onClick={() =>
                  setOpenMenu(openMenu === "auctions" ? null : "auctions")
                }
              >
                Phiên đấu giá <span aria-hidden="true">▾</span>
              </button>
              {openMenu === "auctions" && (
                <div className="nav-dark-dropdown">
                  <button
                    type="button"
                    onClick={() => navigateExplore({ status: "Active" })}
                  >
                    ● Đang diễn ra
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateExplore({ status: "Scheduled" })}
                  >
                    ○ Sắp diễn ra
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateExplore({ status: "Completed" })}
                  >
                    ✓ Đã kết thúc
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateExplore({ status: "Cancelled" })}
                  >
                    ✕ Đã hủy
                  </button>
                  <button type="button" onClick={() => navigateExplore({})}>
                    Xem tất cả phiên →
                  </button>
                </div>
              )}
            </div>
            {user && (
              <>
                <a
                  className={`nav-link ${baseRoute === "/my-products" ? "active" : ""}`}
                  href="#/my-products"
                >
                  Đăng bán
                </a>
                <a
                  className={`nav-link ${baseRoute === "/my-bids" ? "active" : ""}`}
                  href="#/my-bids"
                >
                  Lịch sử đặt giá
                </a>
                <a
                  className={`nav-link ${baseRoute === "/orders" || baseRoute.startsWith("/order/") ? "active" : ""}`}
                  href="#/orders"
                >
                  Đơn hàng
                </a>
                <a
                  className={`nav-link ${baseRoute === "/notifications" ? "active" : ""}`}
                  href="#/notifications"
                >
                  Thông báo
                  {unreadCount > 0 && (
                    <span className="nav-pill-count">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </a>
                <a
                  className={`nav-link ${baseRoute === "/profile" ? "active" : ""}`}
                  href="#/profile"
                >
                  Hồ sơ
                </a>
              </>
            )}
            {admin && (
              <a
                className={`nav-link ${baseRoute.startsWith("/admin") ? "active" : ""}`}
                href="#/admin"
              >
                Quản trị hệ thống
              </a>
            )}
          </nav>
        </div>
      </header>

      <main className="wrap">{page}</main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="brand" style={{ marginBottom: 10 }}>
                <span className="brand-mark">
                  <GavelIcon size={17} />
                </span>
                Bid<span className="brand-accent">Net</span>
              </div>
              <p className="small muted" style={{ margin: "0 0 10px" }}>
                Nền tảng đấu giá trực tuyến thời gian thực minh bạch, bảo vệ tranh chấp giá và quản lý đơn hàng trọn luồng.
              </p>
              <strong style={{ color: "var(--blue)", fontSize: 15 }}>
                HOTLINE 24/7: 1900 8868
              </strong>
            </div>
            <div className="footer-col">
              <h4>Khám phá phiên</h4>
              <ul>
                <li>
                  <a href="#/?status=Active">Phiên đang diễn ra</a>
                </li>
                <li>
                  <a href="#/?status=Scheduled">Phiên sắp mở bán</a>
                </li>
                <li>
                  <a href="#/?status=Completed">Phiên đã kết thúc</a>
                </li>
                <li>
                  <a href="#/">Tất cả sản phẩm</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Dành cho thành viên</h4>
              <ul>
                <li>
                  <a href="#/register">Đăng ký tài khoản</a>
                </li>
                <li>
                  <a href="#/product/new">Tạo phiên đấu giá</a>
                </li>
                <li>
                  <a href="#/my-bids">Lịch sử đặt giá</a>
                </li>
                <li>
                  <a href="#/orders">Quản lý đơn hàng</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Quy tắc & Hệ thống</h4>
              <ul>
                <li>Bước giá tối thiểu: 1.000 ₫</li>
                <li>Chống tranh chấp: SQL RowVersion</li>
                <li>Cập nhật tức thì: SignalR Hub</li>
                <li>Tự động mở & chốt phiên mỗi 5s</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 BidNet · Sàn đấu giá trực tuyến</span>
            <span>ASP.NET Core 10 · EF Core · SignalR · React 19</span>
          </div>
        </div>
      </footer>

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
    <div className="panel form-wrap" style={{ textAlign: "center" }}>
      <div className="eyebrow">Yêu cầu đăng nhập</div>
      <h1>Vui lòng đăng nhập để tiếp tục</h1>
      <p className="muted">
        Bạn cần tài khoản BidNet để sử dụng tính năng này.
      </p>
      <div className="actions" style={{ justifyContent: "center", marginTop: 16 }}>
        <button className="btn" onClick={() => go("/login")}>
          Đăng nhập ngay
        </button>
        <button className="btn outline" onClick={() => go("/register")}>
          Tạo tài khoản mới
        </button>
      </div>
    </div>
  );
}

function Auth({ mode, login }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
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
      } else {
        login(
          await json("POST", "/api/auth/login", {
            usernameOrEmail: v.usernameOrEmail,
            password: v.password,
          }),
        );
      }
    } catch (ex) {
      setError(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel form-wrap">
      <div className="eyebrow">Tài khoản BidNet</div>
      <h1>{register ? "Đăng ký thành viên" : "Đăng nhập hệ thống"}</h1>
      <p className="muted">
        {register
          ? "Tạo một tài khoản duy nhất để đăng bán sản phẩm và tham gia đấu giá."
          : "Đăng nhập bằng tên tài khoản hoặc email của bạn."}
      </p>
      <form onSubmit={submit}>
        {register ? (
          <>
            <Field
              label="Tên đăng nhập"
              name="username"
              autoComplete="username"
              placeholder="Ví dụ: nguyenvana"
              maxLength={50}
              required
              minLength={3}
            />
            <Field
              label="Email"
              name="email"
              autoComplete="email"
              placeholder="ten@email.com"
              maxLength={100}
              type="email"
              required
            />
            <div className="form-grid">
              <Field
                label="Họ và tên"
                name="fullName"
                placeholder="Nguyễn Văn A"
                maxLength={200}
              />
              <Field
                label="Số điện thoại"
                name="phoneNumber"
                placeholder="0901234567"
                type="tel"
                maxLength={20}
              />
            </div>
          </>
        ) : (
          <Field
            label="Tên đăng nhập hoặc Email"
            name="usernameOrEmail"
            autoComplete="username"
            placeholder="Nhập username hoặc email"
            required
          />
        )}
        <div className="field">
          <label htmlFor="password">Mật khẩu</label>
          <div className="password-row">
            <input
              id="password"
              name="password"
              type={showPass ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder={register ? "Tối thiểu 8 ký tự" : "Nhập mật khẩu"}
              required
              minLength={register ? 8 : undefined}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPass((v) => !v)}
            >
              {showPass ? "Ẩn" : "Hiện"}
            </button>
          </div>
        </div>
        {error && <div className="notice error">{error}</div>}
        <button className="btn" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Đang xử lý…" : register ? "Đăng ký & Đăng nhập" : "Đăng nhập"}
        </button>
      </form>
      <p className="muted small" style={{ marginTop: 16, textAlign: "center" }}>
        {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
        <a href={register ? "#/login" : "#/register"}>
          {register ? "Đăng nhập ngay" : "Đăng ký miễn phí"}
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
