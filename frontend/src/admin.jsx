import React, { useEffect, useState } from "react";
import { api, json } from "./api";

function useRemote(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const reload = async () => {
    try {
      setData(await fn());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    reload();
  }, deps);
  return { data, error, reload };
}

const Notice = ({ error }) =>
  error ? <div className="notice error">{error}</div> : null;

export function AdminCategories({ notify }) {
  const list = useRemote(() => api("/api/categories"), []);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState("");

  const edit = async (id) => {
    try {
      setCurrent(await api(`/api/categories/${id}`));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form).entries());
    try {
      await json(
        current ? "PUT" : "POST",
        current ? `/api/categories/${current.id}` : "/api/categories",
        { name: v.name, description: v.description || null },
      );
      setCurrent(null);
      form.reset();
      list.reload();
      notify("Đã lưu danh mục.");
      setError("");
    } catch (x) {
      setError(x.message);
    }
  };

  const remove = async (id) => {
    if (
      !confirm(
        "Xóa danh mục này? Các sản phẩm thuộc danh mục sẽ được gỡ khỏi danh mục này.",
      )
    )
      return;
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      if (current?.id === id) setCurrent(null);
      setError("");
      list.reload();
      notify("Đã xóa danh mục.");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Quản trị</div>
          <h1>Danh mục sản phẩm</h1>
        </div>
      </div>
      <div className="split">
        <div className="admin-table-card table-wrap">
          <Notice error={list.error} />
          {!list.error && !list.data && (
            <p className="loading" role="status">
              Đang tải danh mục…
            </p>
          )}
          {list.data?.length === 0 && (
            <p className="empty" style={{ border: 0 }}>
              Chưa có danh mục nào.
            </p>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>Tên danh mục</th>
                <th>Mô tả</th>
                <th>Số SP</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td className="muted">{c.description || "—"}</td>
                  <td className="mono">{c.productCount}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn secondary sm"
                        onClick={() => edit(c.id)}
                      >
                        Sửa
                      </button>
                      <button
                        className="btn danger sm"
                        onClick={() => remove(c.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel" style={{ marginTop: 0 }}>
          <h2>{current ? `Sửa danh mục #${current.id}` : "Thêm danh mục mới"}</h2>
          <form key={current?.id || "new"} onSubmit={save}>
            <div className="field">
              <label htmlFor="catName">Tên danh mục</label>
              <input
                id="catName"
                name="name"
                defaultValue={current?.name || ""}
                maxLength={100}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="catDescription">Mô tả</label>
              <textarea
                id="catDescription"
                name="description"
                defaultValue={current?.description || ""}
                maxLength={500}
              />
            </div>
            <Notice error={error} />
            <div className="actions">
              <button className="btn dark">Lưu danh mục</button>
              {current && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setCurrent(null)}
                >
                  Hủy sửa
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export function Diagnostics() {
  const [results, setResults] = useState([]);

  const endpoints = [
    ["Danh mục", "/api/categories"],
    ["Phiên đấu giá", "/api/products?pageSize=1"],
    ["Tài khoản (Admin)", "/api/admin/users?pageSize=1"],
    ["Đơn hàng (Admin)", "/api/orders?pageSize=1"],
    ["Thông báo chưa đọc", "/api/notifications/unread-count"],
  ];

  const run = async (label, path) => {
    const start = performance.now();
    try {
      await api(path);
      const ms = Math.round(performance.now() - start);
      setResults((prev) => [
        { label, path, ok: true, detail: `HTTP 200 OK · ${ms} ms`, time: new Date().toLocaleTimeString("vi-VN") },
        ...prev.slice(0, 9),
      ]);
    } catch (e) {
      setResults((prev) => [
        {
          label,
          path,
          ok: false,
          detail: [e.status && "HTTP " + e.status, e.message]
            .filter(Boolean)
            .join(" · "),
          time: new Date().toLocaleTimeString("vi-VN"),
        },
        ...prev.slice(0, 9),
      ]);
    }
  };

  const runAll = async () => {
    for (const [label, path] of endpoints) {
      await run(label, path);
    }
  };

  return (
    <div className="panel" style={{ marginTop: 0 }}>
      <div className="meta-row" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Hệ thống</div>
          <h1 style={{ margin: "4px 0 0" }}>Kiểm tra kết nối API</h1>
        </div>
        <button className="btn dark" onClick={runAll}>
          Chạy kiểm tra tất cả
        </button>
      </div>
      <div className="actions" style={{ marginBottom: 16 }}>
        {endpoints.map(([label, path]) => (
          <button
            key={path}
            className="btn secondary sm"
            onClick={() => run(label, path)}
          >
            {label}
          </button>
        ))}
      </div>
      {results.map((r, idx) => (
        <div
          key={idx}
          className={`notice ${r.ok ? "success" : "error"} meta-row`}
        >
          <span>
            <strong>{r.label}</strong> (<code className="mono">{r.path}</code>):{" "}
            {r.detail}
          </span>
          <span className="small muted">{r.time}</span>
        </div>
      ))}
    </div>
  );
}
