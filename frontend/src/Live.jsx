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
    `AuctoraLive_${id}`,
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
          <span className="eyebrow">Auctora Live · Đấu giá trực tiếp</span>
          <h1>Phòng đấu giá có người điều hành</h1>
          <p>
            Theo dõi từng lô được mở lần lượt, đặt giá theo thời gian thực và nhận
            kết quả ngay khi người điều hành chốt. Phòng đấu giá mở trong cửa sổ
            riêng để bạn vừa theo dõi vừa dùng Auctora.
          </p>
          <div className="actions">
            <a className="btn dark" href="#/live-auctions?status=Live">Xem phiên đang diễn ra</a>
            <a className="btn secondary" href="#/my-live-requests">Đưa sản phẩm vào đấu giá trực tiếp</a>
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
        <EmptyState title="Chưa có sự kiện đấu giá trực tiếp" description="Các sự kiện do Auctora tổ chức sẽ xuất hiện tại đây." />
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
              <p className="muted">{event.description || "Sự kiện đấu giá trực tiếp do Auctora tổ chức."}</p>
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
    let retryTimer;
    let retryDelay = 1000;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/live`, { accessTokenFactory: () => getSession()?.accessToken || "" })
      .withAutomaticReconnect()
      .build();
    const refresh = () => reloadRef.current();
    const scheduleConnect = () => {
      if (!alive || retryTimer) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };
    const connect = async () => {
      if (!alive) return;
      try {
        if (connection.state === signalR.HubConnectionState.Disconnected) await connection.start();
        if (connection.state !== signalR.HubConnectionState.Connected) return;
        const count = await connection.invoke("JoinEvent", id);
        if (alive) {
          setConnected(true);
          setViewerCount(count);
          retryDelay = 1000;
          refresh();
        }
      } catch {
        if (alive) setConnected(false);
        scheduleConnect();
      }
    };
    connection.onreconnecting(() => alive && setConnected(false));
    connection.onreconnected(async () => {
      try {
        const count = await connection.invoke("JoinEvent", id);
        if (alive) { setConnected(true); setViewerCount(count); refresh(); }
      } catch {
        if (alive) setConnected(false);
        scheduleConnect();
      }
    });
    connection.onclose(() => {
      if (alive) setConnected(false);
      scheduleConnect();
    });
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
    connect();
    return () => {
      alive = false;
      window.clearTimeout(retryTimer);
      connection.stop();
    };
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
        <a className="brand" href="#/" aria-label="Auctora">Auc<span>tora</span> <small>LIVE</small></a>
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
const liveRequestStatusText = {
  PendingReview: "Chờ duyệt",
  Reviewing: "Đang xét duyệt",
  RevisionRequested: "Cần bổ sung",
  AwaitingSellerConfirmation: "Chờ bạn xác nhận",
  Approved: "Đã duyệt",
  Rejected: "Từ chối",
  Withdrawn: "Đã rút",
  Scheduled: "Đã xếp lịch",
  Live: "Đang đấu giá",
  Completed: "Đã kết thúc",
};
const sellerProductStatusText = {
  Draft: "Bản nháp",
  Scheduled: "Chưa bắt đầu",
  Cancelled: "Đã hủy phiên cũ",
};

function RequestStatus({ status }) {
  return <span className={`badge live-request-status ${status}`}>{liveRequestStatusText[status] || status}</span>;
}

async function loadSellerLiveRequestResource(path) {
  try {
    return await api(path);
  } catch (error) {
    if (error.status === 404) {
      throw new Error(
        `Backend tại ${API_BASE} đang chạy phiên bản chưa có API yêu cầu Live Auction. Hãy cập nhật và khởi động lại backend; nếu vừa cập nhật schema, áp dụng các migration Live Auction trước.`,
      );
    }
    throw error;
  }
}

export function SellerLiveRequests({ notify, route }) {
  const requests = useRemote(() => loadSellerLiveRequestResource("/api/me/live-requests"), []);
  const eligible = useRemote(() => loadSellerLiveRequestResource("/api/me/live-requests/eligible-products"), []);
  const events = useRemote(() => api("/api/live/events?status=Published"), []);
  const autoOpenedRoute = useRef("");
  const [dialog, setDialog] = useState(null);
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [bidIncrement, setBidIncrement] = useState("1000");
  const [preferredEventId, setPreferredEventId] = useState("");
  const [sellerNote, setSellerNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedProduct = eligible.data?.find((product) => String(product.id) === productId);
  const canConfigureRequest = dialog?.mode !== "create" ||
    Boolean(selectedProduct && !eligible.loading && !eligible.error);
  const filteredEligibleProducts = (eligible.data || []).filter((product) =>
    `${product.id} ${product.name} ${product.category || ""}`.toLowerCase().includes(productSearch.trim().toLowerCase()));
  const requestedProductId = new URLSearchParams(route?.split("?")[1] || "").get("productId");

  useEffect(() => {
    if (!requestedProductId || !eligible.data || autoOpenedRoute.current === route) return;
    autoOpenedRoute.current = route;
    setDialog({ mode: "create" });
    setProductSearch("");
    setReservePrice("");
    setBidIncrement("1000");
    setPreferredEventId("");
    setSellerNote("");
    setConsent(false);
    const product = eligible.data.find((item) => String(item.id) === requestedProductId);
    if (product) {
      setProductId(String(product.id));
      setStartingPrice(String(product.startingPrice));
      setBidIncrement(String(product.suggestedBidIncrement));
      setError("");
    } else {
      setProductId("");
      setStartingPrice("");
      setError(`Sản phẩm #${requestedProductId} hiện không đủ điều kiện. Hãy chọn một sản phẩm khác trong danh sách.`);
    }
  }, [eligible.data, requestedProductId, route]);

  const openNew = () => {
    setDialog({ mode: "create" });
    setProductId("");
    setProductSearch("");
    setStartingPrice("");
    setReservePrice("");
    setBidIncrement("1000");
    setPreferredEventId("");
    setSellerNote("");
    setConsent(false);
    setError("");
  };
  const openResubmit = (request) => {
    setDialog({ mode: "update", request });
    setProductId(String(request.productId));
    setStartingPrice(String(request.proposedStartingPrice));
    setReservePrice(request.proposedReservePrice == null ? "" : String(request.proposedReservePrice));
    setBidIncrement(String(request.proposedBidIncrement));
    setPreferredEventId("");
    setSellerNote(request.sellerNote || "");
    setConsent(true);
    setError("");
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (dialog.mode === "create" &&
        (!selectedProduct || eligible.loading || eligible.error || selectedProduct.id !== Number(productId))) {
      setError("Hãy tải và chọn một sản phẩm đủ điều kiện trước khi tiếp tục.");
      return;
    }
    setBusy(true);
    setError("");
    const body = {
      proposedStartingPrice: Number(startingPrice),
      proposedReservePrice: reservePrice ? Number(reservePrice) : null,
      proposedBidIncrement: Number(bidIncrement),
      sellerNote: sellerNote.trim() || null,
    };
    try {
      if (dialog.mode === "create") {
        await json("POST", "/api/me/live-requests", {
          ...body,
          productId: Number(productId),
          preferredEventId: preferredEventId ? Number(preferredEventId) : null,
          sellerConsent: consent,
        });
        notify("Đã gửi yêu cầu đấu giá trực tiếp đến Admin.");
      } else {
        await json("PUT", `/api/me/live-requests/${dialog.request.id}`, body);
        notify("Đã bổ sung và gửi lại yêu cầu.");
      }
      setDialog(null);
      requests.reload();
      eligible.reload();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  };
  const confirmTerms = async (request) => {
    setBusy(true);
    try {
      await json("POST", `/api/me/live-requests/${request.id}/confirm`, {});
      notify("Đã xác nhận điều kiện đấu giá trực tiếp.");
      requests.reload();
      eligible.reload();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async (request) => {
    if (!window.confirm(`Rút yêu cầu ${request.requestCode}?`)) return;
    setBusy(true);
    try {
      await api(`/api/me/live-requests/${request.id}/withdraw`, { method: "POST" });
      notify("Đã rút yêu cầu.");
      requests.reload();
      eligible.reload();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="live-request-page">
      <PageHeader eyebrow="Dành cho người bán" title="Yêu cầu đấu giá trực tiếp" description="Gửi sản phẩm để Auctora xét duyệt. Sản phẩm chỉ được xếp lô sau khi Admin duyệt và bạn xác nhận đúng điều kiện đã thống nhất.">
        <button className="btn dark" onClick={openNew}>+ Gửi yêu cầu</button>
      </PageHeader>
      {requests.error && !dialog && <ErrorState message={requests.error} onRetry={requests.reload} />}
      {requests.loading && <LoadingState />}
      {!requests.loading && requests.data && (
        <section className="panel table-wrap">
          <div className="live-request-section-head">
            <div><h2>Yêu cầu của bạn</h2><p className="muted">Theo dõi tiến độ xét duyệt và lịch tổ chức.</p></div>
            <button type="button" className="btn secondary" onClick={requests.reload}>Làm mới</button>
          </div>
          {requests.data.length ? (
            <table className="table live-request-table">
              <thead><tr><th>Yêu cầu / Sản phẩm</th><th>Điều kiện đề xuất</th><th>Trạng thái</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
              <tbody>{requests.data.map((request) => (
                <tr key={request.id}>
                  <td><strong>{request.productName}</strong><small>{request.requestCode} · #{request.productId}</small></td>
                  <td>{money(request.proposedStartingPrice)} · bước {money(request.proposedBidIncrement)}<small>Dự trữ: {request.proposedReservePrice == null ? "Không có" : money(request.proposedReservePrice)}</small></td>
                  <td><RequestStatus status={request.status} />{request.adminNote && <small className="live-request-note">{request.adminNote}</small>}{request.rejectReason && <small className="live-request-note">{request.rejectReason}</small>}</td>
                  <td>{date(request.createdAt)}{request.scheduledEventTitle && <small>{request.scheduledEventTitle}</small>}</td>
                  <td><div className="live-request-actions">
                    {request.status === "AwaitingSellerConfirmation" && <button className="btn sm dark" disabled={busy} onClick={() => confirmTerms(request)}>Xác nhận</button>}
                    {request.status === "RevisionRequested" && <button className="btn sm secondary" disabled={busy} onClick={() => openResubmit(request)}>Bổ sung</button>}
                    {["PendingReview", "Reviewing", "RevisionRequested", "AwaitingSellerConfirmation", "Approved"].includes(request.status) && <button className="link-btn danger-text" disabled={busy} onClick={() => withdraw(request)}>Rút yêu cầu</button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <EmptyState title="Bạn chưa gửi yêu cầu nào" description="Chọn bản nháp, sản phẩm sắp đấu giá chưa có lượt đặt hoặc phiên cũ đã hủy hợp lệ để đề xuất tham gia Live Auction." />}
        </section>
      )}
      {dialog && (
        <Modal className="live-request-dialog" title={dialog.mode === "create" ? "Yêu cầu đấu giá trực tiếp" : `Bổ sung ${dialog.request.requestCode}`} onClose={() => setDialog(null)} busy={busy}>
          <form onSubmit={submit} className="live-request-form">
            {requests.error && !eligible.error && <ErrorState message={requests.error} onRetry={requests.reload} />}
            {dialog.mode === "create" ? (
              <>
                {eligible.error && <ErrorState message={eligible.error} onRetry={eligible.reload} />}
                {eligible.loading && <p className="muted" role="status">Đang kiểm tra sản phẩm đủ điều kiện…</p>}
                {!eligible.loading && !eligible.error && eligible.data?.length === 0 && (
                  <EmptyState title="Bạn chưa có sản phẩm đủ điều kiện" description="Có thể chọn bản nháp, sản phẩm sắp đấu giá chưa có lượt đặt hoặc phiên cũ đã hủy hợp lệ. Sản phẩm đang đấu giá, đã bán hoặc đã gửi yêu cầu Live sẽ không thể chọn.">
                    <a className="btn dark" href="#/product/new">+ Đăng sản phẩm mới</a>
                  </EmptyState>
                )}
                {eligible.data?.length > 0 && <>
                  <div className="field">
                    <label htmlFor="liveRequestProductSearch">Chọn đúng sản phẩm muốn đưa vào đấu giá trực tiếp</label>
                    <input
                      id="liveRequestProductSearch"
                      type="search"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Tìm theo tên, mã hoặc danh mục…"
                    />
                    <small className="muted">{filteredEligibleProducts.length} sản phẩm đủ điều kiện</small>
                  </div>
                  {filteredEligibleProducts.length ? (
                    <div className="live-request-product-list" role="group" aria-label="Sản phẩm đủ điều kiện">
                      {filteredEligibleProducts.map((product) => {
                        const selected = String(product.id) === productId;
                        return (
                          <button
                            key={product.id}
                            type="button"
                            className={`live-request-product-choice${selected ? " selected" : ""}`}
                            aria-pressed={selected}
                            disabled={eligible.loading || Boolean(eligible.error)}
                            onClick={() => {
                              setProductId(String(product.id));
                              setStartingPrice(String(product.startingPrice));
                              setBidIncrement(String(product.suggestedBidIncrement));
                              setError("");
                            }}
                          >
                            {product.imageUrl
                              ? <img src={product.imageUrl} alt="" />
                              : <span className="live-request-product-placeholder" aria-hidden="true">Ảnh</span>}
                            <span className="live-request-product-copy">
                              <strong>{product.name}</strong>
                              <small>Sản phẩm #{product.id} · {product.category || "Chưa phân loại"}</small>
                              <span>Giá hiện tại: <b>{money(product.currentPrice)}</b> · Giá khởi điểm {money(product.startingPrice)}</span>
                              <small>Chủ sở hữu: {product.sellerName} · Trạng thái: {sellerProductStatusText[product.status] || product.status}</small>
                              <small>Bước giá gợi ý: {money(product.suggestedBidIncrement)}</small>
                              <small>{product.status === "Cancelled" ? "Ngày mở phiên cũ" : "Dự kiến mở"}: {date(product.startTime)}</small>
                            </span>
                            <span className="live-request-product-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted" role="status">Không tìm thấy sản phẩm khớp với “{productSearch}”.</p>
                  )}
                </>}
                {selectedProduct && <div className="live-request-product-summary">
                  {selectedProduct.imageUrl && <img src={selectedProduct.imageUrl} alt="" />}
                  <div><span className="eyebrow">ĐÃ CHỌN · SẢN PHẨM #{selectedProduct.id}</span><strong>{selectedProduct.name}</strong><small>{selectedProduct.category || "Chưa phân loại"} · Chủ sở hữu: {selectedProduct.sellerName}</small><small>Giá hiện tại {money(selectedProduct.currentPrice)} · Giá khởi điểm {money(selectedProduct.startingPrice)} · {sellerProductStatusText[selectedProduct.status] || selectedProduct.status}</small></div>
                </div>}
              </>
            ) : <div className="live-request-product-summary">
              {dialog.request.productImageUrl && <img src={dialog.request.productImageUrl} alt="" />}
              <div><strong>{dialog.request.productName}</strong><small>{dialog.request.requestCode} · #{dialog.request.productId}</small></div>
            </div>}
            {!canConfigureRequest ? (
              <>
                {error && <div className="notice error" role="alert">{error}</div>}
                {!eligible.loading && !eligible.error && eligible.data?.length > 0 && (
                  <p className="live-request-selection-prompt">Chọn một sản phẩm ở trên để tiếp tục. Chưa chọn sản phẩm thì chưa thể nhập giá hoặc gửi yêu cầu.</p>
                )}
                <div className="dialog-actions live-request-dialog-footer">
                  <button type="button" className="btn secondary" disabled={busy} onClick={() => setDialog(null)}>Hủy</button>
                  <button type="button" className="btn dark" disabled>Chọn sản phẩm trước</button>
                </div>
              </>
            ) : (
              <>
            <div className="form-grid">
              <div className="field"><label htmlFor="requestStartingPrice">Giá khởi điểm đề xuất</label><MoneyInput id="requestStartingPrice" value={startingPrice} onChange={setStartingPrice} required /></div>
              <div className="field"><label htmlFor="requestBidIncrement">Bước giá đề xuất</label><MoneyInput id="requestBidIncrement" value={bidIncrement} onChange={setBidIncrement} required /></div>
              <div className="field"><label htmlFor="requestReservePrice">Giá dự trữ (tùy chọn)</label><MoneyInput id="requestReservePrice" value={reservePrice} onChange={setReservePrice} /></div>
              {dialog.mode === "create" && <div className="field">
                <label htmlFor="preferredLiveEvent">Sự kiện mong muốn</label>
                <select id="preferredLiveEvent" value={preferredEventId} onChange={(e) => setPreferredEventId(e.target.value)}>
                  <option value="">Để Auctora sắp xếp</option>
                  {(events.data || []).map((event) => <option key={event.id} value={event.id}>{event.title} · {date(event.scheduledStartAt)}</option>)}
                </select>
              </div>}
            </div>
            <div className="field"><label htmlFor="liveSellerNote">Ghi chú cho bộ phận tổ chức</label><textarea id="liveSellerNote" maxLength={1000} value={sellerNote} onChange={(e) => setSellerNote(e.target.value)} placeholder="Tình trạng, lịch mong muốn hoặc thông tin cần lưu ý…" /></div>
            {dialog.mode === "create" && <label className="check-row live-request-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Tôi đồng ý chuyển sản phẩm khỏi đấu giá theo thời gian trong lúc xét duyệt và đề xuất sản phẩm tham gia đấu giá trực tiếp theo các điều kiện trên.
            </label>}
            <div className="live-wizard-note">Sản phẩm không được đưa vào phòng đấu giá ngay khi gửi yêu cầu. Nếu Admin thay đổi giá hoặc điều kiện quan trọng, bạn phải xác nhận lại.</div>
            {error && <div className="notice error" role="alert">{error}</div>}
            <div className="dialog-actions">
              <button type="button" className="btn secondary" disabled={busy} onClick={() => setDialog(null)}>Hủy</button>
              <button className="btn dark" disabled={busy || (dialog.mode === "create" && (!consent || !productId || eligible.loading || eligible.error))}>{busy ? "Đang gửi…" : dialog.mode === "create" ? "Gửi yêu cầu" : "Gửi bổ sung"}</button>
            </div>
              </>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

export function AdminLiveRequests({ notify }) {
  const requests = useRemote(() => api("/api/admin/live-requests"), []);
  const inventory = useRemote(() => api("/api/admin/live-inventory"), []);
  const [tab, setTab] = useState("requests");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [startingPrice, setStartingPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [bidIncrement, setBidIncrement] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pendingCount = requests.data?.filter((item) => item.status === "PendingReview").length || 0;
  const filtered = (requests.data || []).filter((item) =>
    (status === "All" || item.status === status) &&
    (!search || `${item.requestCode} ${item.productName} ${item.sellerName}`.toLowerCase().includes(search.toLowerCase())));

  const openRequest = async (request) => {
    setSelected(request);
    setStartingPrice(String(request.proposedStartingPrice));
    setReservePrice(request.proposedReservePrice == null ? "" : String(request.proposedReservePrice));
    setBidIncrement(String(request.proposedBidIncrement));
    setAdminNote(request.adminNote || "");
    setMessage("");
    setError("");
    if (request.status === "PendingReview" || request.status === "RevisionRequested") {
      setBusy(true);
      try {
        const accepted = await json("POST", `/api/admin/live-requests/${request.id}/review`, {});
        setSelected(accepted);
        requests.reload();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }
  };
  const applyAction = async (kind) => {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      let updated;
      if (kind === "approve") {
        updated = await json("POST", `/api/admin/live-requests/${selected.id}/approve`, {
          proposedStartingPrice: Number(startingPrice),
          proposedReservePrice: reservePrice ? Number(reservePrice) : null,
          proposedBidIncrement: Number(bidIncrement),
          adminNote: adminNote.trim() || null,
        });
      } else {
        updated = await json("POST", `/api/admin/live-requests/${selected.id}/${kind}`, { message });
      }
      setSelected(updated);
      requests.reload();
      inventory.reload();
      notify(kind === "approve" ? updated.status === "Approved" ? "Đã duyệt và đưa sản phẩm vào kho Live." : "Đã gửi điều kiện mới để người bán xác nhận." : kind === "reject" ? "Đã từ chối yêu cầu." : "Đã yêu cầu người bán bổ sung thông tin.");
      if (kind !== "approve") setSelected(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="live-request-page">
      <PageHeader eyebrow="Quy trình người bán" title="Yêu cầu đấu giá trực tiếp" description="Kiểm tra sự đồng ý, quyền sở hữu và điều kiện bán trước khi đưa sản phẩm vào kho Live Auction.">
        <a className="btn secondary" href="#/admin/live">Quản lý sự kiện</a>
      </PageHeader>
      <div className="live-request-tabs" role="tablist">
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>Yêu cầu từ người bán <b>{pendingCount}</b></button>
        <button className={tab === "inventory" ? "active" : ""} onClick={() => { setTab("inventory"); inventory.reload(); }}>Kho đã duyệt <b>{inventory.data?.length ?? 0}</b></button>
      </div>
      {tab === "requests" ? (
        <>
          {requests.error && <ErrorState message={requests.error} onRetry={requests.reload} />}
          {requests.loading && <LoadingState />}
          {requests.data && <>
            <div className="live-request-toolbar">
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm sản phẩm, người bán, mã yêu cầu…" aria-label="Tìm yêu cầu Live Auction" />
              <select aria-label="Lọc trạng thái yêu cầu" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="All">Tất cả trạng thái</option>
                {Object.entries(liveRequestStatusText).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            {filtered.length ? <div className="panel table-wrap">
              <table className="table live-request-table">
                <thead><tr><th>Mã / Sản phẩm</th><th>Người bán</th><th>Điều kiện đề xuất</th><th>Trạng thái</th><th>Ngày gửi</th><th /></tr></thead>
                <tbody>{filtered.map((request) => (
                  <tr key={request.id}>
                    <td><strong>{request.requestCode}</strong><small>{request.productName} · #{request.productId}</small></td>
                    <td><strong>{request.sellerName}</strong><small>User #{request.sellerId}</small></td>
                    <td>{money(request.proposedStartingPrice)}<small>Bước {money(request.proposedBidIncrement)} · Dự trữ {request.proposedReservePrice == null ? "—" : money(request.proposedReservePrice)}</small></td>
                    <td><RequestStatus status={request.status} /></td>
                    <td>{date(request.createdAt)}</td>
                    <td><button className="btn sm secondary" onClick={() => openRequest(request)}>{["PendingReview", "Reviewing", "RevisionRequested"].includes(request.status) ? "Xét duyệt" : "Chi tiết"}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div> : <EmptyState title="Không có yêu cầu phù hợp" description={search ? "Thử từ khóa hoặc trạng thái khác." : "Khi người bán gửi yêu cầu, hồ sơ sẽ xuất hiện tại đây."} />}
          </>}
        </>
      ) : (
        <>
          {inventory.error && <ErrorState message={inventory.error} onRetry={inventory.reload} />}
          {inventory.loading && <LoadingState />}
          {inventory.data && (inventory.data.length ? <div className="live-inventory-grid">
            {inventory.data.map((item) => (
              <article className="panel live-inventory-card" key={item.requestId}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="live-inventory-placeholder">Ảnh sản phẩm</div>}
                <div><span className="eyebrow">{item.requestCode} · #{item.id}</span><h2>{item.name}</h2><p>{item.sellerName} · User #{item.sellerId}</p><small>{item.category || "Chưa phân loại"}</small></div>
                <dl><div><dt>Khởi điểm</dt><dd>{money(item.startingPrice)}</dd></div><div><dt>Bước giá</dt><dd>{money(item.bidIncrement)}</dd></div><div><dt>Dự trữ</dt><dd>{item.reservePrice == null ? "—" : money(item.reservePrice)}</dd></div></dl>
                <a className="btn secondary" href="#/admin/live">Chọn trong sự kiện</a>
              </article>
            ))}
          </div> : <EmptyState title="Kho Live đang trống" description="Chỉ các yêu cầu được duyệt và người bán đã xác nhận mới xuất hiện trong kho."><button className="btn secondary" onClick={() => setTab("requests")}>Xem yêu cầu từ người bán</button></EmptyState>)}
        </>
      )}
      {selected && (
        <Modal title={`Xét duyệt ${selected.requestCode}`} onClose={() => setSelected(null)} busy={busy}>
          <div className="live-request-review-grid">
            <section className="live-request-review-card">
              {selected.productImageUrl && <img src={selected.productImageUrl} alt="" />}
              <div><h3>{selected.productName}</h3><span>{selected.category || "Chưa phân loại"} · Product #{selected.productId}</span></div>
            </section>
            <section className="live-request-review-card seller">
              {selected.sellerAvatarUrl ? <img src={selected.sellerAvatarUrl} alt="" /> : <span className="live-seller-avatar">{selected.sellerName.slice(0, 1).toUpperCase()}</span>}
              <div><strong>{selected.sellerName}</strong><span>User ID #{selected.sellerId}</span><span>{selected.reviewerName ? `Phụ trách: ${selected.reviewerName}` : "Chưa tiếp nhận"}</span></div>
            </section>
          </div>
          <div className="live-request-current-status"><RequestStatus status={selected.status} />{selected.preferredEventTitle && <span>Sự kiện mong muốn: {selected.preferredEventTitle}</span>}</div>
          <div className="form-grid">
            <div className="field"><label htmlFor="adminStartingPrice">Giá khởi điểm đề xuất</label><MoneyInput id="adminStartingPrice" value={startingPrice} onChange={setStartingPrice} disabled={!["Reviewing", "PendingReview"].includes(selected.status)} required /></div>
            <div className="field"><label htmlFor="adminBidIncrement">Bước giá</label><MoneyInput id="adminBidIncrement" value={bidIncrement} onChange={setBidIncrement} disabled={!["Reviewing", "PendingReview"].includes(selected.status)} required /></div>
            <div className="field"><label htmlFor="adminReservePrice">Giá dự trữ</label><MoneyInput id="adminReservePrice" value={reservePrice} onChange={setReservePrice} disabled={!["Reviewing", "PendingReview"].includes(selected.status)} /></div>
          </div>
          <div className="live-request-detail-notes"><p><b>Ghi chú người bán:</b> {selected.sellerNote || "Không có"}</p><p><b>Phản hồi Admin:</b> {selected.adminNote || selected.rejectReason || "Chưa có"}</p></div>
          {["Reviewing", "PendingReview"].includes(selected.status) && <>
            <div className="field"><label htmlFor="liveAdminNote">Ghi chú xét duyệt</label><textarea id="liveAdminNote" maxLength={1000} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Ghi chú sẽ được gửi cho người bán…" /></div>
            <div className="field"><label htmlFor="liveRequestMessage">Nội dung yêu cầu bổ sung / lý do từ chối</label><textarea id="liveRequestMessage" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
            <div className="live-review-actions">
              <button className="btn secondary" disabled={busy || !message.trim()} onClick={() => applyAction("revision")}>Yêu cầu bổ sung</button>
              <button className="btn danger" disabled={busy || !message.trim()} onClick={() => applyAction("reject")}>Từ chối</button>
              <button className="btn dark" disabled={busy} onClick={() => applyAction("approve")}>Phê duyệt / gửi điều kiện</button>
            </div>
            <small className="muted">Nếu bạn thay đổi giá hoặc bước giá, yêu cầu sẽ chuyển sang chờ người bán xác nhận trước khi vào kho.</small>
          </>}
          {selected.status === "AwaitingSellerConfirmation" && <div className="notice warning">Đang chờ người bán xác nhận điều kiện mới. Sản phẩm chưa xuất hiện trong kho.</div>}
          {selected.status === "Approved" && <div className="notice success">Đã duyệt, người bán đã đồng ý. Sản phẩm đủ điều kiện để xếp lịch.</div>}
          {error && <div className="notice error" role="alert">{error}</div>}
        </Modal>
      )}
    </div>
  );
}

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
        requestId: product.requestId,
        requestCode: product.requestCode,
        name: product.name,
        imageUrl: product.imageUrl,
        sellerName: product.sellerName,
        startingPrice: String(product.startingPrice),
        reservePrice: product.reservePrice == null ? "" : String(product.reservePrice),
        bidIncrement: String(product.bidIncrement),
      }]);
  };
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
          liveAuctionRequestId: lot.requestId,
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
      <PageHeader eyebrow="Auctora Live" title="Sự kiện đấu giá trực tiếp" description="Tạo sự kiện, xếp lô và công bố lịch. Chỉ sự kiện đã công bố mới hiển thị công khai.">
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
                  <p className="muted">Chỉ yêu cầu đã được duyệt và người bán đã xác nhận điều kiện mới xuất hiện trong kho này.</p>
                  <div className="live-product-picker">
                    <input type="search" placeholder="Tìm sản phẩm…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm sản phẩm có thể đưa vào lô" />
                    {productsError && <div className="notice error" role="alert">{productsError}</div>}
                    {productsLoading && <p className="muted" role="status">Đang tải sản phẩm…</p>}
                    {!productsLoading && !productsError && products.length === 0 && (
                      <EmptyState title="Chưa có sản phẩm đủ điều kiện" description="Chỉ sản phẩm được Admin duyệt và người bán xác nhận mới có thể xếp vào sự kiện.">
                        <a className="btn secondary" href="#/admin/live-requests">Xem yêu cầu từ người bán</a>
                      </EmptyState>
                    )}
                    <div className="live-product-options">
                      {products.map((product) => {
                        const selected = lots.some((lot) => lot.productId === product.id);
                        return (
                          <article key={product.id} className="live-product-option">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="live-product-placeholder">Ảnh</span>}
                            <div><b>{product.name}</b><small>{product.sellerName} · User #{product.sellerId}</small><small>{product.requestCode} · {product.category || "Chưa phân loại"}</small><small>Giá đã thống nhất: {money(product.startingPrice)}</small></div>
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
                          <b>Lô {String(index + 1).padStart(3, "0")} · {lot.name}<small className="muted"> · {lot.requestCode} · {lot.sellerName}</small></b>
                          <div>
                            <button type="button" className="link-btn" disabled={index === 0} onClick={() => moveLot(index, -1)} aria-label={`Chuyển ${lot.name} lên`}>↑</button>
                            <button type="button" className="link-btn" disabled={index === lots.length - 1} onClick={() => moveLot(index, 1)} aria-label={`Chuyển ${lot.name} xuống`}>↓</button>
                            <button type="button" className="link-btn danger-text" onClick={() => setLots((current) => current.filter((item) => item.productId !== lot.productId))}>Gỡ</button>
                          </div>
                        </div>
                        <div className="live-approved-terms">
                          <span>Khởi điểm <b>{money(Number(lot.startingPrice))}</b></span>
                          <span>Bước giá <b>{money(Number(lot.bidIncrement))}</b></span>
                          <span>Giá dự trữ <b>{lot.reservePrice ? money(Number(lot.reservePrice)) : "Không có"}</b></span>
                          <small>Điều kiện đã được người bán xác nhận và không thể sửa tại bước xếp lô.</small>
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
                    <span className="eyebrow">Auctora Live</span>
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
  const [search, setSearch] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [inventoryRefresh, setInventoryRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = useConfirm();

  useEffect(() => {
    if (!addOpen) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setProductsLoading(true);
      setProductsError("");
      api(`/api/admin/live-inventory${search ? `?q=${encodeURIComponent(search)}` : ""}`)
        .then((data) => alive && setProducts(data))
        .catch((e) => alive && setProductsError(e.message))
        .finally(() => alive && setProductsLoading(false));
    }, 200);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [addOpen, search, inventoryRefresh]);

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
    setBusy(true); setError("");
    try {
      await json("POST", `/api/admin/live/events/${id}/lots`, {
        liveAuctionRequestId: Number(selectedRequestId),
      });
      notify("Đã thêm lô vào sự kiện.");
      setAddOpen(false);
      setSelectedRequestId("");
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
            {["Draft", "Published"].includes(e.status) && <button className="btn secondary" onClick={() => { setAddOpen(true); setError(""); setSelectedRequestId(""); }}>+ Thêm lô</button>}
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
        <Modal title="Thêm lô đấu giá trực tiếp" onClose={() => setAddOpen(false)} busy={busy}>
          <p className="muted">Chỉ lấy hồ sơ đã được duyệt, người bán đã đồng ý và chưa xếp lịch vào sự kiện khác.</p>
          <input type="search" placeholder="Tìm sản phẩm…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm sản phẩm" />
          {productsLoading && <p className="muted" role="status">Đang tải kho sản phẩm đã duyệt…</p>}
          {productsError && <div className="notice error" role="alert">{productsError}<button type="button" className="link-btn" onClick={() => setInventoryRefresh((value) => value + 1)}>Thử lại</button></div>}
          {!productsLoading && !productsError && products.length === 0 && (
            <EmptyState title="Chưa có sản phẩm đủ điều kiện" description="Yêu cầu cần được Admin duyệt và người bán phải xác nhận các điều kiện trước khi xếp lô.">
              <a className="btn secondary" href="#/admin/live-requests">Đi đến yêu cầu từ người bán</a>
            </EmptyState>
          )}
          <form onSubmit={addLot}>
            <div className="live-product-options">
              {products.map((product) => (
                <label key={product.requestId} className={`live-product-option live-inventory-option ${String(product.requestId) === selectedRequestId ? "selected" : ""}`}>
                  <input type="radio" name="liveRequest" value={product.requestId} checked={String(product.requestId) === selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value)} />
                  {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="live-product-placeholder">Ảnh</span>}
                  <span><b>{product.name}</b><small>{product.sellerName} · User #{product.sellerId}</small><small>{product.requestCode} · {product.category || "Chưa phân loại"}</small><small>Khởi điểm {money(product.startingPrice)} · Bước {money(product.bidIncrement)} · Dự trữ {product.reservePrice == null ? "—" : money(product.reservePrice)}</small></span>
                </label>
              ))}
            </div>
            {error && <div className="notice error" role="alert">{error}</div>}
            <div className="dialog-actions">
              <button type="button" className="btn secondary" onClick={() => setAddOpen(false)}>Hủy</button>
              <button className="btn dark" disabled={busy || !selectedRequestId || productsLoading}>{busy ? "Đang thêm…" : "Thêm lô đã duyệt"}</button>
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
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const reloadRef = useRef(snap.reload);
  reloadRef.current = snap.reload;
  const data = snap.data;
  const event = data?.event;
  const current = event?.lots.find((lot) => lot.id === event.currentLotId) || null;
  const next = event?.lots.find((lot) => lot.status === "Pending") || null;
  const canControlLot = event?.status === "Live" && current?.status === "Open";
  const allLotsFinal = event?.lots.every((lot) => ["Sold", "Unsold", "Skipped", "Withdrawn"].includes(lot.status)) ?? false;
  const warningAvailableAt = current?.warningAvailableAt ? new Date(current.warningAvailableAt).getTime() : 0;
  const warningWait = Math.max(0, Math.ceil((warningAvailableAt - now) / 1000));
  const hasSaleableBid = Boolean(current?.bidCount && current.reserveMet);
  const needsSecondWarning = hasSaleableBid && current?.callingStage !== "Twice";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    let retryTimer;
    let retryDelay = 1000;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/live`, { accessTokenFactory: () => getSession()?.accessToken || "" })
      .withAutomaticReconnect()
      .build();
    const refresh = () => reloadRef.current();
    const scheduleConnect = () => {
      if (!alive || retryTimer) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };
    const connect = async () => {
      if (!alive) return;
      try {
        if (connection.state === signalR.HubConnectionState.Disconnected) await connection.start();
        if (connection.state !== signalR.HubConnectionState.Connected) return;
        await connection.invoke("JoinEvent", id);
        if (alive) {
          setConnected(true);
          retryDelay = 1000;
          refresh();
        }
      } catch {
        if (alive) setConnected(false);
        scheduleConnect();
      }
    };
    ["BidAccepted", "LotOpened", "FairWarning", "LotSold", "LotUnsold", "EventPaused", "EventResumed", "EventCompleted", "LotsChanged"]
      .forEach((name) => connection.on(name, refresh));
    connection.onreconnecting(() => alive && setConnected(false));
    connection.onreconnected(() => connect());
    connection.onclose(() => {
      if (alive) setConnected(false);
      scheduleConnect();
    });
    connect();
    const poll = window.setInterval(refresh, 15000);
    return () => {
      alive = false;
      window.clearTimeout(retryTimer);
      window.clearInterval(poll);
      connection.stop();
    };
  }, [id]);

  const action = async (path, body) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await json("POST", path, body);
      await snap.reload();
    } catch (e) {
      setError(e.message);
      await snap.reload();
    }
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
      <PageHeader eyebrow="Auctora Live Control" title={event?.title || "Console điều hành"} description={`${event?.code || ""} · ${connected ? "Đã kết nối realtime" : "Đang kết nối lại realtime"}; mọi thay đổi được đồng bộ với phòng đấu giá.`}>
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
                    <button className="btn secondary" disabled={busy || !canControlLot || current.callingStage === "Twice" || warningWait > 0} title={!canControlLot ? "Chỉ điều khiển lô khi sự kiện đang diễn ra" : warningWait > 0 ? `Có thể cảnh báo lần 2 sau ${warningWait} giây` : undefined} onClick={() => action(`/api/admin/live/lots/${current.id}/warning`)}>
                      {warningWait > 0 ? `Chờ ${warningWait} giây` : current.callingStage === "Twice" ? "Đã cảnh báo 2 lần" : "Cảnh báo chốt"}
                    </button>
                    <button className="btn" disabled={busy || !canControlLot || Boolean(needsSecondWarning)} title={!canControlLot ? "Chỉ điều khiển lô khi sự kiện đang diễn ra" : needsSecondWarning ? "Cần gửi đủ hai cảnh báo trước khi chốt bán" : undefined} onClick={() => action(`/api/admin/live/lots/${current.id}/close`)}>Chốt bán</button>
                    <button className="btn danger" disabled={busy || !canControlLot || Boolean(hasSaleableBid)} title={!canControlLot ? "Chỉ điều khiển lô khi sự kiện đang diễn ra" : hasSaleableBid ? "Không thể đánh dấu không bán khi đã đạt giá dự trữ" : undefined} onClick={() => { if (confirm("Chốt lô này là không bán được?")) action(`/api/admin/live/lots/${current.id}/close?forceUnsold=true`); }}>Không bán được</button>
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
                {["Live", "Paused", "Published"].includes(event.status) && <button className="btn danger" disabled={busy || !allLotsFinal} title={!allLotsFinal ? "Hãy xử lý tất cả các lô trước khi kết thúc" : undefined} onClick={() => { if (confirm("Kết thúc toàn bộ sự kiện?")) action(`/api/admin/live/events/${id}/complete`); }}>Kết thúc sự kiện</button>}
              </div>
              <form onSubmit={announce}>
                <div className="field"><label htmlFor="announcement">Thông báo tới phòng</label><textarea id="announcement" value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} placeholder="Ví dụ: Lô tiếp theo sẽ mở sau 2 phút." /></div>
                <button className="btn secondary" disabled={busy || !message.trim()}>Gửi thông báo</button>
              </form>
            </section>
            <section className="panel">
              <h2>Lịch sử giá gần đây</h2>
              {data.recentBids?.length ? (
                <ol className="live-console-bids">
                  {data.recentBids.map((bid) => (
                    <li key={bid.id}>
                      <span><strong>{bid.bidderCode}</strong><small>{date(bid.bidTime)}</small></span>
                      <b>{money(bid.amount)}</b>
                    </li>
                  ))}
                </ol>
              ) : <p className="muted">Chưa có lượt đặt giá cho lô hiện tại.</p>}
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
