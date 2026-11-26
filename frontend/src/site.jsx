import React, { useEffect, useState } from "react";
import { api, money, query } from "./api";
import { AuctionCard, useApi, useFavorites } from "./widgets.jsx";
import { about, contact, guides, news, policies } from "./content.js";
import { LotPhoto } from "./Lot.jsx";
import useAuctionUpdates from "./useAuctionUpdates.js";

const categoryIcon = (name = "") => {
  if (/điện tử|công nghệ|máy tính|laptop/i.test(name)) return "⌘";
  if (/đồng hồ|trang sức/i.test(name)) return "◷";
  if (/nghệ thuật|đồ cổ|sưu tầm/i.test(name)) return "✦";
  if (/xe|phụ tùng|ô tô/i.test(name)) return "⚙";
  if (/nhà|đời sống|nội thất/i.test(name)) return "⌂";
  if (/thể thao|du lịch/i.test(name)) return "◈";
  return "◇";
};

const fmtDate = (value) =>
  new Date(value + "T00:00:00").toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

function Section({ title, note, href, children }) {
  return (
    <section className="home-section">
      <div className="home-section-head">
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        {href && (
          <a className="section-link" href={href}>
            Xem tất cả <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
      {children}
    </section>
  );
}

function CardGrid({ items, ids, toggle, loading, error, empty }) {
  if (error) return <div className="notice error">{error}</div>;
  if (loading) return <div className="card-grid-skeleton" aria-label="Đang tải" />;
  if (!items?.length) return <p className="muted">{empty || "Chưa có phiên phù hợp."}</p>;
  return (
    <div className="auction-grid">
      {items.map((item) => (
        <AuctionCard
          key={item.id}
          item={item}
          favorite={ids?.includes(item.id)}
          onFavorite={toggle}
        />
      ))}
    </div>
  );
}

export function Home({ go }) {
  const { ids, toggle } = useFavorites();
  const categories = useApi("/api/Categories");
  const ending = useApi("/api/products?status=Active&sort=ending_soon&page=1&pageSize=4");
  const active = useApi("/api/products?status=Active&sort=newest&page=1&pageSize=8");
  const latest = useApi("/api/products?sort=newest&page=1&pageSize=4");
  const all = useApi("/api/products?page=1&pageSize=1");
  const [draft, setDraft] = useState({ q: "", category: "" });
  const search = (event) => {
    event.preventDefault();
    go(`/auctions?${query({ q: draft.q.trim(), category: draft.category, status: "Active", sort: "ending_soon" })}`);
  };
  const total = all.data?.totalCount || 0;
  const activeTotal = active.data?.totalCount || 0;
  return (
    <>
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">Sàn đấu giá trực tuyến · Auctora</span>
          <h1>Mỗi lượt giá đều minh bạch, mỗi phiên đều có người theo dõi.</h1>
          <p>
            Khám phá phiên đang diễn ra, theo dõi thời gian kết thúc và đặt giá với quy tắc
            bước giá rõ ràng. Người bán không thể tự nâng giá sản phẩm của mình.
          </p>
          <form className="hero-search" onSubmit={search} role="search">
            <input
              type="search"
              name="q"
              placeholder="Tìm sản phẩm, ví dụ: iPhone, laptop, đồng hồ…"
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              aria-label="Từ khóa sản phẩm"
            />
            <select
              name="category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              aria-label="Danh mục"
            >
              <option value="">Tất cả danh mục</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="btn dark" type="submit">
              Tìm phiên
            </button>
          </form>
          <div className="hero-stats">
            <div>
              <strong>{total}</strong>
              <span>phiên đã tạo</span>
            </div>
            <div>
              <strong>{activeTotal}</strong>
              <span>phiên đang mở</span>
            </div>
            <div>
              <strong>1.000 ₫</strong>
              <span>bước giá tối thiểu</span>
            </div>
          </div>
        </div>
        <div className="home-hero-art">
          <div className="hero-art-card">
            <span>Phiên nổi bật</span>
            {ending.data?.items?.[0] ? (
              <>
                <LotPhoto item={ending.data.items[0]} priority />
                <b>{ending.data.items[0].name}</b>
                <strong>{money(ending.data.items[0].currentPrice)}</strong>
                <a href={`#/product/${ending.data.items[0].id}`}>Xem phiên ↗</a>
              </>
            ) : (
              <p>Đang cập nhật phiên sắp kết thúc…</p>
            )}
          </div>
        </div>
      </section>

      <Section title="Danh mục sản phẩm" note="Chọn nhóm sản phẩm để thu hẹp danh sách phiên." href="#/auctions">
        {categories.loading ? (
          <div className="category-grid-skeleton" />
        ) : categories.error ? (
          <div className="notice error">{categories.error}</div>
        ) : (
          <div className="category-grid">
            {categories.data?.map((category) => (
              <a
                key={category.id}
                className="category-tile"
                href={`#/auctions?category=${encodeURIComponent(category.name)}`}
              >
                <span className="category-icon" aria-hidden="true">
                  {categoryIcon(category.name)}
                </span>
                <span>
                  <b>{category.name}</b>
                  <small>{category.productCount ?? 0} phiên</small>
                </span>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Sắp kết thúc"
        note="Các phiên đang mở có thời điểm kết thúc gần nhất."
        href="#/auctions?status=Active&sort=ending_soon"
      >
        <CardGrid
          items={ending.data?.items}
          ids={ids}
          toggle={toggle}
          loading={ending.loading}
          error={ending.error}
          empty="Hiện chưa có phiên đang mở."
        />
      </Section>

      <Section
        title="Đang diễn ra"
        note="Đặt giá ngay khi phiên còn thời gian."
        href="#/auctions?status=Active"
      >
        <CardGrid
          items={active.data?.items}
          ids={ids}
          toggle={toggle}
          loading={active.loading}
          error={active.error}
          empty="Chưa có phiên đang diễn ra."
        />
      </Section>

      <Section title="Tin tức & thông báo" note="Hướng dẫn và cập nhật mới từ Auctora." href="#/news">
        <div className="news-grid">
          {news.slice(0, 3).map((article) => (
            <a className="news-card" key={article.slug} href={`#/news/${article.slug}`}>
              <span className="news-cat">{article.category}</span>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <small>
                {fmtDate(article.date)} · {article.read} phút đọc
              </small>
            </a>
          ))}
        </div>
      </Section>

      <Section
        title="Mới cập nhật"
        note="Những phiên vừa được đăng hoặc điều chỉnh."
        href="#/auctions?sort=newest"
      >
        <CardGrid
          items={latest.data?.items}
          ids={ids}
          toggle={toggle}
          loading={latest.loading}
          error={latest.error}
        />
      </Section>

      <section className="how-it-works">
        <div>
          <span className="eyebrow">Quy trình</span>
          <h2>Bốn bước từ đăng bán đến chốt đơn</h2>
          <p className="muted">
            Mỗi bước đều có kiểm tra quyền và trạng thái ở phía máy chủ, không chỉ ở giao diện.
          </p>
        </div>
        <ol>
          {[
            ["Tạo tài khoản", "Đăng ký, đăng nhập và cập nhật hồ sơ."],
            ["Đăng phiên", "Chọn danh mục, giá khởi điểm và lịch mở/đóng."],
            ["Đặt giá", "Lượt giá hợp lệ được ghi và cập nhật realtime."],
            ["Chốt đơn", "Hết phiên, người thắng nhận đơn chờ xử lý."],
          ].map(([title, detail], index) => (
            <li key={title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <strong>{title}</strong>
              <span>{detail}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function ArticleBody({ blocks }) {
  return (
    <div className="article-body">
      {blocks.map(([type, text], index) =>
        type === "h" ? <h2 key={index}>{text}</h2> : <p key={index}>{text}</p>,
      )}
    </div>
  );
}

export function NewsPage({ slug }) {
  const [category, setCategory] = useState("Tất cả");
  const article = slug ? news.find((item) => item.slug === slug) : null;
  if (slug) {
    if (!article)
      return (
        <div className="empty">
          <h1>Không tìm thấy bài viết</h1>
          <a className="btn secondary" href="#/news">
            Về trang tin tức
          </a>
        </div>
      );
    return (
      <article className="article">
        <nav className="breadcrumb" aria-label="Đường dẫn">
          <a href="#/">Trang chủ</a>
          <span>/</span>
          <a href="#/news">Tin tức</a>
          <span>/</span>
          <b>{article.category}</b>
        </nav>
        <span className="news-cat">{article.category}</span>
        <h1>{article.title}</h1>
        <p className="article-meta">
          {fmtDate(article.date)} · {article.read} phút đọc · Auctora
        </p>
        <p className="article-lead">{article.excerpt}</p>
        <ArticleBody blocks={article.body} />
        <div className="article-foot">
          <a className="btn secondary" href="#/news">
            ← Danh sách tin tức
          </a>
          <a className="btn dark" href="#/auctions">
            Xem các phiên đang mở
          </a>
        </div>
      </article>
    );
  }
  const tabs = ["Tất cả", ...new Set(news.map((item) => item.category))];
  const list = category === "Tất cả" ? news : news.filter((item) => item.category === category);
  const featured = list[0];
  /* Bài nổi bật đã hiển thị riêng phía trên, không lặp lại trong lưới. */
  const rest = list.filter((article) => article.slug !== featured?.slug);
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Tin tức & thông báo</span>
          <h1>Cập nhật từ sàn đấu giá</h1>
          <p>Hướng dẫn, kinh nghiệm và thông báo vận hành do Auctora biên soạn.</p>
        </div>
      </div>
      <div className="status-tabs" role="tablist" aria-label="Lọc tin tức">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={category === tab}
            aria-pressed={category === tab}
            onClick={() => setCategory(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      {featured && (
        <a className="news-feature" href={`#/news/${featured.slug}`}>
          <div>
            <span className="news-cat">{featured.category}</span>
            <h2>{featured.title}</h2>
            <p>{featured.excerpt}</p>
            <small>
              {fmtDate(featured.date)} · {featured.read} phút đọc
            </small>
          </div>
          <span aria-hidden="true">↗</span>
        </a>
      )}
      <div className="news-grid wide">
        {rest.map((article) => (
          <a className="news-card" key={article.slug} href={`#/news/${article.slug}`}>
            <span className="news-cat">{article.category}</span>
            <h3>{article.title}</h3>
            <p>{article.excerpt}</p>
            <small>
              {fmtDate(article.date)} · {article.read} phút đọc
            </small>
          </a>
        ))}
      </div>
    </>
  );
}

export function DocPage({ section, slug }) {
  const isGuides = section === "guides";
  const items = isGuides ? guides : policies;
  const label = isGuides ? "Hướng dẫn & quy trình" : "Quy định & chính sách";
  const item = slug ? items.find((entry) => entry.slug === slug) : null;
  if (slug) {
    if (!item)
      return (
        <div className="empty">
          <h1>Không tìm thấy nội dung</h1>
          <a className="btn secondary" href={`#/${section}`}>
            ← {label}
          </a>
        </div>
      );
    return (
      <article className="article">
        <nav className="breadcrumb" aria-label="Đường dẫn">
          <a href="#/">Trang chủ</a>
          <span>/</span>
          <a href={`#/${section}`}>{label}</a>
          <span>/</span>
          <b>{item.title}</b>
        </nav>
        <span className="eyebrow">{label}</span>
        <h1>{item.title}</h1>
        <ArticleBody blocks={item.body} />
        <div className="article-foot">
          <a className="btn secondary" href={`#/${section}`}>
            ← Danh sách
          </a>
          <a className="btn dark" href="#/contact">
            Liên hệ hỗ trợ
          </a>
        </div>
      </article>
    );
  }
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{label}</span>
          <h1>{isGuides ? "Bắt đầu đấu giá đúng cách" : "Minh bạch trước và sau giao dịch"}</h1>
          <p>
            {isGuides
              ? "Các bước thao tác trên Auctora, viết cho người mua và người bán mới."
              : "Điều khoản, bảo mật, phí và quy trình xử lý khiếu nại."}
          </p>
        </div>
      </div>
      <div className="doc-list">
        {items.map((entry, index) => (
          <a key={entry.slug} href={`#/${section}/${entry.slug}`}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>
              <strong>{entry.title}</strong>
              <small>{entry.excerpt || entry.body[0][1]}</small>
            </span>
            <i aria-hidden="true">→</i>
          </a>
        ))}
      </div>
    </>
  );
}

export function AboutPage() {
  return (
    <>
      <section className="about-hero">
        <span className="eyebrow">Giới thiệu</span>
        <h1>{about.title}</h1>
        <p>{about.intro}</p>
      </section>
      <div className="about-grid">
        {about.sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
      </div>
      <section className="cta-band">
        <div>
          <h2>Sẵn sàng theo dõi phiên đầu tiên?</h2>
          <p>Khám phá danh sách đang mở hoặc tạo tài khoản để đặt giá.</p>
        </div>
        <a className="btn dark" href="#/auctions">
          Xem phiên đấu giá
        </a>
      </section>
    </>
  );
}

export function ContactPage({ user, go }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function send(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true); setError(""); setSent(false);
    try {
      const fields = Object.fromEntries(new FormData(form));
      const ticket = await api("/api/support", { method: "POST", body: JSON.stringify({ message: fields.message, subject: fields.subject, orderId: fields.orderId ? Number(fields.orderId) : null, productId: fields.productId ? Number(fields.productId) : null }) });
      form.reset(); setSent(ticket.id);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Liên hệ & hỗ trợ</span>
          <h1>Chúng tôi có thể giúp gì?</h1>
          <p>Chọn đúng kênh để yêu cầu của bạn được xử lý nhanh hơn.</p>
        </div>
      </div>
      <div className="contact-grid">
        <div className="contact-card">
          <h2>Hỗ trợ trên Auctora</h2>
          <p>Đăng nhập và gửi yêu cầu trực tiếp tới quản trị viên bằng biểu mẫu bên dưới.</p>
          <p className="muted small">Nêu mã phiên hoặc mã đơn hàng để quản trị viên tra cứu. Yêu cầu được lưu trong hệ thống; đây không phải kênh email tự động.</p>
        </div>
        <div className="contact-card">
          <h2>Kênh hỗ trợ</h2>
          <div className="contact-channels">
            {contact.channels.map(([title, detail]) => (
              <div key={title}>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <section className="contact-form-panel">
        <h2>Gửi yêu cầu</h2>
        {user && <a className="btn secondary" href={user.role === "Admin" ? "#/admin/support" : "#/support"}>Theo dõi yêu cầu hỗ trợ</a>}
        <p className="muted">
          Yêu cầu được gửi kèm tài khoản và email của bạn để quản trị viên liên hệ.
        </p>
        {!user ? <button className="btn" onClick={() => go("/login?returnTo=%2Fcontact")}>Đăng nhập để gửi yêu cầu</button> : user.role === "Admin" ? <a className="btn" href="#/notifications">Xem yêu cầu trong thông báo</a> : <form onSubmit={send}>
          <label>Tiêu đề<input name="subject" maxLength={160} required disabled={busy} /></label>
          <label>Mã đơn hàng (nếu có)<input name="orderId" type="number" min="1" defaultValue={new URLSearchParams(location.hash.split("?")[1]).get("orderId") || ""} disabled={busy} /></label>
          <label>Mã phiên (nếu có)<input name="productId" type="number" min="1" disabled={busy} /></label>
          <label>
            Nội dung
            <textarea name="message" rows={5} required maxLength={700} disabled={busy} />
          </label>
          {error && <p className="notice error" role="alert">{error}</p>}
          {sent && <p className="notice" role="status">Đã tạo yêu cầu #{sent}. <a href={`#/support/${sent}`}>Xem trao đổi</a></p>}
          <button className="btn dark" type="submit" disabled={busy}>
            {busy ? "Đang gửi…" : "Gửi yêu cầu"}
          </button>
        </form>}
      </section>
    </>
  );
}

export function FavoritesPage({ go }) {
  const { ids, toggle } = useFavorites();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setError("");
    setItems(null);
    if (!ids.length) {
      setItems([]);
      return;
    }
    Promise.all(ids.map((id) => api(`/api/products/${id}`).catch((e) => { if (e.status === 404) return null; throw e; }))).then(
      (result) => {
        if (alive) setItems(result.filter(Boolean));
      },
      (e) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [ids.join(",")]);
  const liveError = useAuctionUpdates(
    (items || []).map((item) => item.id),
    (event) => {
      setItems((current) => current?.map((item) => item.id === event.productId
        ? {
            ...item,
            currentPrice: event.currentPrice,
            bidCount: event.bidCount,
            leadingBidderName: event.bidderName,
          }
        : item));
    },
  );
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Phiên đang theo dõi</span>
          <h1>Danh sách yêu thích</h1>
          <p>
            Danh sách được lưu trên trình duyệt này. Đăng nhập trên thiết bị khác sẽ không
            tự đồng bộ vì backend chưa có API yêu thích.
          </p>
        </div>
        <a className="btn secondary" href="#/auctions">
          Tìm thêm phiên
        </a>
      </div>
      {error && <div className="notice error">{error}</div>}
      {liveError && <p className="muted small" role="status">Cập nhật giá trực tiếp tạm thời không khả dụng.</p>}
      {!items ? (
        <div className="card-grid-skeleton" />
      ) : items.length ? (
        <div className="auction-grid">
          {items.map((item) => (
            <AuctionCard key={item.id} item={item} favorite onFavorite={toggle} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <p>Bạn chưa theo dõi phiên nào.</p>
          <button className="btn dark" onClick={() => go("/auctions")}>
            Khám phá phiên đấu giá
          </button>
        </div>
      )}
    </>
  );
}
