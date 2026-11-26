import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as signalR from "@microsoft/signalr";
import { api, API_BASE, getSession, setSession } from "./api";
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
import { LiveEventsPage, LiveEventPage, LiveRoomPage, SellerLiveRequests } from "./Live.jsx";
import "./live.css";
import SupportWidget from "./SupportWidget.jsx";

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
  ["/live-auctions", "Đấu giá trực tiếp"],
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
  const [liveCatalog, setLiveCatalog] = useState({ live: null, upcoming: null, loading: true, error: "" });
  const [scrollState, setScrollState] = useState({ scrolled: false, compact: false, backTop: false });
  const compactRef = useRef(false);
  const backTopRef = useRef(false);
  const scrollFrame = useRef(0);
  const accountMenuRef = useRef(null);
  const { ids: favorites } = useFavorites();
  const [path] = route.split("?");
  const routeRef = useRef(route);
  routeRef.current = route;
  // Phòng live mở trong cửa sổ riêng nên ẩn header/footer của website chính.
  const immersive = path.startsWith("/live-room/");
  useEffect(() => {
    document.body.classList.toggle("live-room-mode", immersive);
    return () => document.body.classList.remove("live-room-mode");
  }, [immersive]);
  useEffect(() => {
    const onScroll = () => {
      if (scrollFrame.current) return;
      scrollFrame.current = requestAnimationFrame(() => {
        scrollFrame.current = 0;
        const y = window.scrollY;
        const compactExitThreshold = 120;
        const compactEntryThreshold = 450;
        // Keep hysteresis wider than the header's height change to avoid anchor-scroll oscillation.
        const compact = compactRef.current
          ? y > compactExitThreshold
          : y > compactEntryThreshold;
        const backTop = backTopRef.current ? y > 340 : y > 400;
        compactRef.current = compact;
        backTopRef.current = backTop;
        setScrollState((prev) => prev.scrolled === compact &&
          prev.compact === compact && prev.backTop === backTop
          ? prev
          : { scrolled: compact, compact, backTop });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current);
    };
  }, []);
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
    const closeOnOutsidePointer = (event) => {
      const menu = accountMenuRef.current;
      if (menu?.open && !menu.contains(event.target)) menu.open = false;
    };
    const closeOnEscape = (event) => {
      const menu = accountMenuRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  useEffect(() => {
    // Mở thẳng /login hoặc /register vẫn giữ URL sạch sau khi modal bật.
    if (boot) history.replaceState(null, "", `#${boot.base || "/"}`);
  }, []);
  useEffect(() => {
    api("/api/Categories").then(setCategories, () => setCategories([]));
  }, []);
  useEffect(() => {
    let active = true;
    let refreshVersion = 0;
    const refresh = async () => {
      const version = ++refreshVersion;
      try {
        const [live, upcoming] = await Promise.all([
          api("/api/live/events?status=Live"),
          api("/api/live/events?status=Published"),
        ]);
        if (!active || version !== refreshVersion) return;
        setLiveCatalog({ live, upcoming, loading: false, error: "" });
      } catch (error) {
        if (!active || version !== refreshVersion) return;
        setLiveCatalog((current) => ({ ...current, loading: false, error: error.message }));
      }
    };

    refresh();
    const timer = setInterval(refresh, 30000);
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/live`, { accessTokenFactory: () => getSession()?.accessToken || "" })
      .withAutomaticReconnect()
      .build();
    connection.on("LiveCatalogChanged", refresh);
    connection.onreconnected(async () => {
      try {
        await connection.invoke("JoinLobby");
        await refresh();
      } catch {
        if (active) refresh();
      }
    });
    connection.start()
      .then(() => connection.invoke("JoinLobby"))
      .then(refresh)
      .catch(() => {
        // Polling remains active when realtime is unavailable.
      });

    return () => {
      active = false;
      clearInterval(timer);
      connection.stop();
    };
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
    addEventListener("Auctora:expired", expired);
    return () => removeEventListener("Auctora:expired", expired);
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
  const accountArea = user && ["/my-products", "/my-live-requests", "/my-bids", "/orders", "/notifications", "/profile"].includes(path);
  const common = { go, notify, user, admin, openAuth: setAuthTab };
  const submitSearch = (event) => {
    event.preventDefault();
    go(`/auctions?q=${encodeURIComponent(search.trim())}`);
  };
  let page;
  if (path === "/") page = <MarketplaceHome {...common} liveCatalog={liveCatalog} />;
  else if (path === "/auctions" || path === "/products")
    page = <Explore key={route} route={route} {...common} />;
  else if (/^\/product\/\d+$/.test(path))
    page = <Product key={route} id={Number(path.split("/")[2])} {...common} />;
  else if (path === "/live-auctions")
    page = <LiveEventsPage key={route} {...common} />;
  else if (/^\/live-auctions\/\d+$/.test(path))
    page = <LiveEventPage key={route} id={Number(path.split("/")[2])} {...common} />;
  else if (/^\/live-room\/\d+$/.test(path))
    page = <LiveRoomPage key={route} id={Number(path.split("/")[2])} {...common} />;
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
  else if (!user && (/^\/(my-products|my-live-requests|my-bids|orders|notifications|profile|admin)(\/|$)/.test(path) || path === "/product/new" || /^\/(product\/\d+\/edit|order\/\d+)$/.test(path))) page = <Gate openAuth={setAuthTab} />;
  else if (admin && (path === "/product/new" || path === "/my-products" || path === "/my-live-requests" || path === "/my-bids" || /^\/product\/\d+\/edit$/.test(path)))
    page = <section className="empty"><h1>Chức năng dành cho thành viên</h1><p>Admin quản lý hệ thống, không tham gia đăng bán hoặc đặt giá.</p><a className="btn" href="#/admin">Về quản trị</a></section>;
  else if (path === "/my-products") page = <MyProducts {...common} />;
  else if (path === "/my-live-requests") page = <SellerLiveRequests {...common} />;
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
      {adminArea ? <header className="workspace-top"><a className="brand" href="#/admin">Auc<span>tora</span><small>WORKSPACE</small></a><div className="workspace-top-actions"><a href="#/">Xem sàn đấu giá ↗</a><ThemeToggle /><a href="#/profile" className="workspace-identity"><Avatar user={user} /><span>{user.fullName || user.username}<small>Quản trị viên</small></span></a><button className="btn secondary" onClick={logout}>Đăng xuất</button></div></header> : <div className={`sticky-top-shell ${scrollState.scrolled ? "is-scrolled" : ""} ${scrollState.compact ? "is-compact" : ""}`}><header className={`top ${scrollState.scrolled ? "is-scrolled" : ""} ${scrollState.compact ? "is-compact" : ""}`}>
        <div className="top-bar">
          <div className="top-bar-inner">
            <span>Auctora · Sàn đấu giá trực tuyến</span>
            <span className="top-bar-right">
              <ThemeToggle />
            </span>
          </div>
        </div>
        <div className="top-inner">
          <a className="brand" aria-label="Auctora – Trang chủ" href="#/">
            Auc<span>tora</span>
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
              <span aria-hidden="true">☰</span> <span className="cat-label">Danh mục</span>
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
            {user && !admin && (
              <a className="btn dark compact-sell-btn" href="#/product/new">
                + Đăng bán
              </a>
            )}
            <a className="fav-link" href="#/favorites" title="Phiên đang theo dõi">
              <span aria-hidden="true">♡</span>
              <em>{favorites.length}</em>
            </a>
            {user ? (
              <details className="account-menu" ref={accountMenuRef}>
                <summary>
                  <Avatar user={user} />
                  <span>{user.fullName || user.username}</span>
                </summary>
                <div
                  className="account-panel"
                  onClick={(event) => {
                    if (event.target.closest?.("a, button") && accountMenuRef.current) {
                      accountMenuRef.current.open = false;
                    }
                  }}
                >
                  {!admin && <><a href="#/my-products">Sản phẩm của tôi</a>
                  <a href="#/my-live-requests">Yêu cầu đấu giá trực tiếp</a>
                  <a href="#/my-bids">Đấu giá của tôi</a>
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
                {href === "/live-auctions" ? (
                  <>
                    {label}
                    {liveCatalog.live?.length > 0 && (
                      <span className="nav-live-badge" aria-label={`${liveCatalog.live.length} sự kiện đang LIVE`}>
                        <i aria-hidden="true" /> LIVE{liveCatalog.live.length > 1 ? ` ${liveCatalog.live.length}` : ""}
                      </span>
                    )}
                    {liveCatalog.error && !liveCatalog.live && (
                      <span className="nav-live-error" title={liveCatalog.error} aria-label="Không tải được trạng thái Live Auction">!</span>
                    )}
                  </>
                ) : label}
              </a>
            ))}
            <span className="nav-sep" />
            {user && !admin && <a href="#/product/new">Đăng bán</a>}
            {admin && <a href="#/admin">Quản trị hệ thống</a>}
            {user && <a href="#/favorites">Yêu thích ({favorites.length})</a>}
          </div>
        </nav>
      </header>
      {accountArea && (
        <div className="account-nav-bar">
          <nav className="account-nav" aria-label="Tài khoản của tôi">
            {(admin ? [["/admin", "Quản trị"], ["/notifications", "Thông báo"], ["/profile", "Hồ sơ"]] : [["/my-products", "Sản phẩm"], ["/my-live-requests", "Yêu cầu Live"], ["/my-bids", "Đấu giá của tôi"], ["/orders", "Đơn hàng"], ["/notifications", "Thông báo"], ["/profile", "Hồ sơ"]]).map(([href, label]) => (
              <a key={href} href={`#${href}`} aria-current={path === href ? "page" : undefined}>{label}</a>
            ))}
          </nav>
        </div>
      )}
      </div>}

      <main id="main-content" tabIndex={-1} className={`wrap ${adminArea ? "workspace-wrap" : ""}`}>
        {page}
      </main>

      {!adminArea && <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <a className="brand footer-brand" href="#/">
              Auc<span>tora</span>
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
            <strong>Về Auctora</strong>
            <a href="#/about">Giới thiệu</a>
            <a href="#/news">Tin tức</a>
            <a href="#/policies/chinh-sach-bao-mat">Bảo mật</a>
            <a href="#/policies/dieu-khoan-su-dung">Điều khoản</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Auctora · Đồ án Lập trình Web 2, Đại học Đông Á</span>
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
      {!adminArea && scrollState.backTop && (
        <button
          type="button"
          className="back-to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Lên đầu trang"
          title="Lên đầu trang"
        >
          ↑
        </button>
      )}
      {!adminArea && (
        <SupportWidget
          route={route}
          user={user}
          go={go}
          openAuth={setAuthTab}
          notify={notify}
        />
      )}
    </>
  );
}

function Gate({ openAuth }) {
  return (
    <div className="panel form-wrap">
      <h1>Vui lòng đăng nhập</h1>
      <p className="muted">Tính năng này cần tài khoản Auctora.</p>
      <button className="btn" onClick={() => openAuth("login")}>
        Đăng nhập
      </button>
    </div>
  );
}
