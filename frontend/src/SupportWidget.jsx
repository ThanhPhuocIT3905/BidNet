import React, { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE, api, json, getSession, date } from "./api";

const PAGE_LABELS = {
  home: "Trang chủ",
  product: "Chi tiết sản phẩm",
  auctions: "Danh sách đấu giá",
  "my-products": "Sản phẩm của tôi",
  orders: "Đơn hàng",
  "my-bids": "Lượt đặt giá",
  profile: "Hồ sơ cá nhân",
  contact: "Liên hệ",
  guides: "Hướng dẫn & Quy định",
};

const TICKET_STATUS_LABELS = {
  Open: "Mới tiếp nhận",
  InProgress: "Đang xử lý",
  Resolved: "Đã giải quyết",
};

function parseRouteContext(route) {
  const clean = (route || "/").split("?")[0];
  const productMatch = clean.match(/^\/product\/(\d+)/);
  if (productMatch) return { pageContext: "product", productId: Number(productMatch[1]), orderId: null };
  const orderMatch = clean.match(/^\/order\/(\d+)/);
  if (orderMatch) return { pageContext: "orders", productId: null, orderId: Number(orderMatch[1]) };
  if (clean === "/") return { pageContext: "home", productId: null, orderId: null };
  if (clean.startsWith("/auctions")) return { pageContext: "auctions", productId: null, orderId: null };
  if (clean.startsWith("/my-products")) return { pageContext: "my-products", productId: null, orderId: null };
  if (clean.startsWith("/orders")) return { pageContext: "orders", productId: null, orderId: null };
  if (clean.startsWith("/my-bids")) return { pageContext: "my-bids", productId: null, orderId: null };
  if (clean.startsWith("/profile")) return { pageContext: "profile", productId: null, orderId: null };
  if (clean.startsWith("/contact")) return { pageContext: "contact", productId: null, orderId: null };
  if (clean.startsWith("/guides") || clean.startsWith("/policies")) return { pageContext: "guides", productId: null, orderId: null };
  return { pageContext: "home", productId: null, orderId: null };
}

function FormatText({ text }) {
  if (!text) return null;
  return (
    <div className="bn-msg-text">
      {text.split("\n").map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                part
              )
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function SupportWidget({ route, user, go, openAuth, notify }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState("ai"); // "ai" | "live"
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const ctx = parseRouteContext(route);

  // ── AI Chat State ──
  const [aiMessages, setAiMessages] = useState([]);
  const [aiQuickReplies, setAiQuickReplies] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiTyping, setAiTyping] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState({});

  // ── Live Support State ──
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [liveInput, setLiveInput] = useState("");
  const [sendingLive, setSendingLive] = useState(false);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: "", message: "", includeAiHistory: true });
  const [agentTyping, setAgentTyping] = useState("");
  const [hubConnected, setHubConnected] = useState(false);

  const aiEndRef = useRef(null);
  const liveEndRef = useRef(null);
  const hubRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (open && !minimized && tab === "ai") {
      aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiMessages, aiTyping, open, minimized, tab]);

  useEffect(() => {
    if (open && !minimized && tab === "live" && activeTicket) {
      liveEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTicket?.messages, agentTyping, open, minimized, tab]);

  // Initialize AI welcome on first open or context change when chat is empty
  useEffect(() => {
    if (!open || aiMessages.length > 0) return;
    fetchAiWelcome();
  }, [open]);

  const fetchAiWelcome = async () => {
    setAiTyping(true);
    try {
      const res = await json("POST", "/api/support/ai/suggest", {
        pageContext: ctx.pageContext,
        productId: ctx.productId,
        orderId: ctx.orderId,
        message: "",
      });
      setAiMessages([
        {
          id: Date.now(),
          sender: "ai",
          text: res.answer,
          source: res.source,
          canEscalate: res.canEscalate,
          time: new Date().toISOString(),
        },
      ]);
      setAiQuickReplies(res.quickReplies || []);
    } catch {
      setAiMessages([
        {
          id: Date.now(),
          sender: "ai",
          text: "Xin chào! Tôi là **Auctora AI**. Tôi có thể hỗ trợ bạn về đấu giá, đăng bán, đơn hàng và tài khoản.",
          canEscalate: true,
          time: new Date().toISOString(),
        },
      ]);
      setAiQuickReplies(["Auctora hoạt động thế nào?", "Tham gia đấu giá", "Gặp nhân viên hỗ trợ"]);
    } finally {
      setAiTyping(false);
    }
  };

  const resetAiChat = () => {
    setAiMessages([]);
    setFeedbackMap({});
    setMenuOpen(false);
    fetchAiWelcome();
  };

  const sendAiMessage = async (textOverride) => {
    const text = (textOverride ?? aiInput).trim();
    if (!text || aiTyping) return;
    if (!textOverride) setAiInput("");

    // Nếu người dùng bấm gợi ý chuyển nhân viên
    if (text.toLowerCase().includes("nhân viên") || text.toLowerCase() === "tạo yêu cầu hỗ trợ") {
      switchToLiveSupport(text);
      return;
    }

    const userMsg = { id: Date.now(), sender: "user", text, time: new Date().toISOString() };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiTyping(true);

    try {
      const history = aiMessages.slice(-6).map((m) => ({
        role: m.sender === "ai" ? "model" : "user",
        text: m.text,
      }));
      const res = await json("POST", "/api/support/ai/suggest", {
        pageContext: ctx.pageContext,
        productId: ctx.productId,
        orderId: ctx.orderId,
        message: text,
        history,
      });
      setTimeout(() => {
        setAiMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: "ai",
            text: res.answer,
            source: res.source,
            canEscalate: res.canEscalate,
            time: new Date().toISOString(),
          },
        ]);
        if (res.quickReplies?.length) setAiQuickReplies(res.quickReplies);
        setAiTyping(false);
      }, 320);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          text: "Trợ lý AI tạm thời không kết nối được. Nội dung của bạn vẫn được giữ lại, bạn có thể thử lại hoặc chuyển sang **Nhân viên hỗ trợ**.",
          canEscalate: true,
          isError: true,
          time: new Date().toISOString(),
        },
      ]);
      setAiTyping(false);
    }
  };

  const switchToLiveSupport = (prefillSubject = "") => {
    setTab("live");
    setMenuOpen(false);
    if (!user) return;
    if (!activeTicket) {
      setShowNewTicketForm(true);
      if (prefillSubject) {
        setTicketForm((f) => ({
          ...f,
          subject: f.subject || `Hỗ trợ từ ${PAGE_LABELS[ctx.pageContext] || "Auctora"}`,
        }));
      }
    }
  };

  // Load user's tickets when switching to Live tab
  const loadTickets = async () => {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const data = await api("/api/support?page=1");
      setTickets(data.items || []);
    } catch (e) {
      notify?.(e.message || "Không tải được danh sách hỗ trợ");
    } finally {
      setLoadingTickets(false);
    }
  };

  const openTicketDetail = async (ticketId) => {
    try {
      const detail = await api(`/api/support/${ticketId}?messagePage=1`);
      setActiveTicket(detail);
      setShowNewTicketForm(false);
    } catch (e) {
      notify?.(e.message || "Không mở được cuộc trò chuyện");
    }
  };

  useEffect(() => {
    if (open && tab === "live" && user) {
      loadTickets();
    }
  }, [open, tab, user?.id]);

  // SignalR connection for Live Support Ticket
  useEffect(() => {
    const token = getSession()?.accessToken;
    if (!user || !token || !activeTicket?.id) {
      if (hubRef.current) {
        hubRef.current.stop().catch(() => {});
        hubRef.current = null;
        setHubConnected(false);
      }
      return;
    }

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/support`, { accessTokenFactory: () => getSession()?.accessToken || "" })
      .withAutomaticReconnect()
      .build();

    conn.on("MessageReceived", (msg) => {
      setActiveTicket((prev) => {
        if (!prev) return prev;
        if (prev.messages?.some((m) => m.id === msg.id)) return prev;
        return { ...prev, messages: [...(prev.messages || []), msg] };
      });
      if (!open || minimized || tab !== "live") {
        setUnread((u) => u + 1);
      }
    });

    conn.on("TypingStarted", (info) => {
      if (info?.name && info.name !== user.username) {
        setAgentTyping(`${info.name} đang nhập…`);
      }
    });

    conn.on("TypingStopped", () => {
      setAgentTyping("");
    });

    conn.on("TicketStatusChanged", ({ ticketId, status }) => {
      if (activeTicket?.id === ticketId) {
        setActiveTicket((prev) => (prev ? { ...prev, status } : prev));
        // Reload to refresh RowVersion
        api(`/api/support/${ticketId}?messagePage=1`).then(setActiveTicket).catch(() => {});
      }
    });

    conn
      .start()
      .then(() => {
        setHubConnected(true);
        return conn.invoke("JoinTicket", activeTicket.id);
      })
      .catch(() => setHubConnected(false));

    hubRef.current = conn;
    return () => {
      conn.invoke("LeaveTicket", activeTicket.id).catch(() => {});
      conn.stop().catch(() => {});
      setHubConnected(false);
    };
  }, [user?.id, activeTicket?.id]);

  const createTicket = async (e) => {
    e.preventDefault();
    if (!ticketForm.message.trim() || sendingLive) return;
    setSendingLive(true);
    try {
      let bodyText = ticketForm.message.trim();
      if (ticketForm.includeAiHistory && aiMessages.length > 1) {
        const summary = aiMessages
          .slice(-4)
          .map((m) => `[${m.sender === "ai" ? "AI" : "User"}]: ${m.text.replace(/\*\*/g, "").slice(0, 120)}`)
          .join("\n");
        bodyText = `${bodyText}\n\n--- Lịch sử AI ---\n${summary}`.slice(0, 700);
      }

      const res = await json("POST", "/api/support", {
        subject: ticketForm.subject.trim() || `Hỗ trợ (${PAGE_LABELS[ctx.pageContext] || "Website"})`,
        message: bodyText,
        productId: ctx.productId,
        orderId: ctx.orderId,
        pageContext: ctx.pageContext,
      });

      setTicketForm({ subject: "", message: "", includeAiHistory: true });
      setShowNewTicketForm(false);
      await loadTickets();
      await openTicketDetail(res.id);
      notify?.(`Đã tạo yêu cầu hỗ trợ #${res.id}`);
    } catch (err) {
      notify?.(err.message || "Không thể tạo yêu cầu hỗ trợ");
    } finally {
      setSendingLive(false);
    }
  };

  const sendLiveMessage = async (e) => {
    e.preventDefault();
    const text = liveInput.trim();
    if (!text || sendingLive || !activeTicket) return;
    setSendingLive(true);
    try {
      const msg = await json("POST", `/api/support/${activeTicket.id}/messages`, {
        message: text,
        version: activeTicket.version,
      });
      setLiveInput("");
      if (hubRef.current && hubConnected) {
        hubRef.current.invoke("TypingStopped", activeTicket.id).catch(() => {});
      }
      // Refresh full ticket to stay synced with RowVersion & messages
      const refreshed = await api(`/api/support/${activeTicket.id}?messagePage=1`);
      setActiveTicket(refreshed);
    } catch (err) {
      notify?.(err.message || "Không gửi được tin nhắn");
    } finally {
      setSendingLive(false);
    }
  };

  const handleLiveInputChange = (val) => {
    setLiveInput(val);
    if (hubRef.current && hubConnected && activeTicket) {
      hubRef.current.invoke("TypingStarted", activeTicket.id).catch(() => {});
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        hubRef.current?.invoke("TypingStopped", activeTicket.id).catch(() => {});
      }, 1500);
    }
  };

  const handleToggleOpen = () => {
    setOpen(true);
    setMinimized(false);
    setUnread(0);
  };

  // Launcher button when closed or minimized
  if (!open || minimized) {
    return (
      <button
        type="button"
        className="bn-chat-launcher"
        onClick={handleToggleOpen}
        aria-label="Mở Auctora Support"
        title="Auctora Support – Trợ lý AI & Nhân viên hỗ trợ"
      >
        <span className="bn-launcher-icon" aria-hidden="true">💬</span>
        <span className="bn-launcher-text">{minimized ? "Auctora Support" : "Bạn cần trợ giúp?"}</span>
        {unread > 0 && <span className="bn-launcher-badge">{unread}</span>}
      </button>
    );
  }

  return (
    <aside className="bn-chat-window" aria-label="Auctora Support">
      {/* Header */}
      <header className="bn-chat-header">
        <div className="bn-chat-brand">
          <div className="bn-chat-avatar" aria-hidden="true">
            {tab === "ai" ? "🤖" : "🎧"}
          </div>
          <div>
            <strong>Auctora Support</strong>
            <small className="bn-chat-status">
              <span className="bn-status-dot" />
              {tab === "ai"
                ? `Trợ lý AI · ${PAGE_LABELS[ctx.pageContext] || "Trực tuyến"}`
                : hubConnected
                ? "Đang kết nối realtime"
                : "Hỗ trợ trực tuyến"}
            </small>
          </div>
        </div>
        <div className="bn-chat-actions">
          <div className="bn-menu-wrap">
            <button
              type="button"
              className="bn-icon-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Tùy chọn"
              title="Tùy chọn"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="bn-chat-menu">
                <button type="button" onClick={resetAiChat}>
                  Cuộc trò chuyện AI mới
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("live");
                    setActiveTicket(null);
                    setShowNewTicketForm(false);
                    setMenuOpen(false);
                  }}
                >
                  Lịch sử yêu cầu hỗ trợ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setMenuOpen(false);
                    go?.("/guides");
                  }}
                >
                  Trung tâm trợ giúp
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="bn-icon-btn"
            onClick={() => setMinimized(true)}
            aria-label="Thu nhỏ"
            title="Thu nhỏ"
          >
            ─
          </button>
          <button
            type="button"
            className="bn-icon-btn"
            onClick={() => setOpen(false)}
            aria-label="Đóng"
            title="Đóng"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Mode Switch Tabs */}
      <div className="bn-chat-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "ai"}
          className={tab === "ai" ? "active" : ""}
          onClick={() => setTab("ai")}
        >
          🤖 Trợ lý AI
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "live"}
          className={tab === "live" ? "active" : ""}
          onClick={() => {
            setTab("live");
            setUnread(0);
          }}
        >
          🎧 Nhân viên hỗ trợ
        </button>
      </div>

      {/* TAB 1: AI ASSISTANT */}
      {tab === "ai" && (
        <>
          <div className="bn-chat-body">
            {ctx.productId && (
              <div className="bn-context-pill">Đang xem: Phiên đấu giá #{ctx.productId}</div>
            )}
            {ctx.orderId && (
              <div className="bn-context-pill">Đang xem: Đơn hàng #{ctx.orderId}</div>
            )}
            {aiMessages.map((m) => (
              <div key={m.id} className={`bn-msg ${m.sender === "user" ? "is-user" : "is-ai"}`}>
                <div className="bn-bubble">
                  <FormatText text={m.text} />
                  {m.source && (
                    <a
                      className="bn-source-link"
                      href={m.source}
                      onClick={(e) => {
                        e.preventDefault();
                        go?.(m.source.replace(/^#/, ""));
                      }}
                    >
                      📖 Xem tài liệu hướng dẫn →
                    </a>
                  )}
                  {m.sender === "ai" && (
                    <div className="bn-msg-footer">
                      <span className="bn-feedback-btns">
                        <small>Hữu ích?</small>
                        <button
                          type="button"
                          className={feedbackMap[m.id] === "up" ? "picked" : ""}
                          onClick={() => setFeedbackMap((f) => ({ ...f, [m.id]: "up" }))}
                          title="Hữu ích"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          className={feedbackMap[m.id] === "down" ? "picked" : ""}
                          onClick={() => setFeedbackMap((f) => ({ ...f, [m.id]: "down" }))}
                          title="Chưa hữu ích"
                        >
                          👎
                        </button>
                      </span>
                      {m.canEscalate && (
                        <button
                          type="button"
                          className="bn-handoff-link"
                          onClick={() => switchToLiveSupport()}
                        >
                          Gặp nhân viên →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {aiTyping && (
              <div className="bn-msg is-ai">
                <div className="bn-bubble bn-typing">
                  <span>●</span>
                  <span>●</span>
                  <span>●</span>
                  <small>Auctora AI đang trả lời…</small>
                </div>
              </div>
            )}
            <div ref={aiEndRef} />
          </div>

          {aiQuickReplies.length > 0 && (
            <div className="bn-quick-replies">
              {aiQuickReplies.map((q) => (
                <button key={q} type="button" onClick={() => sendAiMessage(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            className="bn-chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              sendAiMessage();
            }}
          >
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Nhập câu hỏi của bạn…"
              maxLength={400}
            />
            <button type="submit" className="btn dark" disabled={!aiInput.trim() || aiTyping}>
              Gửi
            </button>
          </form>
          <div className="bn-chat-disclaimer">
            Auctora AI · Không chia sẻ mật khẩu hoặc mã OTP
          </div>
        </>
      )}

      {/* TAB 2: LIVE SUPPORT / TICKETS */}
      {tab === "live" && (
        <div className="bn-live-wrap">
          {!user ? (
            <div className="bn-live-gate">
              <p>Vui lòng đăng nhập để trò chuyện trực tiếp và theo dõi yêu cầu hỗ trợ cùng nhân viên Auctora.</p>
              <button type="button" className="btn dark" onClick={() => openAuth?.("login")}>
                Đăng nhập ngay
              </button>
            </div>
          ) : showNewTicketForm ? (
            <form className="bn-ticket-form" onSubmit={createTicket}>
              <div className="bn-live-subhead">
                <strong>Kết nối nhân viên hỗ trợ</strong>
                <button
                  type="button"
                  className="bn-link-btn"
                  onClick={() => setShowNewTicketForm(false)}
                >
                  ← Danh sách
                </button>
              </div>
              <label>
                Chủ đề *
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  placeholder="Ví dụ: Lỗi đặt giá, Thanh toán đơn hàng..."
                />
              </label>
              {(ctx.productId || ctx.orderId) && (
                <div className="bn-context-pill">
                  Đính kèm ngữ cảnh: {ctx.productId ? `Phiên #${ctx.productId}` : ""}{" "}
                  {ctx.orderId ? `Đơn #${ctx.orderId}` : ""}
                </div>
              )}
              <label>
                Mô tả vấn đề *
                <textarea
                  rows={4}
                  required
                  maxLength={600}
                  value={ticketForm.message}
                  onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                  placeholder="Mô tả chi tiết nội dung bạn cần hỗ trợ…"
                />
              </label>
              {aiMessages.length > 1 && (
                <label className="bn-checkbox">
                  <input
                    type="checkbox"
                    checked={ticketForm.includeAiHistory}
                    onChange={(e) =>
                      setTicketForm({ ...ticketForm, includeAiHistory: e.target.checked })
                    }
                  />
                  <span>Chuyển kèm lịch sử trò chuyện với AI cho nhân viên</span>
                </label>
              )}
              <button type="submit" className="btn dark" disabled={sendingLive || !ticketForm.message.trim()}>
                {sendingLive ? "Đang gửi…" : "Bắt đầu trò chuyện"}
              </button>
            </form>
          ) : activeTicket ? (
            <div className="bn-live-thread">
              <div className="bn-live-subhead">
                <button
                  type="button"
                  className="bn-link-btn"
                  onClick={() => {
                    setActiveTicket(null);
                    loadTickets();
                  }}
                >
                  ← Quay lại
                </button>
                <span className={`bn-ticket-badge ${activeTicket.status}`}>
                  {TICKET_STATUS_LABELS[activeTicket.status] || activeTicket.status}
                </span>
              </div>
              <div className="bn-thread-title">
                <strong>#{activeTicket.id} · {activeTicket.subject}</strong>
              </div>
              <div className="bn-chat-body">
                {(activeTicket.messages || []).map((m) => (
                  <div key={m.id} className={`bn-msg ${m.isAdmin ? "is-ai" : "is-user"}`}>
                    <div className="bn-bubble">
                      <small className="bn-sender-name">
                        {m.isAdmin ? `${m.authorName} · Hỗ trợ viên` : "Bạn"}
                      </small>
                      <FormatText text={m.body} />
                      <small className="bn-msg-time">{date(m.createdAt)}</small>
                    </div>
                  </div>
                ))}
                {agentTyping && <div className="bn-typing-line">{agentTyping}</div>}
                <div ref={liveEndRef} />
              </div>
              <form className="bn-chat-input" onSubmit={sendLiveMessage}>
                <input
                  type="text"
                  value={liveInput}
                  onChange={(e) => handleLiveInputChange(e.target.value)}
                  placeholder="Nhập tin nhắn gửi nhân viên…"
                  maxLength={2000}
                />
                <button type="submit" className="btn dark" disabled={!liveInput.trim() || sendingLive}>
                  Gửi
                </button>
              </form>
            </div>
          ) : (
            <div className="bn-ticket-list-wrap">
              <div className="bn-live-subhead">
                <strong>Yêu cầu hỗ trợ của bạn</strong>
                <button
                  type="button"
                  className="btn dark bn-sm-btn"
                  onClick={() => setShowNewTicketForm(true)}
                >
                  + Tạo yêu cầu
                </button>
              </div>
              <div className="bn-ticket-list">
                {loadingTickets ? (
                  <p className="muted small">Đang tải…</p>
                ) : tickets.length === 0 ? (
                  <div className="bn-empty-live">
                    <p>Bạn chưa có yêu cầu hỗ trợ nào.</p>
                    <button
                      type="button"
                      className="btn dark"
                      onClick={() => setShowNewTicketForm(true)}
                    >
                      Kết nối nhân viên ngay
                    </button>
                  </div>
                ) : (
                  tickets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="bn-ticket-item"
                      onClick={() => openTicketDetail(t.id)}
                    >
                      <div>
                        <strong>#{t.id} · {t.subject}</strong>
                        <small>{date(t.updatedAt)}</small>
                      </div>
                      <span className={`bn-ticket-badge ${t.status}`}>
                        {TICKET_STATUS_LABELS[t.status] || t.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
