import React, { useEffect, useState } from "react";
import { AuctionCard, Countdown, useApi, useFavorites } from "./widgets.jsx";
import { LotPhoto } from "./Lot.jsx";
import { date, money, parseApiDate } from "./api";
import { openLiveRoom } from "./Live.jsx";

function Lots({ title, path, href, ids, toggle }) {
  const result = useApi(path);
  return <section className="market-section">
    <header><h2>{title}</h2><a href={href}>Xem tất cả →</a></header>
    {result.loading ? <div className="market-skeleton" role="status">Đang tải phiên đấu giá…</div> :
      result.error ? <p className="notice error" role="alert">{result.error}</p> :
      result.data?.items?.length ? <div className="auction-grid">{result.data.items.map(item =>
        <AuctionCard key={item.id} item={item} favorite={ids.includes(item.id)} onFavorite={toggle}/>)}</div> :
      <p className="empty">Chưa có phiên trong nhóm này.</p>}
  </section>;
}

function LiveNoticeStrip({ event, go, notify }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [event?.id]);
  if (!event || dismissed) return null;

  return (
    <aside className="live-home-notice" role="status">
      <span className="live-home-notice-label"><i aria-hidden="true" /> ĐANG LIVE</span>
      <a className="live-home-notice-title" href={`#/live-auctions/${event.id}`}>{event.title}</a>
      <span className="live-home-notice-fact">{event.viewerCount ?? "—"} đang xem</span>
      {event.currentLotNumber > 0 && (
        <span className="live-home-notice-fact">Lô {event.currentLotNumber}/{event.lotCount}</span>
      )}
      <button className="btn dark" type="button" onClick={() => openLiveRoom(event.id, go, notify)}>
        Vào phòng đấu giá
      </button>
      <button className="live-home-notice-close" type="button" aria-label="Ẩn thông báo Live Auction" onClick={() => setDismissed(true)}>×</button>
    </aside>
  );
}

function HomeLiveCard({ event, live, go, notify }) {
  const image = live ? event.currentLotImageUrl || event.bannerUrl : event.bannerUrl;
  return (
    <article className="home-live-card">
      <a className="home-live-card-image" href={`#/live-auctions/${event.id}`}>
        {image ? <img src={image} alt="" loading="lazy" /> : <span>Auctora Live</span>}
        <span className={`home-live-status${live ? " is-live" : ""}`}>
          {live && <i aria-hidden="true" />}
          {live ? "LIVE" : "Sắp diễn ra"}
        </span>
      </a>
      <div className="home-live-card-body">
        <h3><a href={`#/live-auctions/${event.id}`}>{event.title}</a></h3>
        <p className="home-live-organizer">Auctora · Auctioneer {event.auctioneerName || "đang cập nhật"}</p>
        {live ? (
          <>
            <div className="home-live-current-lot">
              <span>{event.currentLotNumber > 0 ? `Đang đấu giá · Lô ${String(event.currentLotNumber).padStart(3, "0")}` : "Đang chờ mở lô tiếp theo"}</span>
              {event.currentLotTitle && <b>{event.currentLotTitle}</b>}
              {event.currentLotPrice != null && <strong>{money(event.currentLotPrice)}</strong>}
            </div>
            <div className="home-live-card-facts">
              <span>{event.currentLotNumber || event.soldCount}/{event.lotCount} lô</span>
              <span>{event.viewerCount ?? "—"} đang xem</span>
            </div>
          </>
        ) : (
          <div className="home-live-card-facts">
            <span>{date(event.scheduledStartAt)}</span>
            <span>{event.lotCount} lô sản phẩm</span>
          </div>
        )}
        <div className="home-live-card-actions">
          {live ? (
            <button type="button" className="btn dark" onClick={() => openLiveRoom(event.id, go, notify)}>Vào phòng LIVE ↗</button>
          ) : (
            <a className="btn dark" href={`#/live-auctions/${event.id}`}>Xem sự kiện</a>
          )}
          {live && <a className="btn secondary" href={`#/live-auctions/${event.id}`}>Danh sách lô</a>}
        </div>
      </div>
    </article>
  );
}

function HomeLiveSections({ liveEvents, upcomingEvents, catalogError, go, notify }) {
  if (catalogError && !liveEvents.length && !upcomingEvents.length)
    return <p className="notice error home-live-error" role="alert">Không tải được sự kiện Live Auction: {catalogError}</p>;

  return (
    <>
      {liveEvents.length > 0 && (
        <section className="home-live-section" aria-labelledby="home-live-heading">
          <header className="home-live-section-heading">
            <div>
              <h2 id="home-live-heading">Đấu giá trực tiếp đang diễn ra</h2>
              <p>Theo dõi sự kiện đang được tổ chức trên Auctora.</p>
            </div>
            <a href="#/live-auctions?status=Live">Xem tất cả →</a>
          </header>
          <div className="home-live-grid">
            {liveEvents.slice(0, 3).map((event) => <HomeLiveCard key={event.id} event={event} live go={go} notify={notify} />)}
          </div>
        </section>
      )}
      {upcomingEvents.length > 0 && (
        <section className="home-live-section" aria-labelledby="home-upcoming-heading">
          <header className="home-live-section-heading">
            <div>
              <h2 id="home-upcoming-heading">Đấu giá trực tiếp sắp diễn ra</h2>
              <p>Chuẩn bị tham gia các sự kiện đã được công bố.</p>
            </div>
            <a href="#/live-auctions?status=Published">Xem tất cả →</a>
          </header>
          <div className="home-live-grid">
            {upcomingEvents.slice(0, 3).map((event) => <HomeLiveCard key={event.id} event={event} live={false} go={go} notify={notify} />)}
          </div>
        </section>
      )}
    </>
  );
}

export default function MarketplaceHome({ admin, liveCatalog, go, notify }) {
  const categories = useApi("/api/Categories");
  const featured = useApi("/api/products?status=Active&sort=most_bids&pageSize=1");
  const { ids, toggle } = useFavorites();
  const item = featured.data?.items?.[0];
  const liveEvents = liveCatalog?.live || [];
  const upcomingEvents = [...(liveCatalog?.upcoming || [])]
    .sort((a, b) => parseApiDate(a.scheduledStartAt) - parseApiDate(b.scheduledStartAt));
  const topLive = liveEvents[0];
  const topUpcoming = upcomingEvents[0];
  const slides = [
    ...(topLive ? [{ type: "live", event: topLive }] : []),
    ...(item ? [{ type: "featured", item }] : []),
    ...(topUpcoming ? [{ type: "upcoming", event: topUpcoming }] : []),
  ];
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => setSlideIndex(0), [topLive?.id, item?.id, topUpcoming?.id]);
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = setInterval(() => setSlideIndex((current) => (current + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[slideIndex] || slides[0] || { type: "empty" };
  const slideTitle = slide.type === "live" ? slide.event.title
    : slide.type === "upcoming" ? slide.event.title
      : slide.type === "featured" ? slide.item.name : "Khám phá phiên đấu giá";
  const slideImage = slide.type === "live" ? slide.event.bannerUrl || slide.event.currentLotImageUrl
    : slide.type === "upcoming" ? slide.event.bannerUrl : null;

  return <>
    <LiveNoticeStrip event={topLive} go={go} notify={notify} />
    <div className="market-intro">
      <aside className="market-categories">
        <h2>Danh mục sản phẩm</h2>
        {categories.loading && <p role="status">Đang tải danh mục…</p>}
        {categories.error && <p role="alert">{categories.error}</p>}
        {categories.data?.map((category, index) => <a key={category.id} href={`#/auctions?category=${encodeURIComponent(category.name)}`}>
          <span className="category-number">{String(index + 1).padStart(2, "0")}</span>
          <span>{category.name}</span><span aria-hidden="true">›</span>
        </a>)}
        <a className="all-categories" href="#/auctions">Tất cả phiên đấu giá →</a>
      </aside>
      <section className={`market-banner${slide.type === "live" ? " is-live-slide" : ""}`}>
        <div className="market-banner-copy">
          <span className={`eyebrow${slide.type === "live" ? " live-slide-label" : ""}`}>
            {slide.type === "live" ? "● LIVE AUCTION" : slide.type === "upcoming" ? "SẮP DIỄN RA" : "PHIÊN ĐƯỢC QUAN TÂM"}
          </span>
          <h1>{slideTitle}</h1>
          {slide.type === "live" ? (
            <>
              <p>Đơn vị tổ chức: Auctora · Auctioneer {slide.event.auctioneerName || "đang cập nhật"}</p>
              <div className="featured-price">
                <small>{slide.event.currentLotTitle ? `Lô ${slide.event.currentLotNumber} · ${slide.event.currentLotTitle}` : "Tiến độ sự kiện"}</small>
                <strong>{slide.event.currentLotPrice != null ? money(slide.event.currentLotPrice) : `${slide.event.currentLotNumber || slide.event.soldCount}/${slide.event.lotCount} lô`}</strong>
              </div>
              <div className="home-live-hero-facts">
                <span>{slide.event.currentLotNumber || slide.event.soldCount}/{slide.event.lotCount} lô</span>
                <span>{slide.event.viewerCount ?? "—"} người đang xem</span>
              </div>
            </>
          ) : slide.type === "upcoming" ? (
            <>
              <p>Sự kiện đấu giá trực tiếp do Auctora tổ chức.</p>
              <div className="featured-price"><small>Thời gian dự kiến</small><strong className="home-live-date">{date(slide.event.scheduledStartAt)}</strong></div>
              <div className="home-live-hero-facts"><span>{slide.event.lotCount} lô sản phẩm</span></div>
            </>
          ) : slide.type === "featured" ? (
            <>
              <p>{slide.item.category}</p>
              <div className="featured-price"><small>Giá hiện tại</small><strong>{money(slide.item.currentPrice)}</strong></div>
              <div className="featured-time"><Countdown item={slide.item} compact /></div>
            </>
          ) : <p>Xem sản phẩm và thời gian mở phiên.</p>}
          {slides.length > 1 && (
            <div className="market-banner-tabs" role="tablist" aria-label="Nội dung nổi bật">
              {slides.map((option, index) => (
                <button key={`${option.type}-${option.event?.id || option.item?.id}`} type="button" role="tab" aria-selected={slideIndex === index} onClick={() => setSlideIndex(index)}>
                  {option.type === "live" ? "Đang LIVE" : option.type === "upcoming" ? "Sắp diễn ra" : "Phiên nổi bật"}
                </button>
              ))}
            </div>
          )}
          {slide.type === "live" ? (
            <button className="btn dark" type="button" onClick={() => openLiveRoom(slide.event.id, go, notify)}>Vào phòng đấu giá trực tiếp ↗</button>
          ) : (
            <a href={slide.type === "upcoming" ? `#/live-auctions/${slide.event.id}` : slide.type === "featured" ? `#/product/${slide.item.id}` : "#/auctions"} className="btn dark">
              {slide.type === "upcoming" ? "Xem sự kiện" : slide.type === "featured" ? "Xem phiên đấu giá" : "Xem các phiên"} <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
        {slide.type === "featured" ? (
          <a className="market-feature" href={`#/product/${slide.item.id}`}><LotPhoto item={slide.item} priority /></a>
        ) : slideImage ? (
          <a className="market-feature home-live-hero-image" href={`#/live-auctions/${slide.event.id}`}>
            <img src={slideImage} alt={slide.event.currentLotTitle || slide.event.title} />
            {slide.type === "live" && <span className="home-live-image-badge"><i aria-hidden="true" /> LIVE · {slide.event.viewerCount ?? "—"} đang xem</span>}
          </a>
        ) : (
          <div className="market-feature home-live-hero-placeholder" aria-hidden="true">
            <span>{slide.type === "live" ? "● LIVE" : slide.type === "upcoming" ? "SẮP DIỄN RA" : "Auctora"}</span>
            <strong>{slide.type === "live" ? `${slide.event.currentLotNumber || slide.event.soldCount}/${slide.event.lotCount} lô` : "Auctora Live Auction"}</strong>
          </div>
        )}
      </section>
    </div>
    <HomeLiveSections liveEvents={liveEvents} upcomingEvents={upcomingEvents} catalogError={liveCatalog?.error} go={go} notify={notify} />
    <nav className="market-shortcuts" aria-label="Khám phá phiên">
      <a href="#/auctions?status=Active&sort=ending_soon"><b>Sắp kết thúc</b><span>Theo dõi những phút cuối →</span></a>
      <a href="#/auctions?status=Active&sort=most_bids"><b>Nhiều lượt đặt giá</b><span>Phiên đang được quan tâm →</span></a>
      <a href="#/auctions?status=Scheduled"><b>Sắp diễn ra</b><span>Chuẩn bị cho phiên tiếp theo →</span></a>
      <a href="#/guides"><b>Lần đầu đấu giá?</b><span>Tìm hiểu cách tham gia →</span></a>
    </nav>
    <Lots title="Phiên sắp kết thúc" path="/api/products?status=Active&sort=ending_soon&pageSize=4" href="#/auctions?status=Active&sort=ending_soon" ids={ids} toggle={toggle}/>
    <Lots title="Đang diễn ra" path="/api/products?status=Active&sort=newest&pageSize=8" href="#/auctions?status=Active" ids={ids} toggle={toggle}/>
    {!admin && <section className="seller-strip"><div><h2>Bắt đầu phiên đấu giá của bạn</h2><p>Đăng thông tin, ảnh sản phẩm và thời gian mở phiên.</p></div><a className="btn dark" href="#/product/new">Đăng sản phẩm →</a></section>}
    <Lots title="Sắp diễn ra" path="/api/products?status=Scheduled&sort=newest&pageSize=4" href="#/auctions?status=Scheduled" ids={ids} toggle={toggle}/>
    <section className="market-help"><h2>Thông tin trước khi đặt giá</h2><div>
      <a href="#/guides"><strong>Cách tham gia</strong><span>Tài khoản, đặt giá và theo dõi kết quả →</span></a>
      <a href="#/policies"><strong>Quy tắc đấu giá</strong><span>Giá khởi điểm, bước giá và thời hạn →</span></a>
      <a href="#/orders"><strong>Đơn hàng của bạn</strong><span>Xem đơn mua và đơn bán sau phiên →</span></a>
    </div></section>
  </>;
}
