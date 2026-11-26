import React from "react";
import { AuctionCard, Countdown, useApi, useFavorites } from "./widgets.jsx";
import { LotPhoto } from "./Lot.jsx";
import { money } from "./api";

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

export default function MarketplaceHome({ admin }) {
  const categories = useApi("/api/Categories");
  const featured = useApi("/api/products?status=Active&sort=most_bids&pageSize=1");
  const { ids, toggle } = useFavorites();
  const item = featured.data?.items?.[0];
  return <>
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
      <section className="market-banner">
        <div className="market-banner-copy">
          <span className="eyebrow">PHIÊN ĐƯỢC QUAN TÂM</span>
          <h1>{item?.name || "Khám phá phiên đấu giá"}</h1>
          {item ? <><p>{item.category}</p><div className="featured-price"><small>Giá hiện tại</small><strong>{money(item.currentPrice)}</strong></div><div className="featured-time"><Countdown item={item} compact /></div></> : <p>Xem sản phẩm và thời gian mở phiên.</p>}
          <a href={item ? `#/product/${item.id}` : "#/auctions"} className="btn dark">{item ? "Xem phiên đấu giá" : "Xem các phiên"} <span aria-hidden="true">→</span></a>
        </div>
        {item && <a className="market-feature" href={`#/product/${item.id}`}>
          <LotPhoto item={item} priority/>
        </a>}
      </section>
    </div>
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
