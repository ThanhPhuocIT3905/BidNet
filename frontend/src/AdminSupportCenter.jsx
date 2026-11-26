import React, { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE, api, json, query, date, getSession } from "./api";
import { PageHeader, EmptyState, LoadingState, ErrorState } from "./UI.jsx";

const STATUS_LABELS = {
  Open: "Mới tiếp nhận",
  InProgress: "Đang xử lý",
  Resolved: "Đã giải quyết",
};

const QUICK_REPLIES = [
  "Xin chào, Auctora đã tiếp nhận yêu cầu của bạn và đang tiến hành kiểm tra.",
  "Chúng tôi đã kiểm tra thông tin phiên đấu giá/đơn hàng của bạn. Vui lòng kiểm tra lại cập nhật mới nhất.",
  "Vấn đề đã được xử lý xong. Nếu còn thắc mắc nào khác, bạn có thể phản hồi tại đây để mở lại yêu cầu.",
];

export default function AdminSupportCenter({ user, notify }) {
  const [tickets, setTickets] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [hubConnected, setHubConnected] = useState(false);
  const [userTyping, setUserTyping] = useState("");

  // AI Copilot suggestion
  const [copilot, setCopilot] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const hubRef = useRef(null);
  const threadEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  const loadInbox = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/api/support?${query({ page, status: statusFilter, q: searchQ })}`);
      setTickets(data.items || []);
      setTotalCount(data.totalCount || 0);
    } catch (e) {
      setError(e.message || "Không tải được danh sách hỗ trợ");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const data = await api(`/api/support/${id}?messagePage=1`);
      setDetail(data);
      fetchCopilotSuggestion(data);
    } catch (e) {
      notify?.(e.message || "Không tải được chi tiết yêu cầu");
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchCopilotSuggestion = async (ticketData) => {
    const lastUserMsg = [...(ticketData?.messages || [])].reverse().find((m) => !m.isAdmin);
    if (!lastUserMsg) {
      setCopilot(null);
      return;
    }
    setCopilotLoading(true);
    try {
      const res = await json("POST", "/api/support/ai/suggest", {
        pageContext: ticketData.pageContext || "",
        message: lastUserMsg.body,
      });
      setCopilot({
        sourceMessage: lastUserMsg.body,
        suggestedReply: res.answer,
        confidence: res.confidence,
      });
    } catch {
      setCopilot(null);
    } finally {
      setCopilotLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [page, statusFilter, searchQ]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages, userTyping]);

  // SignalR Admin connection
  useEffect(() => {
    const token = getSession()?.accessToken;
    if (!token) return;
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/support`, { accessTokenFactory: () => getSession()?.accessToken || "" })
      .withAutomaticReconnect()
      .build();

    conn.on("TicketCreated", () => {
      loadInbox();
      notify?.("Có yêu cầu hỗ trợ mới!");
    });
    conn.on("TicketUpdated", () => {
      loadInbox();
    });
    conn.on("MessageReceived", (msg) => {
      setDetail((prev) => {
        if (!prev) return prev;
        if (prev.messages?.some((m) => m.id === msg.id)) return prev;
        return { ...prev, messages: [...(prev.messages || []), msg] };
      });
    });
    conn.on("TypingStarted", (info) => {
      if (info?.name && info.name !== user?.username) {
        setUserTyping(`${info.name} đang nhập…`);
      }
    });
    conn.on("TypingStopped", () => setUserTyping(""));

    conn
      .start()
      .then(() => {
        setHubConnected(true);
        if (selectedId) return conn.invoke("JoinTicket", selectedId);
      })
      .catch(() => setHubConnected(false));

    hubRef.current = conn;
    return () => {
      conn.stop().catch(() => {});
      setHubConnected(false);
    };
  }, [user?.id]);

  // Join/leave ticket room when selection changes
  useEffect(() => {
    const conn = hubRef.current;
    if (!conn || !hubConnected || !selectedId) return;
    conn.invoke("JoinTicket", selectedId).catch(() => {});
    return () => {
      conn.invoke("LeaveTicket", selectedId).catch(() => {});
    };
  }, [selectedId, hubConnected]);

  const sendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !detail || busy) return;
    setBusy(true);
    try {
      await json("POST", `/api/support/${detail.id}/messages`, {
        message: replyText.trim(),
        version: detail.version,
      });
      setReplyText("");
      await loadDetail(detail.id);
      await loadInbox();
      notify?.("Đã gửi phản hồi");
    } catch (err) {
      notify?.(err.message || "Không gửi được phản hồi");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (newStatus) => {
    if (!detail || busy || detail.status === newStatus) return;
    setBusy(true);
    try {
      await json("PATCH", `/api/support/${detail.id}/status`, {
        status: newStatus,
        version: detail.version,
      });
      await loadDetail(detail.id);
      await loadInbox();
      notify?.(`Đã chuyển trạng thái sang ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      notify?.(err.message || "Không cập nhật được trạng thái");
    } finally {
      setBusy(false);
    }
  };

  const openCount = tickets.filter((t) => t.status === "Open").length;
  const inProgressCount = tickets.filter((t) => t.status === "InProgress").length;
  const resolvedCount = tickets.filter((t) => t.status === "Resolved").length;

  return (
    <div className="admin-support-center">
      <PageHeader
        eyebrow="Chăm sóc khách hàng"
        title="Trung tâm hỗ trợ Auctora"
        description="Tiếp nhận yêu cầu, trao đổi trực tiếp và theo dõi tiến độ xử lý."
      >
        <span className={`bn-realtime-pill ${hubConnected ? "online" : ""}`}>
          <span className="bn-status-dot" />
          {hubConnected ? "Realtime đang bật" : "Chế độ tiêu chuẩn"}
        </span>
      </PageHeader>

      {/* KPI Metrics */}
      <div className="admin-metrics">
        <section className="panel">
          <h2>Tổng yêu cầu</h2>
          <strong>{totalCount}</strong>
        </section>
        <section className="panel">
          <h2>Chờ tiếp nhận</h2>
          <strong>{openCount}</strong>
        </section>
        <section className="panel">
          <h2>Đang xử lý</h2>
          <strong>{inProgressCount}</strong>
        </section>
        <section className="panel">
          <h2>Đã giải quyết</h2>
          <strong>{resolvedCount}</strong>
        </section>
      </div>

      <div className="support-console-grid">
        {/* Left: Inbox */}
        <section className="panel support-inbox-col">
          <div className="support-inbox-filters">
            <input
              type="search"
              placeholder="Tìm mã # hoặc tiêu đề…"
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setPage(1);
              }}
            />
            <div className="support-filter-tabs">
              {[
                ["", "Tất cả"],
                ["Open", "Mới"],
                ["InProgress", "Đang xử lý"],
                ["Resolved", "Đã xong"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  className={statusFilter === val ? "active" : ""}
                  onClick={() => {
                    setStatusFilter(val);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={loadInbox} />
          ) : loading ? (
            <LoadingState />
          ) : tickets.length === 0 ? (
            <EmptyState title="Hộp thư trống" description="Chưa có yêu cầu hỗ trợ nào phù hợp bộ lọc." />
          ) : (
            <div className="support-inbox-list">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`support-inbox-item ${selectedId === t.id ? "active" : ""}`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <div className="support-inbox-row">
                    <strong>#{t.id} · {t.subject}</strong>
                    <span className={`bn-ticket-badge ${t.status}`}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                  </div>
                  <div className="support-inbox-meta">
                    <span>{t.requesterName}</span>
                    {t.pageContext && <span className="bn-ctx-tag">{t.pageContext}</span>}
                    <small>{date(t.updatedAt)}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Right: Chat Console + AI Copilot */}
        <section className="panel support-console-col">
          {!selectedId ? (
            <EmptyState
              title="Chọn một yêu cầu để xử lý"
              description="Chọn cuộc trò chuyện từ danh sách bên trái để xem nội dung, gợi ý AI Copilot và phản hồi trực tiếp."
            />
          ) : detailLoading || !detail ? (
            <LoadingState />
          ) : (
            <>
              <header className="support-console-head">
                <div>
                  <h2>#{detail.id} · {detail.subject}</h2>
                  <p className="muted small">
                    Người gửi: <strong>{detail.requesterName}</strong>
                    {detail.productId && (
                      <> · <a href={`#/product/${detail.productId}`}>Phiên #{detail.productId}</a></>
                    )}
                    {detail.orderId && (
                      <> · <a href={`#/admin/orders/${detail.orderId}`}>Đơn #{detail.orderId}</a></>
                    )}
                  </p>
                </div>
                <div className="support-status-actions">
                  <select
                    value={detail.status}
                    disabled={busy}
                    onChange={(e) => changeStatus(e.target.value)}
                    aria-label="Trạng thái ticket"
                  >
                    <option value="Open">Mới tiếp nhận</option>
                    <option value="InProgress">Đang xử lý</option>
                    <option value="Resolved">Đã giải quyết</option>
                  </select>
                </div>
              </header>

              {/* AI Copilot Panel */}
              <div className="ai-copilot-box">
                <div className="ai-copilot-head">
                  <strong>🤖 Auctora AI Copilot</strong>
                  <small>Gợi ý câu trả lời cho nhân viên</small>
                </div>
                {copilotLoading ? (
                  <p className="muted small">Đang phân tích nội dung yêu cầu…</p>
                ) : copilot ? (
                  <>
                    <p className="ai-copilot-preview">{copilot.suggestedReply}</p>
                    <button
                      type="button"
                      className="btn secondary bn-sm-btn"
                      onClick={() => setReplyText(copilot.suggestedReply.replace(/\*\*/g, ""))}
                    >
                      ✨ Sử dụng câu trả lời này
                    </button>
                  </>
                ) : (
                  <p className="muted small">Chưa có gợi ý tự động cho tin nhắn này.</p>
                )}
              </div>

              {/* Conversation Thread */}
              <div className="support-thread-box">
                {(detail.messages || []).map((m) => (
                  <article
                    key={m.id}
                    className={`support-thread-msg ${m.isAdmin ? "from-agent" : "from-user"}`}
                  >
                    <div className="support-thread-meta">
                      <strong>{m.authorName}{m.isAdmin ? " · Quản trị viên" : ""}</strong>
                      <small>{date(m.createdAt)}</small>
                    </div>
                    <p>{m.body}</p>
                  </article>
                ))}
                {userTyping && <div className="bn-typing-line">{userTyping}</div>}
                <div ref={threadEndRef} />
              </div>

              {/* Quick Replies */}
              <div className="support-quick-templates">
                {QUICK_REPLIES.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReplyText(tpl)}
                    title={tpl}
                  >
                    Mẫu #{idx + 1}
                  </button>
                ))}
              </div>

              {/* Reply Input */}
              <form className="support-reply-form" onSubmit={sendReply}>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    if (hubRef.current && hubConnected && detail) {
                      hubRef.current.invoke("TypingStarted", detail.id).catch(() => {});
                      clearTimeout(typingTimerRef.current);
                      typingTimerRef.current = setTimeout(() => {
                        hubRef.current?.invoke("TypingStopped", detail.id).catch(() => {});
                      }, 1500);
                    }
                  }}
                  placeholder="Nhập phản hồi gửi khách hàng…"
                />
                <div className="support-reply-actions">
                  <button type="submit" className="btn dark" disabled={busy || !replyText.trim()}>
                    {busy ? "Đang gửi…" : "Gửi phản hồi"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
