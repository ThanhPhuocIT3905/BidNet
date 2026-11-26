import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, getSession, setSession } from "./api";
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
import { SupportWorkspace, TicketDetail } from "./Workflows.jsx";
import { Product } from "./product.jsx";
import Explore from "./Explore.jsx";
import {
  NewsPage,
  DocPage,
  AboutPage,
  ContactPage,
  FavoritesPage,
} from "./site.jsx";
import { useFavorites } from "./widgets.jsx";
import "./ui.css";
import "./market.css";
import ThemeToggle from "./ThemeToggle.jsx";
import MarketplaceHome from "./MarketplaceHome.jsx";
import { ConfirmProvider } from "./UI.jsx";
import Avatar from "./Avatar.jsx";
import { AuthModal } from "./AuthModal.jsx";

createRoot(document.getElementById("app")).render(<ConfirmProvider><App /></ConfirmProvider>);

// /login và /register chỉ mở modal, URL được đưa về trang đang xem.
const parseAuthRoute = (hash) => {
  const [routePath, queryString] = (hash.slice(1) || "/").split("?");
  if (routePath !== "/login" && routePath !== "/register") return null;
  const returnTo = new URLSearchParams(queryString || "").get("returnTo");
  return {
    tab: routePath === "/register" ? "register" : "login",
    base: returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null,
  };
};
const mainNav = [
  ["/", "Trang chủ"],
  ["/auctions", "Đấu giá"],
  ["/news", "Tin tức"],
  ["/guides", "Hướng dẫn"],
  ["/policies", "Quy định"],
  ["/about", "Giới thiệu"],
  ["/contact", "Liên hệ"],
];

function App() {
  const [boot] = useState(() => parseAuthRoute(location.hash));
  const [route, setRoute] = useState(
    boot?.base || (boot ? "/" : location.hash.slice(1) || "/"),
  );
  const [authTab, setAuthTab] = useState(boot?.tab || null);
  const [session, setLogin] = useState(getSession);
  const [toast, setToast] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const { ids: favorites } = useFavorites();
  const [path] = route.split("?");
  const routeRef = useRef(route);
  routeRef.current = route;
  useEffect(() => {
    const onHash = () => {
      const auth = parseAuthRoute(location.hash);
      if (auth) {
        setAuthTab(auth.tab);
        const target = auth.base || routeRef.current;
        history.replaceState(null, "", `#${target}`);
        setRoute(target);
        setCatOpen(false);
        return;
      }
      setRoute(location.hash.slice(1) || "/");
      setCatOpen(false);
      scrollTo(0, 0);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    // Mở thẳng /login hoặc /register vẫn giữ URL sạch sau khi modal bật.
    if (boot) history.replaceState(null, "", `#${boot.base || "/"}`);
  }, []);
  useEffect(() => {
    api("/api/Categories").then(setCategories, () => setCategories([]));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    function expired(event) {
      setLogin(null);
      location.hash = "/login";
      setToast(event.detail || "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    addEventListener("bidnet:expired", expired);
    return () => removeEventListener("bidnet:expired", expired);
  }, []);
  const go = (next) => {
    // Không điều hướng sang trang đăng nhập: mở modal ngay trên trang hiện tại.
    const auth = parseAuthRoute(`#${next}`);
    if (auth) {
      setAuthTab(auth.tab);
      if (auth.base) {
        history.replaceState(null, "", `#${auth.base}`);
        setRoute(auth.base);
      }
      setCatOpen(false);
      return;
    }
    location.hash = next;
    setRoute(next);
    setCatOpen(false);
    scrollTo(0, 0);
  };
  const notify = (message) => setToast(message);
  const login = (data) => {
    setSession(data);
    setLogin(data);
    setAuthTab(null);
    if (data.user.role === "Admin") go("/admin");
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
  const adminArea = admin && (path === "/admin" || path.startsWith("/admin/"));
  const accountArea = user && ["/my-products", "/my-bids", "/orders", "/notifications", "/profile"].includes(path);
  const common = { go, notify, user, admin, openAuth: setAuthTab };
  const submitSearch = (event) => {
    event.preventDefault();
    go(`/auctions?q=${encodeURIComponent(search.trim())}`);
  };
  let page;
  if (path === "/") page = <MarketplaceHome {...common} />;
  else if (path === "/auctions" || path === "/products")
    page = <Explore key={route} route={route} {...common} />;
  else if (/^\/product\/\d+$/.test(path))
    page = <Product key={route} id={Number(path.split("/")[2])} {...common} />;
  else if (path === "/news" || /^\/news\/[^/]+$/.test(path))
    page = <NewsPage key={route} slug={path.startsWith("/news/") ? path.split("/")[2] : null} />;
  else if (path === "/guides" || /^\/guides\/[^/]+$/.test(path))
    page = <DocPage key={route} section="guides" slug={path.split("/")[2] || null} />;
  else if (path === "/policies" || /^\/policies\/[^/]+$/.test(path))
    page = <DocPage key={route} section="policies" slug={path.split("/")[2] || null} />;
  else if (path === "/about") page = <AboutPage />;
  else if (path === "/contact") page = <ContactPage {...common} />;
  /* Yêu thích lưu bằng localStorage nên không cần đăng nhập; đặt trước
     cổng đăng nhập để link ♡ trên header luôn mở được. */
  else if (path === "/favorites") page = <FavoritesPage {...common} />;
  else if (!user && (/^\/(my-products|my-bids|orders|notifications|profile|admin)(\/|$)/.test(path) || path === "/product/new" || /^\/(product\/\d+\/edit|order\/\d+)$/.test(path))) page = <Gate openAuth={setAuthTab} />;
  else if (admin && (path === "/product/new" || path === "/my-products" || path === "/my-bids" || /^\/product\/\d+\/edit$/.test(path)))
    page = <section className="empty"><h1>Chức năng dành cho thành viên</h1><p>Admin quản lý hệ thống, không tham gia đăng bán hoặc đặt giá.</p><a className="btn" href="#/admin">Về quản trị</a></section>;
  else if (path === "/my-products") page = <MyProducts {...common} />;
  else if (path === "/product/new" || /^\/product\/\d+\/edit$/.test(path))
    page = (
      <ProductForm
        key={route}
        id={path === "/product/new" ? null : Number(path.split("/")[2])}
        {...common}
      />
    );
   else if (path === "/support" || /^\/support\/\d+$/.test(path)) page = !user ? <Gate openAuth={setAuthTab} /> : path === "/support" ? <SupportWorkspace {...common} /> : <TicketDetail key={route} id={Number(path.split("/")[2])} {...common} />;
   else if (path === "/orders") page = <Orders {...common} />;
  else if (/^\/order\/\d+$/.test(path))
    page = <OrderDetail key={route} id={Number(path.split("/")[2])} {...common} />;
  else if (path === "/notifications") page = <Notifications {...common} />;
  else if (path === "/profile")
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
  else if (path === "/my-bids") page = <MyBids {...common} />;
  else if (path === "/admin" || path.startsWith("/admin/"))
    page = admin ? (
      <AdminWorkspace route={route} {...common} />
    ) : (
      <section className="empty">
        <h1>Truy cập bị từ chối</h1>
        <p>Khu vực này dành cho quản trị viên.</p>
        <a className="btn secondary" href="#/">
          Về trang chủ
        </a>
      </section>
    );
  else
    page = (
      <div className="empty">
        <h1>Không tìm thấy trang</h1>
        <p>Đường dẫn không tồn tại hoặc bạn không có quyền truy cập.</p>
        <a className="btn secondary" href="#/">
          Về trang chủ
        </a>
      </div>
    );
  return (
    <>
      {adminArea ? <header className="workspace-top"><a className="brand" href="#/admin">Bid<span>Net</span><small>WORKSPACE</small></a><div className="workspace-top-actions"><a href="#/">Xem sàn đấu giá ↗</a><ThemeToggle /><a href="#/profile" className="workspace-identity"><Avatar user={user} /><span>{user.fullName || user.username}<small>Quản trị viên</small></span></a><button className="btn secondary" onClick={logout}>Đăng xuất</button></div></header> : <header className="top">
        <div className="top-bar">
          <div className="top-bar-inner">
            <span>BidNet · Sàn đấu giá trực tuyến</span>
            <span className="top-bar-right">
              <ThemeToggle />
            </span>
          </div>
        </div>
        <div className="top-inner">
          <a className="brand" aria-label="BidNet – Trang chủ" href="#/">
            Bid<span>Net</span>
          </a>
          <div
            className={`cat-menu ${catOpen ? "open" : ""}`}
            onMouseLeave={() => setCatOpen(false)}
          >
            <button
              type="button"
              className="cat-btn"
              aria-expanded={catOpen}
              onClick={() => setCatOpen(!catOpen)}
            >
              <span aria-hidden="true">☰</span> Danh mục
            </button>
            {catOpen && (
              <div className="cat-panel">
                <strong>Danh mục sản phẩm</strong>
                <div>
                  <a href="#/auctions" onClick={() => setCatOpen(false)}>
                    Tất cả phiên đấu giá
                  </a>
                  {categories.map((category) => (
                    <a
                      key={category.id}
                      href={`#/auctions?category=${encodeURIComponent(category.name)}`}
                      onClick={() => setCatOpen(false)}
                    >
                      {category.name}
                      <small>{category.productCount ?? 0}</small>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          <form className="top-search" onSubmit={submitSearch} role="search">
            <input
              type="search"
              placeholder="Tìm sản phẩm đấu giá…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Tìm sản phẩm"
            />
            <button type="submit" aria-label="Tìm kiếm">
              ⌕
            </button>
          </form>
          <div className="nav-right">
            <a className="fav-link" href="#/favorites" title="Phiên đang theo dõi">
              <span aria-hidden="true">♡</span>
              <em>{favorites.length}</em>
            </a>
            {user ? (
              <details className="account-menu">
                <summary>
                  <Avatar user={user} />
                  <span>{user.fullName || user.username}</span>
                </summary>
                <div className="account-panel">
                  {!admin && <><a href="#/my-products">Sản phẩm của tôi</a>
                  <a href="#/my-bids">Lịch sử đặt giá</a>
                  <a href="#/orders">Đơn hàng</a></>}
                  <a href="#/notifications">Thông báo</a>
                  <a href="#/favorites">Yêu thích</a>
                  <a href="#/profile">Hồ sơ cá nhân</a>
                  <a href={admin ? "#/admin/support" : "#/support"}>Yêu cầu hỗ trợ</a>
                  {admin && <a href="#/admin">Quản trị</a>}
                  <button type="button" onClick={logout}>
                    Đăng xuất
                  </button>
                </div>
              </details>
            ) : (
              <>
                <button
                  type="button"
                  className="btn ghost login-link"
                  onClick={() => setAuthTab("login")}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  className="btn dark"
                  onClick={() => setAuthTab("register")}
                >
                  Đăng ký
                </button>
              </>
            )}
          </div>
        </div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <div className="main-nav-inner">
            {mainNav.map(([href, label]) => (
              <a
                key={href}
                className={
                  href === "/"
                    ? path === "/"
                      ? "active"
                      : ""
                    : path === href || path.startsWith(href + "/")
                      ? "active"
                      : ""
                }
                href={`#${href}`}
              >
                {label}
              </a>
            ))}
            <span className="nav-sep" />
            {user && !admin && <a href="#/product/new">Đăng bán</a>}
            {admin && <a href="#/admin">Quản trị hệ thống</a>}
            {user && <a href="#/favorites">Yêu thích ({favorites.length})</a>}
          </div>
        </nav>
      </header>}

      <main id="main-content" tabIndex={-1} className={`wrap ${adminArea ? "workspace-wrap" : ""}`}>
        {accountArea && <nav className="account-nav" aria-label="Tài khoản của tôi">{(admin ? [["/admin", "Quản trị"], ["/notifications", "Thông báo"], ["/profile", "Hồ sơ"]] : [["/my-products", "Đăng bán"], ["/my-bids", "Lượt đặt giá"], ["/orders", "Đơn hàng"], ["/notifications", "Thông báo"], ["/profile", "Hồ sơ"]]).map(([href, label]) => <a key={href} href={`#${href}`} aria-current={path === href ? "page" : undefined}>{label}</a>)}</nav>}
        {page}
      </main>

      {!adminArea && <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <a className="brand footer-brand" href="#/">
              Bid<span>Net</span>
            </a>
            <p>
              Khám phá sản phẩm, theo dõi phiên và quản lý giao dịch đấu giá của bạn.
            </p>
          </div>
          <div>
            <strong>Khám phá</strong>
            <a href="#/auctions?status=Active">Đang diễn ra</a>
            <a href="#/auctions?status=Scheduled">Sắp diễn ra</a>
            <a href="#/auctions?status=Active&sort=ending_soon">Sắp kết thúc</a>
            <a href="#/auctions?status=Completed">Đã kết thúc</a>
          </div>
          <div>
            <strong>Hỗ trợ</strong>
            <a href="#/guides">Hướng dẫn & quy trình</a>
            <a href="#/policies">Quy định & chính sách</a>
            <a href="#/guides/quy-tac-dau-gia">Quy tắc đấu giá</a>
            <a href="#/contact">Liên hệ & khiếu nại</a>
          </div>
          <div>
            <strong>Về BidNet</strong>
            <a href="#/about">Giới thiệu</a>
            <a href="#/news">Tin tức</a>
            <a href="#/policies/chinh-sach-bao-mat">Bảo mật</a>
            <a href="#/policies/dieu-khoan-su-dung">Điều khoản</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 BidNet · Đồ án Lập trình Web 2, Đại học Đông Á</span>
          <a href="#/policies">Điều khoản & chính sách</a>
        </div>
      </footer>}

      {authTab && (
        <AuthModal
          tab={authTab}
          onTab={setAuthTab}
          onClose={() => setAuthTab(null)}
          onLogin={login}
        />
      )}
      {toast && (
        <div id="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}

function Gate({ openAuth }) {
  return (
    <div className="panel form-wrap">
      <h1>Vui lòng đăng nhập</h1>
      <p className="muted">Tính năng này cần tài khoản BidNet.</p>
      <button className="btn" onClick={() => openAuth("login")}>
        Đăng nhập
      </button>
    </div>
  );
}
