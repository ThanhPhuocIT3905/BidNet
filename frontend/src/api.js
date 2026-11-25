export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5014"
).replace(/\/$/, "");

const SESSION_KEY = "bidnet.session";

export const getSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
};

export const setSession = (value) =>
  value
    ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(value))
    : sessionStorage.removeItem(SESSION_KEY);

export const emitNotificationsChanged = () =>
  window.dispatchEvent(new Event("bidnet:notifications"));

export const query = (value) => {
  const p = new URLSearchParams();
  Object.entries(value).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, v);
  });
  return p.toString();
};

export async function api(path, options = {}) {
  const token = getSession()?.accessToken;
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      `Không kết nối được API tại ${API_BASE}. Kiểm tra backend và cấu hình CORS.`,
    );
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    if (
      response.status === 401 &&
      token &&
      !path.startsWith("/api/Errors/") &&
      !path.startsWith("/api/auth/") &&
      getSession()?.accessToken === token
    ) {
      setSession(null);
      window.dispatchEvent(new Event("bidnet:expired"));
    }
    const validation = data?.errors
      ? Object.values(data.errors).flat().join(" ")
      : "";
    const failure = new Error(
      validation ||
        data?.message ||
        data?.detail ||
        data?.title ||
        `Yêu cầu thất bại (${response.status})`,
    );
    failure.status = response.status;
    failure.code = data?.code;
    throw failure;
  }
  return data;
}

export const json = (method, path, body) =>
  api(path, { method, body: JSON.stringify(body) });

export const money = (amount) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(amount || 0))} ₫`;

// SQL Server DateTime values from this API are UTC but often serialize without a Z suffix.
export const parseApiDate = (value) =>
  value
    ? new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`)
    : null;

export const date = (value) =>
  value ? parseApiDate(value).toLocaleString("vi-VN") : "—";

export function formatCountdown(targetIso, nowMs = Date.now()) {
  const target = parseApiDate(targetIso);
  if (!target) return "";
  const diff = Math.floor((target.getTime() - nowMs) / 1000);
  if (diff <= 0) return "00:00:00";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return days > 0
    ? `${days} ngày ${pad(hours)}:${pad(mins)}:${pad(secs)}`
    : `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

export function mediaUrl(value) {
  if (!value) return undefined;
  if (/^\/api\/files\/\d+$/i.test(value)) return API_BASE + value;
  return /^https?:\/\//i.test(value) ? value : undefined;
}
