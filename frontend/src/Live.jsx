import React, { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { api, json, query, money, date, parseApiDate, getSession, API_BASE } from "./api";
import useRemote from "./useRemote";
import { Modal, PageHeader, EmptyState, LoadingState, ErrorState, MoneyInput, useConfirm } from "./UI.jsx";
import { Magnifier, Lightbox } from "./ImageZoom.jsx";

export const eventStatusText = {
  Draft: "Bản nháp",
  Published: "Sắp diễn ra",
  Live: "Đang diễn ra",
  Paused: "Tạm dừng",
  Completed: "Đã kết thúc",
  Cancelled: "Đã hủy",
};
const lotStatusText = {
  Pending: "Chờ mở",
  Open: "Đang đấu giá",
  Paused: "Tạm dừng",
  Sold: "Đã bán",
  Unsold: "Không bán được",
  Skipped: "Bỏ qua",
  Withdrawn: "Đã rút",
};
const myStatusText = {
  Leading: "Bạn đang dẫn đầu",
  Outbid: "Bạn đã bị vượt giá",
  Won: "Bạn đã thắng lô này",
};
const activityIcon = { bid: "₫", open: "▶", warning: "!", sold: "✓", unsold: "×", announcement: "◎" };

export function openLiveRoom(id, go, notify) {
  const base = `${location.href.split("#")[0]}#/live-room/${id}`;
  const width = Math.min(1400, Math.max(900, screen.availWidth - 60));
  const height = Math.min(900, Math.max(640, screen.availHeight - 80));
  const left = Math.max(0, (screen.availWidth - width) / 2);
  const top = Math.max(0, (screen.availHeight - height) / 2);
  const room = window.open(
    base,
    `BidNetLive_${id}`,
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );
  if (!room) {
    notify?.("Trình duyệt đã chặn cửa sổ phòng đấu giá. Đang mở trong tab hiện tại.");
    go(`/live-room/${id}`);
    return;
  }
  room.focus();
}

export function LiveEventsPage({ user, go, notify, openAuth }) {
  const [status, setStatus] = useState(() =>
    new URLSearchParams(location.hash.split("?")[1] || "").get("status") || "",
  );
  const [q, setQ] = useState("");
  const events = useRemote(
    () => api(`/api/live/events?${query({ status, q })}`),
    [status, q],
  );
  const register = async (id) => {
    if (!user) return openAuth("login");
    try {
      await json("POST", `/api/live/events/${id}/register`);
      notify("Đã đăng ký tham gia sự kiện. Bạn có thể đặt giá khi lô được mở.");
      events.reload();
    } catch (e) {
      notify(e.message);
    }
  };
  return (
    <div className="live-page">
      <section className="live-hero">
        <div>
          <span className="eyebrow">BidNet Live · Đấu giá trực tiếp</span>
          <h1>Phòng đấu giá có người điều hành</h1>
          <p>
            Theo dõi từng lô được mở lần lượt, đặt giá theo thời gian thực và nhận
            kết quả ngay khi người điều hành chốt. Phòng đấu giá mở trong cửa sổ
            riêng để bạn vừa theo dõi vừa dùng BidNet.
          </p>
          <div className="actions">
            <a className="btn dark" href="#/live-auctions?status=Live">Xem phiên đang diễn ra</a>
            <a className="btn secondary" href="#/contact">Đưa sản phẩm vào đấu giá trực tiếp</a>
          </div>
        </div>
        <div className="live-hero-note">
          <strong>Đấu giá trực tiếp khác gì?</strong>
          <ul>
            <li>Nhiều lô trong một sự kiện, mở lần lượt.</li>
            <li>Người điều hành gọi giá và cảnh báo chốt.</li>
            <li>Đăng ký tham gia trước khi đặt giá.</li>
            <li>Cần đăng ký sự kiện, không chỉ đăng nhập.</li>
          </ul>
        </div>
      </section>
      <div className="status-tabs" role="tablist" aria-label="Lọc sự kiện">
        {[["", "Tất cả"], ["Live", "Đang diễn ra"], ["Published", "Sắp diễn ra"], ["Completed", "Đã kết thúc"]].map(
          ([value, label]) => (
            <button key={value} type="button" role="tab" aria-pressed={status === value} onClick={() => setStatus(value)}>
              {label}
            </button>
          ),
        )}
        <form className="live-search" onSubmit={(e) => { e.preventDefault(); setQ(new FormData(e.currentTarget).get("q")?.trim() || ""); }}>
          <input name="q" type="search" placeholder="Tìm sự kiện…" aria-label="Tìm sự kiện đấu giá trực tiếp" />
          <button className="btn secondary" type="submit">Tìm</button>
        </form>
      </div>
      {events.error && <ErrorState message={events.error} onRetry={events.reload} />}
      {events.loading && <LoadingState />}
      {events.data && !events.data.length && (
        <EmptyState title="Chưa có sự kiện đấu giá trực tiếp" description="Các sự kiện do BidNet tổ chức sẽ xuất hiện tại đây." />
      )}
      <div className="live-event-grid">
        {events.data?.map((event) => (
          <article className="live-event-card" key={event.id}>
            <div
              className={`live-cover${event.bannerUrl ? " has-image" : ""}`}
              style={event.bannerUrl ? { backgroundImage: `url(${event.bannerUrl})` } : undefined}
            >
              <span className={`live-status ${event.status}`}>{event.status === "Live" && "● "}{eventStatusText[event.status]}</span>
              <span className="live-code">{event.code}</span>
            </div>
            <div className="live-event-body">
              <h2><a href={`#/live-auctions/${event.id}`}>{event.title}</a></h2>
              <p className="muted">{event.description || "Sự kiện đấu giá trực tiếp do BidNet tổ chức."}</p>
              <div className="live-facts">
                <span><b>{event.lotCount}</b> lô</span>
                <span><b>{event.soldCount}</b> đã bán</span>
                {event.status === "Live" && <span><b>{event.viewerCount ?? "—"}</b> đang xem</span>}
                <span>{date(event.scheduledStartAt)}</span>
              </div>
              {event.currentLotNumber > 0 && (
                <p className="live-progress">Đang đấu giá lô {String(event.currentLotNumber).padStart(3, "0")} / {event.lotCount}</p>
              )}
              <div className="actions">
                {event.status === "Published" && (
                  <button className="btn secondary" type="button" onClick={() => register(event.id)}>
                    {event.myRegistrationStatus === "Approved" ? "Đã đăng ký" : "Đăng ký tham gia"}
                  </button>
                )}
                <button
                  className="btn dark"
                  type="button"
                  onClick={() =>
                    event.status === "Live" || event.status === "Paused"
                      ? openLiveRoom(event.id, go, notify)
                      : go(`/live-auctions/${event.id}`)
                  }
                >
                  {event.status === "Live" || event.status === "Paused" ? "Vào phòng đấu giá" : "Xem chi tiết"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function LiveEventPage({ id, user, go, notify, openAuth }) {
  const event = useRemote(() => api(`/api/live/events/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const register = async () => {
    if (!user) return openAuth("login");
    setBusy(true);
    setError("");
    try {
      await json("POST", `/api/live/events/${id}/register`);
      notify("Đăng ký tham gia thành công.");
      event.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const e = event.data;
  return (
    <div className="live-page">
      {event.error && <ErrorState message={event.error} onRetry={event.reload} />}
      {event.loading && <LoadingState />}
      {e && (
        <>
          <nav className="breadcrumb" aria-label="Đường dẫn">
            <a href="#/">Trang chủ</a><span>/</span><a href="#/live-auctions">Đấu giá trực tiếp</a><span>/</span><b>{e.code}</b>
          </nav>
          <section className="live-detail-head">
            <div>
              <span className={`live-status ${e.status}`}>{eventStatusText[e.status]}</span>
              <h1>{e.title}</h1>
              <p className="muted">{e.description}</p>
              <div className="live-facts">
                <span>Bắt đầu: <b>{date(e.scheduledStartAt)}</b></span>
                <span>{e.lotCount} lô · {e.soldCount} đã bán</span>
                {e.status === "Live" && <span>{e.viewerCount ?? "—"} đang xem</span>}
                <span>{e.registrationCount} người đã đăng ký</span>
              </div>
            </div>
            <aside className="panel live-register-card">
              <h2>Tham gia sự kiện</h2>
              <p>
                {e.myRegistrationStatus === "Approved"
                  ? "Bạn đã được cấp quyền đặt giá trong sự kiện này."
                  : "Đăng ký tham gia để được đặt giá khi lô mở. Tài khoản mới được duyệt tự động."}
              </p>
              {error && <div className="notice error" role="alert">{error}</div>}
              {e.myRegistrationStatus !== "Approved" && e.status !== "Completed" && e.status !== "Cancelled" && (
                <button className="btn" disabled={busy} onClick={register}>
                  {busy ? "Đang gửi…" : user ? "Đăng ký tham gia" : "Đăng nhập để đăng ký"}
                </button>
              )}
              {(e.status === "Live" || e.status === "Paused" || e.status === "Completed") && (
                <button className="btn dark" onClick={() => openLiveRoom(e.id, go, notify)}>
                  Vào phòng đấu giá
                </button>
              )}
            </aside>
          </section>
          <section className="panel">
            <h2>Danh sách lô ({e.lots.length})</h2>
            <div className="table-wrap">
              <table className="table live-lot-table">
                <thead><tr><th>Lô</th><th>Sản phẩm</th><th>Giá hiện tại</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {e.lots.map((lot) => (
                    <tr key={lot.id}>
                      <td>#{String(lot.lotNumber).padStart(3, "0")}</td>
                      <td>
                        {lot.title}
                        <small className="muted"> · {lot.sellerName}</small>
                      </td>
                      <td>{money(lot.status === "Sold" ? lot.hammerPrice : lot.currentPrice)}</td>
                      <td><span className={`badge ${lot.status}`}>{lotStatusText[lot.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!e.lots.length && <EmptyState title="Chưa có lô nào" description="Người điều hành sẽ công bố danh sách lô trước khi mở phòng." />}
          </section>
        </>
      )}
    </div>
  );
}

export function LiveRoomPage({ id, user, go, notify, openAuth }) {
  const snap = useRemote(() => api(`/api/live/events/${id}/snapshot`), [id]);
  const [selectedId, setSelectedId] = useState(null);
  const [amount, setAmount] = useState("");
  const [bidError, setBidError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [won, setWon] = useState(null);
  const [lightbox, setLightbox] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const reloadRef = useRef(snap.reload);
  reloadRef.current = snap.reload;

  const data = snap.data;
  const event = data?.event;
  const activeLot = event?.lots.find((lot) => lot.id === event.currentLotId) || null;
  const selected = event?.lots.find((lot) => lot.id === selectedId) || activeLot || event?.lots[0] || null;
  const isCurrent = selected && activeLot && selected.id === activeLot.id;
  const canBid = Boolean(
    user && isCurrent && activeLot?.status === "Open" && event?.status === "Live" &&
    data?.myRegistrationStatus === "Approved",
  );

  useEffect(() => {
    const timer = setInterval(() => reloadRef.current(), 15000);
    return () => clearInterval(timer);
  }, [id]);

  useEffect(() => {
    let alive = true;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/live`, { accessTokenFactory: () => getSession()?.accessToken || "" })
      .withAutomaticReconnect()
      .build();
    const refresh = () => reloadRef.current();
    connection.onreconnecting(() => alive && setConnected(false));
    connection.onreconnected(async () => {
      try {
        const count = await connection.invoke("JoinEvent", id);
        if (alive) { setConnected(true); setViewerCount(count); refresh(); }
      } catch { if (alive) setConnected(false); }
    });
    connection.onclose(() => alive && setConnected(false));
    connection.on("ViewerCountUpdated", (payload) => {
      if (alive && payload?.eventId === Number(id)) setViewerCount(payload.viewerCount || 0);
    });
    connection.on("BidAccepted", (payload) => {
      refresh();
      if (payload?.bid?.bidderCode) notify(`${payload.bid.bidderCode} vừa đặt ${money(payload.bid.amount)}`);
    });
    connection.on("LotOpened", (payload) => {
      refresh();
      notify(`Lô ${String(payload.lotNumber).padStart(3, "0")} đã mở đấu giá.`);
    });
    connection.on("FairWarning", (payload) => {
      refresh();
      notify(payload.stage === "Twice" ? "Cảnh báo chốt lần 2." : "Người điều hành thông báo sắp chốt lô.");
    });
    connection.on("LotSold", (payload) => {
      refresh();
      if (payload?.winnerId && payload.winnerId === user.id) {
        const lot = snap.data?.event?.lots.find((item) => item.id === payload.lotId);
        setWon({ lotNumber: payload.lotNumber, title: lot?.title, price: payload.hammerPrice });
      } else {
        notify(`Lô ${String(payload.lotNumber).padStart(3, "0")} đã bán với ${money(payload.hammerPrice)}.`);
      }
    });
    connection.on("LotUnsold", (payload) => {
      refresh();
      notify(`Lô ${String(payload.lotNumber).padStart(3, "0")} không bán được.`);
    });
    connection.on("EventPaused", () => { refresh(); notify("Phiên đấu giá đang tạm dừng."); });
    connection.on("EventResumed", () => { refresh(); notify("Phiên đấu giá đã tiếp tục."); });
    connection.on("EventCompleted", () => { refresh(); notify("Sự kiện đấu giá trực tiếp đã kết thúc."); });
    connection.on("LotsChanged", refresh);
    connection.on("Announcement", (payload) => {
      if (!alive) return;
      setAnnouncements((current) => [
        { key: `a-${payload.at}-${current.length}`, type: "announcement", at: payload.at, text: payload.message },
        ...current,
      ].slice(0, 10));
      notify(payload.message);
    });
    connection.start()
      .then(async () => {
        const count = await connection.invoke("JoinEvent", id);
        if (alive) { setConnected(true); setViewerCount(count); }
      })
      .catch(() => alive && setConnected(false));
    return () => { alive = false; connection.stop(); };
  }, [id, user?.id]);

  useEffect(() => {
    setBidError("");
    setAmount(activeLot ? String(activeLot.minimumBid) : "");
  }, [activeLot?.id, activeLot?.minimumBid]);

  const connectState = connected === false ? "offline"
    : connected ? (user ? "online" : "guest")
      : user ? "connecting" : "guest";

  const register = async () => {
    if (!user) return openAuth("login");
    setBusy(true);
    setBidError("");
    try {
      await json("POST", `/api/live/events/${id}/register`);
      notify("Đã đăng ký tham gia. Bạn có thể đặt giá ngay khi lô đang mở.");
      snap.reload();
    } catch (e) {
      setBidError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const placeBid = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!canBid || busy) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setBidError("Vui lòng nhập mức giá hợp lệ.");
    setBusy(true);
    setBidError("");
    try {
      await json("POST", `/api/live/lots/${activeLot.id}/bids`, { amount: value });
      notify(`Đã ghi nhận lượt đặt giá ${money(value)}.`);
      snap.reload();
    } catch (e) {
      setBidError(e.message);
      snap.reload();
    } finally {
      setBusy(false);
    }
  };

  const feed = [
    ...announcements,
    ...(data?.activity || []),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (snap.error) return <div className="live-room-page"><ErrorState message={snap.error} onRetry={snap.reload} /></div>;
  if (!data) return <div className="live-room-page"><LoadingState label="Đang kết nối phòng đấu giá…" /></div>;

  const photos = selected?.imageUrl ? [{ url: selected.imageUrl, label: selected.title }] : [];
  const progress = event.lotCount ? Math.round((event.soldCount / event.lotCount) * 100) : 0;

  return (
    <div className="live-room-page">
      <header className="live-room-top">
        <a className="brand" href="#/" aria-label="BidNet">Bid<span>Net</span> <small>LIVE</small></a>
        <div className="live-room-title">
          <strong>{event.title}</strong>
          <span>{event.code} · {eventStatusText[event.status]}</span>
        </div>
        <div className="live-room-tools">
          <span className={`live-connection ${connectState}`} title="Trạng thái kết nối realtime">
            <i aria-hidden="true" /> {connectState === "online" ? "Trực tiếp" : connectState === "offline" ? "Đang kết nối lại" : connectState === "guest" ? "Chế độ xem" : "Đang kết nối"}
          </span>
          <span className="live-viewer-count">{viewerCount} đang xem</span>
          {user ? (
            <span className="live-user">{user.fullName || user.username}</span>
          ) : (
            <button className="btn secondary" onClick={() => openAuth("login")}>Đăng nhập để đặt giá</button>
          )}
          <button className="btn secondary" onClick={() => go(`/live-auctions/${id}`)}>← Về sự kiện</button>
        </div>
      </header>

      {event.status === "Paused" && (
        <div className="live-banner" role="status"><b>Tạm dừng phiên đấu giá</b><span>Mọi lượt đặt giá tạm thời không được tiếp nhận. Vui lòng chờ người điều hành tiếp tục.</span></div>
      )}
      {connectState === "offline" && (
        <div className="live-banner error" role="alert"><b>Mất kết nối với phòng đấu giá</b><span>Hệ thống đang kết nối lại. Nút đặt giá tạm khóa để tránh gửi trùng.</span></div>
      )}
      {activeLot?.callingStage && activeLot.callingStage !== "None" && activeLot.status === "Open" && (
        <div className="live-banner warning" role="status"><b>Cảnh báo sắp chốt</b><span>Người điều hành đã gọi giá lần {activeLot.callingStage === "Twice" ? "2" : "1"} cho lô đang mở.</span></div>
      )}

      <div className="live-room-grid">
        <aside className="live-lots-panel">
          <div className="live-panel-head">
            <span className="eyebrow">Danh sách lô</span>
            <b>{event.soldCount}/{event.lotCount}</b>
          </div>
          <div className="live-progressbar" aria-label={`Đã bán ${progress}% số lô`}><span style={{ width: `${progress}%` }} /></div>
          <p className="muted small">{event.registrationCount} người đăng ký · {event.lots.length} lô</p>
          <div className="live-lot-list">
            {event.lots.map((lot) => (
              <button
                key={lot.id}
                type="button"
                className={`live-lot-item${selected?.id === lot.id ? " selected" : ""}${lot.status === "Open" ? " open" : ""}`}
                onClick={() => setSelectedId(lot.id)}
              >
                <span className="live-lot-thumb">
                  {lot.imageUrl ? <img src={lot.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">#{String(lot.lotNumber).padStart(3, "0")}</span>}
                </span>
                <span className="live-lot-info">
                  <small>Lô {String(lot.lotNumber).padStart(3, "0")}</small>
                  <strong>{lot.title}</strong>
                  <span>{money(lot.status === "Sold" ? lot.hammerPrice : lot.currentPrice)} · {lotStatusText[lot.status]}</span>
                </span>
              </button>
            ))}
          </div>
          {activeLot && selected && selected.id !== activeLot.id && (
            <button className="btn" type="button" onClick={() => setSelectedId(null)}>↩ Quay về lô đang đấu giá</button>
          )}
        </aside>

        <section className="live-lot-panel">
          {selected ? (
            <>
              <div className="live-lot-heading">
                <div>
                  <span className="eyebrow">Lô {String(selected.lotNumber).padStart(3, "0")} / {event.lotCount}</span>
                  <h1>{selected.title}</h1>
                </div>
                <span className={`badge ${selected.status}`}>{lotStatusText[selected.status]}</span>
              </div>
              <div className="live-lot-image">
                {photos.length ? (
                  <Magnifier item={{ name: selected.title, id: selected.lotNumber }} src={photos[0].url} onOpen={() => setLightbox(true)} />
                ) : (
                  <div className="lot-fallback"><span>Chưa có ảnh sản phẩm</span><b>#{String(selected.lotNumber).padStart(3, "0")}</b></div>
                )}
              </div>
              <div className="live-lot-meta">
                <div><span>Người bán</span><b>{selected.sellerName}</b></div>
                <div><span>Giá khởi điểm</span><b>{money(selected.startingPrice)}</b></div>
                <div><span>Bước giá</span><b>{money(selected.bidIncrement)}</b></div>
                <div><span>Lượt đặt</span><b>{selected.bidCount}</b></div>
                <div><span>Người dẫn đầu</span><b>{selected.leadingBidderCode || "—"}</b></div>
                <div><span>Giá dự trữ</span><b>{selected.reserveMet ? "Đã đạt" : "Chưa đạt"}</b></div>
              </div>
              <p className="live-lot-desc">{selected.description || "Người bán chưa cung cấp mô tả chi tiết cho lô này."}</p>
              {selected.status === "Sold" && (
                <div className="notice success" role="status">
                  <strong>Đã bán lô này</strong> · {money(selected.hammerPrice)} · Người thắng: {selected.winnerName || "—"}
                </div>
              )}
              {selected.myStatus && <p className={`live-my-status ${selected.myStatus}`}>{myStatusText[selected.myStatus]}</p>}
            </>
          ) : (
            <EmptyState title="Chưa có lô nào được mở" description="Người điều hành sẽ mở lô đầu tiên khi sự kiện bắt đầu." />
          )}
        </section>

        <aside className="live-feed-panel">
          <div className="live-panel-head"><span className="eyebrow">Diễn biến đấu giá</span><b>{activeLot ? `Lô ${String(activeLot.lotNumber).padStart(3, "0")}` : "—"}</b></div>
          <div className="live-feed" aria-live="polite">
            {feed.length ? feed.map((item) => (
              <article className={`live-feed-item ${item.type}`} key={item.key || `${item.type}-${item.at}-${item.text}`}>
                <span className="live-feed-icon" aria-hidden="true">{activityIcon[item.type] || "•"}</span>
                <div>
                  <p>{item.text}</p>
                  {item.amount != null && <b>{money(item.amount)}</b>}
                  <time>{new Date(parseApiDate(item.at) || item.at).toLocaleTimeString("vi-VN")}</time>
                </div>
              </article>
            )) : <p className="muted small">Chưa có diễn biến. Các lượt đặt giá sẽ xuất hiện tại đây.</p>}
          </div>
        </aside>
      </div>

      <footer className="live-bidbar">
        {selected ? (
          <>
            <div className="live-bid-facts">
              <div><span>Giá hiện tại</span><b>{money(selected.currentPrice)}</b></div>
              <div><span>Giá tối thiểu tiếp theo</span><b>{money(selected.minimumBid)}</b></div>
              <div><span>Bước giá</span><b>{money(selected.bidIncrement)}</b></div>
            </div>
            {selected.id !== activeLot?.id && (
              <p className="live-bid-hint">Bạn đang xem lô khác. Chỉ lô đang mở mới nhận lượt đặt giá.</p>
            )}
            {bidError && <div className="notice error" role="alert">{bidError}</div>}
            {isCurrent && activeLot.status === "Open" ? (
              data.myRegistrationStatus === "Approved" ? (() => {
                const numericAmount = Number(amount || 0);
                const minBid = Number(activeLot.minimumBid || 0);
                const stepBid = Math.max(1, Number(activeLot.bidIncrement || 1000));
                const isBelowMin = !amount || numericAmount < minBid;
                const isBadStep = !isBelowMin && (numericAmount - minBid) % stepBid !== 0;
                const invalidReason = !amount
                  ? `Cần nhập tối thiểu ${money(minBid)}`
                  : isBelowMin
                    ? `Thấp hơn mức tối thiểu (${money(minBid)})`
                    : isBadStep
                      ? `Phải tăng theo bước ${money(stepBid)}`
                      : "";

                const adjustAmount = (delta) => {
                  const base = numericAmount >= minBid ? numericAmount : minBid;
                  const next = Math.max(minBid, base + delta);
                  setAmount(String(next));
                };

                return (
                  <form className="live-bid-form" onSubmit={placeBid}>
                    <div className="live-bid-input-group">
                      <label htmlFor="liveAmount">
                        <span>Giá bạn muốn đặt</span>
                        <small>Tối thiểu {money(minBid)}</small>
                      </label>
                      <div className={`live-bid-stepper${invalidReason ? " invalid" : ""}`}>
                        <button
                          type="button"
                          className="live-step-btn"
                          title={`Giảm ${money(stepBid)}`}
                          disabled={busy || !canBid || numericAmount <= minBid}
                          onClick={() => adjustAmount(-stepBid)}
                        >
                          −
                        </button>
                        <div className="live-money-field">
                          <input
                            id="liveAmount"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder={minBid.toLocaleString("vi-VN")}
                            value={amount ? Number(amount).toLocaleString("vi-VN") : ""}
                            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                            disabled={busy || !canBid}
                          />
                          <span className="live-currency-tag" aria-hidden="true">VNĐ</span>
                        </div>
                        <button
                          type="button"
                          className="live-step-btn"
                          title={`Tăng ${money(stepBid)}`}
                          disabled={busy || !canBid}
                          onClick={() => adjustAmount(stepBid)}
                        >
                          +
                        </button>
                      </div>
                      {invalidReason && (
                        <div className="live-bid-inline-error">
                          <span>{invalidReason}</span>
                          <button type="button" onClick={() => setAmount(String(minBid))}>Dùng {money(minBid)}</button>
                        </div>
                      )}
                    </div>

                    <div className="live-quick-steps" aria-label="Tăng nhanh theo bước giá">
                      <button type="button" className="btn secondary" disabled={busy || !canBid} onClick={() => adjustAmount(stepBid)}>
                        +{money(stepBid)}
                      </button>
                      <button type="button" className="btn secondary" disabled={busy || !canBid} onClick={() => adjustAmount(stepBid * 2)}>
                        +{money(stepBid * 2)}
                      </button>
                      <button type="button" className="btn secondary" disabled={busy || !canBid} onClick={() => adjustAmount(stepBid * 5)}>
                        +{money(stepBid * 5)}
                      </button>
                    </div>

                    <button type="submit" className="btn dark live-bid-submit" disabled={busy || !canBid || Boolean(invalidReason)}>
                      {busy ? "Đang gửi…" : canBid ? `Đặt giá ${money(numericAmount || minBid)}` : "Không thể đặt giá"}
                    </button>
                    <p className="small muted live-bid-privacy">Không công khai thông tin cá nhân; người khác chỉ thấy mã người tham gia.</p>
                  </form>
                );
              })() : (
                <div className="live-register-cta">
                  <p>Bạn cần đăng ký sự kiện trước khi đặt giá.</p>
                  <button className="btn dark" disabled={busy} onClick={register}>
                    {busy ? "Đang gửi…" : user ? "Đăng ký tham gia" : "Đăng nhập để đăng ký"}
                  </button>
                </div>
              )
            ) : (
              <p className="live-bid-hint">
                {activeLot?.status === "Sold" ? `Lô đã bán với ${money(activeLot.hammerPrice)}.`
                  : activeLot?.status === "Unsold" ? "Lô không bán được."
                  : event.status === "Completed" ? "Sự kiện đã kết thúc."
                  : "Lô này chưa mở nhận đặt giá."}
              </p>
            )}
          </>
        ) : (
          <p className="muted">Đang chờ người điều hành mở lô đầu tiên.</p>
        )}
      </footer>

      {lightbox && photos.length > 0 && (
        <Lightbox photos={photos} index={0} alt={selected?.title || "Sản phẩm"} onIndexChange={() => {}} onClose={() => setLightbox(false)} />
      )}
      {won && (
        <Modal title="Chúc mừng bạn!" onClose={() => setWon(null)}>
          <div className="bid-success">
            <span className="bid-success-mark" aria-hidden="true">✓</span>
            <p className="bid-success-amount">Bạn đã thắng lô {String(won.lotNumber).padStart(3, "0")}</p>
            <p className="won-product">{won.title}</p>
            <dl className="bid-success-meta">
              <div><dt>Giá chốt</dt><dd>{money(won.price)}</dd></div>
              <div><dt>Trạng thái</dt><dd>Chờ thanh toán</dd></div>
            </dl>
            <p className="muted small">Đơn hàng đã được tạo tự động. Bạn có thể xem và cập nhật địa chỉ nhận hàng trong mục Đơn hàng.</p>
          </div>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setWon(null)}>Ở lại phòng</button>
            <a className="btn dark" href="#/orders" onClick={() => setWon(null)}>Xem đơn hàng</a>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Quản trị ────────────────────────────────────────────────────────────────
const localInputValue = (value) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const toUtc = (value) => (value ? new Date(value).toISOString() : null);
const liveWizardSteps = ["Thông tin", "Lịch", "Danh sách lô", "Quy tắc", "Nhân sự", "Xác nhận"];

function createLiveDraft() {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    bannerUrl: "",
    scheduledStartAt: localInputValue(start),
    scheduledEndAt: localInputValue(end),
    registrationOpen: false,
    buyerPremiumPercent: "0",
  };
}

export function AdminLiveEvents({ notify, user }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [draft, setDraft] = useState(createLiveDraft);
  const [lots, setLots] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const result = useRemote(() => api("/api/admin/live/events"), []);
  const confirm = useConfirm();

  useEffect(() => {
    if (!open || step !== 2) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      setProductsLoading(true);
      setProductsError("");
      setProducts([]);
      api(`/api/admin/live/products${search ? `?q=${encodeURIComponent(search)}` : ""}`)
        .then((items) => active && setProducts(items))
        .catch((e) => active && setProductsError(e.message))
        .finally(() => active && setProductsLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, step, search]);

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const startWizard = () => {
    setDraft(createLiveDraft());
    setLots([]);
    setDraftId(null);
    setStep(0);
    setSearch("");
    setProducts([]);
    setError("");
    setOpen(true);
  };
  const nextStep = () => {
    setError("");
    if (step === 0 && !draft.title.trim()) {
      setError("Vui lòng nhập tên sự kiện.");
      return;
    }
    if (step === 1) {
      const start = new Date(draft.scheduledStartAt);
      const end = draft.scheduledEndAt ? new Date(draft.scheduledEndAt) : null;
      if (!draft.scheduledStartAt || !Number.isFinite(start.getTime()) || start <= new Date()) {
        setError("Thời gian bắt đầu phải ở trong tương lai.");
        return;
      }
      if (end && (!Number.isFinite(end.getTime()) || end <= start)) {
        setError("Thời gian kết thúc phải sau thời gian bắt đầu.");
        return;
      }
    }
    if (step === 3) {
      const percent = Number(draft.buyerPremiumPercent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
        setError("Phí người mua phải nằm trong khoảng 0% đến 50%.");
        return;
      }
    }
    setStep((current) => Math.min(current + 1, liveWizardSteps.length - 1));
  };

  const addProduct = (product) => {
    setLots((current) => current.some((lot) => lot.productId === product.id)
      ? current
      : [...current, {
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        sellerName: product.sellerName,
        startingPrice: String(product.startingPrice),
        reservePrice: "",
        bidIncrement: "1000",
      }]);
  };
  const updateLot = (productId, key, value) =>
    setLots((current) => current.map((lot) => lot.productId === productId ? { ...lot, [key]: value } : lot));
  const moveLot = (index, direction) => setLots((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const reordered = [...current];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    return reordered;
  });

  const validLots = () => {
    for (const lot of lots) {
      const start = Number(lot.startingPrice);
      const increment = Number(lot.bidIncrement);
      const reserve = lot.reservePrice === "" ? null : Number(lot.reservePrice);
      if (!Number.isInteger(start) || start < 1000 || start > 100_000_000_000) {
        setError(`Giá khởi điểm của "${lot.name}" phải là số nguyên từ 1.000 VNĐ.`);
        return false;
      }
      if (!Number.isInteger(increment) || increment < 1) {
        setError(`Bước giá của "${lot.name}" phải là số nguyên dương.`);
        return false;
      }
      if (reserve !== null && (!Number.isInteger(reserve) || reserve < start)) {
        setError(`Giá dự trữ của "${lot.name}" phải là số nguyên và không thấp hơn giá khởi điểm.`);
        return false;
      }
    }
    return true;
  };

  const persistEvent = async (publish) => {
    setError("");
    if (publish && lots.length === 0) {
      setError("Cần thêm ít nhất một lô trước khi công bố sự kiện.");
      return;
    }
    if (!validLots()) return;
    setBusy(true);
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        bannerUrl: draft.bannerUrl || null,
        scheduledStartAt: toUtc(draft.scheduledStartAt),
        scheduledEndAt: toUtc(draft.scheduledEndAt),
        registrationOpen: draft.registrationOpen,
        buyerPremiumRate: Number(draft.buyerPremiumPercent || 0) / 100,
      };
      let id = draftId;
      if (id) {
        await json("PUT", `/api/admin/live/events/${id}`, payload);
      } else {
        const created = await json("POST", "/api/admin/live/events", payload);
        id = created.id;
        setDraftId(id);
      }

      const savedEvent = await api(`/api/admin/live/events/${id}`);
      const addedProducts = new Set(savedEvent.lots.map((lot) => lot.productId));
      for (const lot of lots) {
        if (addedProducts.has(lot.productId)) continue;
        await json("POST", `/api/admin/live/events/${id}/lots`, {
          productId: lot.productId,
          startingPrice: Number(lot.startingPrice),
          reservePrice: lot.reservePrice === "" ? null : Number(lot.reservePrice),
          bidIncrement: Number(lot.bidIncrement),
        });
        addedProducts.add(lot.productId);
      }
      if (publish) await json("POST", `/api/admin/live/events/${id}/publish`);

      setOpen(false);
      notify(publish ? "Đã công bố sự kiện đấu giá trực tiếp." : "Đã lưu bản nháp sự kiện.");
      result.reload();
      location.hash = `/admin/live/${id}`;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    const accepted = await confirm({
      title: "Xác nhận công bố sự kiện",
      message: "Sự kiện và các lô đã chọn sẽ hiển thị công khai. Bạn có chắc chắn muốn công bố?",
      action: "Công bố sự kiện",
    });
    if (accepted) await persistEvent(true);
  };

  const uploadBanner = async (file) => {
    if (!file) return;
    setBannerBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const uploaded = await api("/api/admin/live/banners", { method: "POST", body });
      setDraft((current) => ({ ...current, bannerUrl: uploaded.bannerUrl }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBannerBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="BidNet Live" title="Sự kiện đấu giá trực tiếp" description="Tạo sự kiện, xếp lô và công bố lịch. Chỉ sự kiện đã công bố mới hiển thị công khai.">
        <button className="btn dark" onClick={startWizard}>+ Tạo sự kiện</button>
      </PageHeader>
      {result.error && <ErrorState message={result.error} onRetry={result.reload} />}
      {result.loading && <LoadingState />}
      {result.data && (
        <div className="panel table-wrap">
          <table className="table">
            <thead><tr><th>Mã</th><th>Sự kiện</th><th>Lịch</th><th>Lô</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>
              {result.data.map((event) => (
                <tr key={event.id}>
                  <td>{event.code}</td>
                  <td>{event.title}</td>
                  <td>{date(event.scheduledStartAt)}</td>
                  <td>{event.soldCount}/{event.lotCount}</td>
                  <td><span className={`badge ${event.status}`}>{eventStatusText[event.status]}</span></td>
                  <td><a className="btn secondary" href={`#/admin/live/${event.id}`}>Quản lý</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.data.length && <EmptyState title="Chưa có sự kiện" description="Tạo sự kiện đầu tiên rồi thêm lô từ sản phẩm đang chờ." />}
        </div>
      )}
      {open && (
        <Modal
          title={`Tạo sự kiện · ${liveWizardSteps[step]} (${step + 1}/${liveWizardSteps.length})`}
          onClose={() => setOpen(false)}
          busy={busy || bannerBusy}
          className="live-wizard-dialog"
        >
          <div className="live-wizard">
            <ol className="live-wizard-progress" aria-label="Các bước tạo sự kiện">
              {liveWizardSteps.map((label, index) => (
                <li key={label} className={index === step ? "active" : index < step ? "complete" : ""}>
                  <span>{index + 1}</span><small>{label}</small>
                </li>
              ))}
            </ol>
            <div className="live-wizard-body">
              {step === 0 && (
                <section className="live-wizard-step">
                  <h3>Thông tin sự kiện</h3>
                  <p className="muted">Đặt tên rõ ràng để người tham gia nhận biết nội dung phiên.</p>
                  <div className="field">
                    <label htmlFor="liveTitle">Tên sự kiện</label>
                    <input id="liveTitle" maxLength={200} value={draft.title} onChange={(e) => updateDraft("title", e.target.value)} required />
                  </div>
                  <div className="field">
                    <label htmlFor="liveDesc">Mô tả</label>
                    <textarea id="liveDesc" maxLength={2000} rows={4} value={draft.description} onChange={(e) => updateDraft("description", e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="liveBannerFile">Banner sự kiện (tùy chọn)</label>
                    <input id="liveBannerFile" type="file" accept="image/png,image/jpeg,image/webp" disabled={bannerBusy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; uploadBanner(file); }} />
                    <small className="muted">PNG, JPEG hoặc WebP · tối đa 5 MB.</small>
                  </div>
                  {bannerBusy && <p className="muted" role="status">Đang tải banner…</p>}
                  {draft.bannerUrl && (
                    <div className="live-banner-preview">
                      <img src={draft.bannerUrl} alt="Xem trước banner sự kiện" />
                      <button type="button" className="link-btn" onClick={() => updateDraft("bannerUrl", "")}>Gỡ banner</button>
                    </div>
                  )}
                </section>
              )}
              {step === 1 && (
                <section className="live-wizard-step">
                  <h3>Lịch & đăng ký</h3>
                  <p className="muted">Thời gian nhập theo múi giờ thiết bị; Backend lưu chuẩn UTC. Auctioneer vẫn bắt đầu phòng thủ công.</p>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="liveStart">Bắt đầu dự kiến</label>
                      <input id="liveStart" type="datetime-local" value={draft.scheduledStartAt} onChange={(e) => updateDraft("scheduledStartAt", e.target.value)} required />
                    </div>
                    <div className="field">
                      <label htmlFor="liveEnd">Kết thúc dự kiến (tùy chọn)</label>
                      <input id="liveEnd" type="datetime-local" min={draft.scheduledStartAt} value={draft.scheduledEndAt} onChange={(e) => updateDraft("scheduledEndAt", e.target.value)} />
                    </div>
                  </div>
                  <label className="check-row">
                    <input type="checkbox" checked={draft.registrationOpen} onChange={(e) => updateDraft("registrationOpen", e.target.checked)} />
                    Mở đăng ký khi sự kiện được công bố
                  </label>
                  <p className="live-wizard-note">Hiện hệ thống chỉ lưu trạng thái mở/đóng đăng ký, chưa hỗ trợ hẹn giờ mở và đóng đăng ký riêng.</p>
                </section>
              )}
              {step === 2 && (
                <section className="live-wizard-step">
                  <h3>Danh sách lô</h3>
                  <p className="muted">Chỉ sản phẩm đang chờ, chưa có lượt đấu giá và chưa thuộc lô live khác mới được chọn.</p>
                  <div className="live-product-picker">
                    <input type="search" placeholder="Tìm sản phẩm…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm sản phẩm có thể đưa vào lô" />
                    {productsError && <div className="notice error" role="alert">{productsError}</div>}
                    {productsLoading && <p className="muted" role="status">Đang tải sản phẩm…</p>}
                    {!productsLoading && !productsError && products.length === 0 && <p className="muted">Không tìm thấy sản phẩm đủ điều kiện.</p>}
                    <div className="live-product-options">
                      {products.map((product) => {
                        const selected = lots.some((lot) => lot.productId === product.id);
                        return (
                          <article key={product.id} className="live-product-option">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="live-product-placeholder">Ảnh</span>}
                            <div><b>{product.name}</b><small>{product.sellerName} · Giá gốc {money(product.startingPrice)}</small></div>
                            <button type="button" className="btn secondary" disabled={selected} onClick={() => addProduct(product)}>{selected ? "Đã chọn" : "Thêm"}</button>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                  <div className="live-selected-lots">
                    <h4>Lô đã chọn ({lots.length})</h4>
                    {!lots.length && <p className="muted">Bạn có thể lưu bản nháp chưa có lô, nhưng cần ít nhất một lô để công bố.</p>}
                    {lots.map((lot, index) => (
                      <article key={lot.productId} className="live-selected-lot">
                        <div className="live-selected-lot-head">
                          <b>Lô {String(index + 1).padStart(3, "0")} · {lot.name}</b>
                          <div>
                            <button type="button" className="link-btn" disabled={index === 0} onClick={() => moveLot(index, -1)} aria-label={`Chuyển ${lot.name} lên`}>↑</button>
                            <button type="button" className="link-btn" disabled={index === lots.length - 1} onClick={() => moveLot(index, 1)} aria-label={`Chuyển ${lot.name} xuống`}>↓</button>
                            <button type="button" className="link-btn danger-text" onClick={() => setLots((current) => current.filter((item) => item.productId !== lot.productId))}>Gỡ</button>
                          </div>
                        </div>
                        <div className="form-grid">
                          <div className="field"><label htmlFor={`lot-start-${lot.productId}`}>Giá khởi điểm (VNĐ)</label><MoneyInput id={`lot-start-${lot.productId}`} value={lot.startingPrice} onChange={(val) => updateLot(lot.productId, "startingPrice", val)} placeholder="100.000" required /></div>
                          <div className="field"><label htmlFor={`lot-increment-${lot.productId}`}>Bước giá (VNĐ)</label><MoneyInput id={`lot-increment-${lot.productId}`} value={lot.bidIncrement} onChange={(val) => updateLot(lot.productId, "bidIncrement", val)} placeholder="10.000" required /></div>
                          <div className="field"><label htmlFor={`lot-reserve-${lot.productId}`}>Giá dự trữ (tùy chọn)</label><MoneyInput id={`lot-reserve-${lot.productId}`} value={lot.reservePrice} onChange={(val) => updateLot(lot.productId, "reservePrice", val)} placeholder="Không bắt buộc" /></div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {step === 3 && (
                <section className="live-wizard-step">
                  <h3>Quy tắc & chi phí</h3>
                  <div className="field">
                    <label htmlFor="livePremium">Phí người mua (%)</label>
                    <input id="livePremium" type="number" min="0" max="50" step="0.5" value={draft.buyerPremiumPercent} onChange={(e) => updateDraft("buyerPremiumPercent", e.target.value)} />
                    <small className="muted">Phí hiển thị ở thông tin sự kiện, giới hạn hiện tại từ 0% đến 50%.</small>
                  </div>
                  <div className="live-wizard-note">
                    <b>Quy trình điều hành hiện tại</b>
                    <p>Mỗi lô dùng bước giá đã cấu hình; Auctioneer mở lô, gọi cảnh báo chốt lần 1/lần 2 rồi chốt kết quả. Các quy tắc này đang dùng mặc định chung của hệ thống.</p>
                  </div>
                  <p className="muted">Phí người bán, thời hạn thanh toán riêng và quy tắc chốt tùy chỉnh chưa được lưu bởi mô hình hiện tại.</p>
                </section>
              )}
              {step === 4 && (
                <section className="live-wizard-step">
                  <h3>Nhân sự điều hành</h3>
                  <p className="muted">Theo cấu trúc hiện tại, người tạo sự kiện được ghi nhận là Auctioneer.</p>
                  <div className="live-assignee">
                    <span className="live-assignee-avatar" aria-hidden="true">{(user?.fullName || user?.username || "A").slice(0, 1).toUpperCase()}</span>
                    <div><small>Auctioneer phụ trách</small><b>{user?.fullName || user?.username || "Tài khoản Admin hiện tại"}</b></div>
                    <span className="badge">Admin tạo sự kiện</span>
                  </div>
                  <p className="live-wizard-note">Chưa có API phân công Auctioneer khác hoặc Support; hệ thống sẽ dùng tài khoản Admin đang tạo làm người điều hành được hiển thị.</p>
                </section>
              )}
              {step === 5 && (
                <section className="live-wizard-step">
                  <h3>Kiểm tra & xác nhận</h3>
                  <div className="live-review-card">
                    {draft.bannerUrl && <img className="live-review-banner" src={draft.bannerUrl} alt="" />}
                    <span className="eyebrow">BidNet Live</span>
                    <h4>{draft.title || "Chưa đặt tên sự kiện"}</h4>
                    <p>{draft.description || "Chưa có mô tả."}</p>
                    <div className="live-facts">
                      <span>Bắt đầu: <b>{draft.scheduledStartAt ? new Date(draft.scheduledStartAt).toLocaleString("vi-VN") : "—"}</b></span>
                      <span>Kết thúc: <b>{draft.scheduledEndAt ? new Date(draft.scheduledEndAt).toLocaleString("vi-VN") : "Không đặt"}</b></span>
                      <span>{lots.length} lô</span>
                      <span>Phí người mua {Number(draft.buyerPremiumPercent || 0)}%</span>
                    </div>
                    <p className="muted">Đăng ký: {draft.registrationOpen ? "Mở khi công bố" : "Đang đóng"} · Auctioneer: {user?.fullName || user?.username || "Admin hiện tại"}</p>
                  </div>
                  <h4>Thứ tự lô</h4>
                  {lots.length ? (
                    <ol className="live-review-lots">{lots.map((lot) => <li key={lot.productId}><b>{lot.name}</b><span>{money(lot.startingPrice)} · bước {money(lot.bidIncrement)}</span></li>)}</ol>
                  ) : <p className="muted">Chưa có lô. Bạn vẫn có thể lưu bản nháp, nhưng không thể công bố.</p>}
                  <p className="live-wizard-note">Lưu bản nháp không hiển thị sự kiện công khai. Công bố sẽ đưa sự kiện lên sàn; bắt đầu phiên vẫn là thao tác riêng trong console điều hành.</p>
                </section>
              )}
              {error && <div className="notice error live-wizard-error" role="alert">{error}</div>}
            </div>
            <footer className="live-wizard-footer">
              <button type="button" className="btn secondary" disabled={busy || bannerBusy} onClick={() => step === 0 ? setOpen(false) : setStep((current) => current - 1)}>
                {step === 0 ? "Hủy" : "Quay lại"}
              </button>
              {step < liveWizardSteps.length - 1 ? (
                <button type="button" className="btn dark" disabled={busy || bannerBusy} onClick={nextStep}>Tiếp tục</button>
              ) : (
                <>
                  <button type="button" className="btn secondary" disabled={busy || bannerBusy} onClick={() => persistEvent(false)}>{busy ? "Đang lưu…" : "Lưu bản nháp"}</button>
                  <button type="button" className="btn dark" disabled={busy || bannerBusy || !lots.length} onClick={publish}>{busy ? "Đang xử lý…" : "Công bố sự kiện"}</button>
                </>
              )}
            </footer>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AdminLiveEventDetail({ id, notify }) {
  const event = useRemote(() => api(`/api/admin/live/events/${id}`), [id]);
  const registrations = useRemote(() => api(`/api/admin/live/events/${id}/registrations`), [id]);
  const [addOpen, setAddOpen] = useState(false);
  const [addStartPrice, setAddStartPrice] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = useConfirm();

  useEffect(() => {
    if (!addOpen) { setAddStartPrice(""); return; }
    let alive = true;
    api(`/api/admin/live/products${search ? `?q=${encodeURIComponent(search)}` : ""}`)
      .then((data) => alive && setProducts(data), (e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [addOpen, search]);

  const publish = async () => {
    const accepted = await confirm({
      title: "Xác nhận công bố sự kiện",
      message: "Sự kiện sẽ hiển thị công khai trên sàn. Bạn có chắc chắn muốn công bố?",
      action: "Công bố sự kiện",
    });
    if (!accepted) return;
    setBusy(true); setError("");
    try { await json("POST", `/api/admin/live/events/${id}/publish`); notify("Đã công bố sự kiện."); event.reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const addLot = async (submitEvent) => {
    submitEvent.preventDefault();
    const form = new FormData(submitEvent.currentTarget);
    setBusy(true); setError("");
    try {
      await json("POST", `/api/admin/live/events/${id}/lots`, {
        productId: Number(form.get("productId")),
        startingPrice: Number(form.get("startingPrice")),
        reservePrice: form.get("reservePrice") ? Number(form.get("reservePrice")) : null,
        bidIncrement: Number(form.get("bidIncrement")),
      });
      notify("Đã thêm lô vào sự kiện.");
      setAddOpen(false);
      event.reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const remove = async (lot) => {
    if (!await confirm({ title: "Xóa lô khỏi sự kiện", message: `Lô ${String(lot.lotNumber).padStart(3, "0")} · ${lot.title} sẽ bị gỡ khỏi danh sách.`, action: "Xóa lô", danger: true })) return;
    try { await api(`/api/admin/live/lots/${lot.id}`, { method: "DELETE" }); event.reload(); notify("Đã xóa lô."); }
    catch (e) { notify(e.message); }
  };
  const e = event.data;
  return (
    <>
      {event.error && <ErrorState message={event.error} onRetry={event.reload} />}
      {event.loading && <LoadingState />}
      {e && (
        <>
          <PageHeader eyebrow={`${e.code} · ${eventStatusText[e.status]}`} title={e.title} description={e.description}>
            <a className="btn secondary" href="#/admin/live">← Danh sách</a>
            {e.status !== "Draft" && <a className="btn dark" href={`#/admin/live/${id}/control`}>Mở console điều hành</a>}
          </PageHeader>
          <div className="admin-metrics">
            <section className="panel"><h2>Tổng lô</h2><strong>{e.lotCount}</strong></section>
            <section className="panel"><h2>Đã bán</h2><strong>{e.soldCount}</strong></section>
            <section className="panel"><h2>Đăng ký</h2><strong>{e.registrationCount}</strong></section>
            <section className="panel"><h2>Lịch</h2><small>{date(e.scheduledStartAt)}</small></section>
          </div>
          {error && <div className="notice error" role="alert">{error}</div>}
          <div className="actions admin-detail-actions">
            {e.status === "Draft" && <button className="btn" disabled={busy} onClick={publish}>Công bố sự kiện</button>}
            {["Draft", "Published", "Live"].includes(e.status) && <button className="btn secondary" onClick={() => { setAddOpen(true); setError(""); }}>+ Thêm lô</button>}
            <a className="btn ghost" href={`#/live-room/${id}`} target="_blank" rel="noreferrer">Xem phòng ↗</a>
          </div>
          <div className="panel table-wrap">
            <h2>Danh sách lô</h2>
            <table className="table">
              <thead><tr><th>Lô</th><th>Sản phẩm</th><th>Khởi điểm</th><th>Hiện tại</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>
                {e.lots.map((lot) => (
                  <tr key={lot.id}>
                    <td>#{String(lot.lotNumber).padStart(3, "0")}</td>
                    <td>{lot.title}<small className="muted"> · {lot.sellerName}</small></td>
                    <td>{money(lot.startingPrice)}</td>
                    <td>{money(lot.currentPrice)}</td>
                    <td><span className={`badge ${lot.status}`}>{lotStatusText[lot.status]}</span></td>
                    <td>{lot.status === "Pending" && <button className="link-btn" onClick={() => remove(lot)}>Xóa</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!e.lots.length && <EmptyState title="Chưa có lô" description="Thêm sản phẩm đang chờ để xếp vào sự kiện." />}
          </div>
          <div className="panel">
            <h2>Người đăng ký ({registrations.data?.length ?? 0})</h2>
            {registrations.data?.length ? (
              <table className="table">
                <thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Trạng thái</th><th>Thời điểm</th></tr></thead>
                <tbody>{registrations.data.map((r) => (
                  <tr key={r.id}><td>{r.username}</td><td>{r.fullName || "—"}</td><td>{r.status}</td><td>{date(r.createdAt)}</td></tr>
                ))}</tbody>
              </table>
            ) : <p className="muted">Chưa có người đăng ký.</p>}
          </div>
        </>
      )}
      {addOpen && (
        <Modal title="Thêm lô từ sản phẩm" onClose={() => setAddOpen(false)} busy={busy}>
          <p className="muted">Chỉ hiện sản phẩm đang chờ, chưa có lượt đặt giá và chưa thuộc lô đấu giá trực tiếp nào.</p>
          <input type="search" placeholder="Tìm sản phẩm…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm sản phẩm" />
          <form onSubmit={addLot}>
            <div className="field">
              <label htmlFor="lotProduct">Sản phẩm</label>
              <select
                id="lotProduct"
                name="productId"
                required
                onChange={(e) => {
                  const chosen = products.find((p) => String(p.id) === e.target.value);
                  if (chosen) setAddStartPrice(String(chosen.startingPrice || ""));
                }}
              >
                <option value="">Chọn sản phẩm</option>
                {products.map((p) => <option key={p.id} value={p.id}>#{p.id} · {p.name} · {p.sellerName} · {money(p.startingPrice)}</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="field"><label htmlFor="lotStart">Giá khởi điểm (VNĐ)</label><MoneyInput id="lotStart" name="startingPrice" value={addStartPrice} onChange={setAddStartPrice} placeholder="100.000" required /></div>
              <div className="field"><label htmlFor="lotStep">Bước giá (VNĐ)</label><MoneyInput id="lotStep" name="bidIncrement" defaultValue="1000" placeholder="1.000" required /></div>
            </div>
            <div className="field"><label htmlFor="lotReserve">Giá dự trữ (tùy chọn)</label><MoneyInput id="lotReserve" name="reservePrice" placeholder="Không bắt buộc" /></div>
            {error && <div className="notice error" role="alert">{error}</div>}
            <div className="dialog-actions">
              <button type="button" className="btn secondary" onClick={() => setAddOpen(false)}>Hủy</button>
              <button className="btn dark" disabled={busy || !products.length}>{busy ? "Đang thêm…" : "Thêm lô"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function AdminLiveConsole({ id, notify }) {
  const snap = useRemote(() => api(`/api/live/events/${id}/snapshot`), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const data = snap.data;
  const event = data?.event;
  const current = event?.lots.find((lot) => lot.id === event.currentLotId) || null;
  const next = event?.lots.find((lot) => lot.status === "Pending") || null;

  const action = async (path, body) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await json("POST", path, body);
      await snap.reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const skip = async (lot) => {
    setBusy(true); setError("");
    try { await api(`/api/admin/live/lots/${lot.id}/skip`, { method: "POST" }); await snap.reload(); notify(`Đã bỏ qua lô ${String(lot.lotNumber).padStart(3, "0")}.`); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const announce = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!message.trim()) return;
    setBusy(true); setError("");
    try { await json("POST", `/api/admin/live/events/${id}/announcement`, { message }); setMessage(""); notify("Đã gửi thông báo tới phòng."); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="live-console">
      <PageHeader eyebrow="BidNet Live Control" title={event?.title || "Console điều hành"} description={`${event?.code || ""} · Người điều hành chỉ thao tác trên lô đang mở, mọi thay đổi được phát realtime tới phòng.`}>
        <a className="btn secondary" href={`#/admin/live/${id}`}>← Quản lý sự kiện</a>
        <a className="btn ghost" href={`#/live-room/${id}`} target="_blank" rel="noreferrer">Mở phòng ↗</a>
      </PageHeader>
      {snap.error && <ErrorState message={snap.error} onRetry={snap.reload} />}
      {snap.loading && <LoadingState />}
      {data && (
        <>
          <div className="admin-metrics">
            <section className="panel"><h2>Sự kiện</h2><strong>{eventStatusText[event.status]}</strong></section>
            <section className="panel"><h2>Lô đang mở</h2><strong>{current ? `#${String(current.lotNumber).padStart(3, "0")}` : "—"}</strong></section>
            <section className="panel"><h2>Lượt đặt lô này</h2><strong>{current?.bidCount ?? 0}</strong></section>
            <section className="panel"><h2>Người dẫn đầu</h2><strong>{current?.leadingBidderCode || "—"}</strong></section>
          </div>
          {error && <div className="notice error" role="alert">{error}</div>}
          <div className="live-console-grid">
            <section className="panel">
              <h2>Điều khiển lô hiện tại</h2>
              {current ? (
                <>
                  <div className="live-console-lot">
                    <span className="eyebrow">Lô {String(current.lotNumber).padStart(3, "0")}</span>
                    <strong>{current.title}</strong>
                    <p>{money(current.currentPrice)} · {current.bidCount} lượt · cảnh báo: {current.callingStage}</p>
                  </div>
                  <div className="live-console-actions">
                    <button className="btn secondary" disabled={busy} onClick={() => action(`/api/admin/live/lots/${current.id}/warning`)}>Cảnh báo chốt</button>
                    <button className="btn" disabled={busy} onClick={() => action(`/api/admin/live/lots/${current.id}/close`)}>Chốt bán</button>
                    <button className="btn danger" disabled={busy} onClick={() => { if (confirm("Chốt lô này là không bán được?")) action(`/api/admin/live/lots/${current.id}/close?forceUnsold=true`); }}>Không bán được</button>
                  </div>
                </>
              ) : (
                <p className="muted">Chưa có lô đang mở.</p>
              )}
              <hr />
              <h2>Lô kế tiếp</h2>
              {next ? (
                <div className="live-console-next">
                  <div><strong>Lô {String(next.lotNumber).padStart(3, "0")} · {next.title}</strong><small>{money(next.startingPrice)}</small></div>
                  <button className="btn dark" disabled={busy || Boolean(current)} onClick={() => action(`/api/admin/live/lots/${next.id}/open`)}>
                    {current ? "Hãy chốt lô đang mở" : "Mở đấu giá lô này"}
                  </button>
                  <button className="btn secondary" disabled={busy || Boolean(current)} onClick={() => skip(next)}>Bỏ qua</button>
                </div>
              ) : <p className="muted">Không còn lô chờ mở.</p>}
            </section>
            <section className="panel">
              <h2>Điều khiển sự kiện</h2>
              <div className="live-console-actions">
                {event.status === "Published" && <button className="btn" disabled={busy || !next} onClick={() => action(`/api/admin/live/lots/${next.id}/open`)}>Bắt đầu sự kiện</button>}
                {event.status === "Live" && <button className="btn secondary" disabled={busy} onClick={() => action(`/api/admin/live/events/${id}/pause`)}>Tạm dừng</button>}
                {event.status === "Paused" && <button className="btn" disabled={busy} onClick={() => action(`/api/admin/live/events/${id}/resume`)}>Tiếp tục</button>}
                {["Live", "Paused", "Published"].includes(event.status) && <button className="btn danger" disabled={busy || Boolean(current)} onClick={() => { if (confirm("Kết thúc toàn bộ sự kiện?")) action(`/api/admin/live/events/${id}/complete`); }}>Kết thúc sự kiện</button>}
              </div>
              <form onSubmit={announce}>
                <div className="field"><label htmlFor="announcement">Thông báo tới phòng</label><textarea id="announcement" value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} placeholder="Ví dụ: Lô tiếp theo sẽ mở sau 2 phút." /></div>
                <button className="btn secondary" disabled={busy || !message.trim()}>Gửi thông báo</button>
              </form>
            </section>
          </div>
          <section className="panel">
            <h2>Danh sách lô</h2>
            <table className="table">
              <thead><tr><th>Lô</th><th>Sản phẩm</th><th>Giá</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>{event.lots.map((lot) => (
                <tr key={lot.id}>
                  <td>#{String(lot.lotNumber).padStart(3, "0")}</td>
                  <td>{lot.title}</td>
                  <td>{money(lot.currentPrice)}</td>
                  <td><span className={`badge ${lot.status}`}>{lotStatusText[lot.status]}</span></td>
                  <td>
                    {lot.status === "Pending" && !current && <button className="link-btn" disabled={busy} onClick={() => action(`/api/admin/live/lots/${lot.id}/open`)}>Mở lô</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
