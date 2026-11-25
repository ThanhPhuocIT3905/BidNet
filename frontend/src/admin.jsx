import React, { useEffect, useState } from "react";
import { api, json } from "./api";

function useRemote(fn, deps = []) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
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
  error && <div className="notice error">{error}</div>;
export function AdminCategories({ notify }) {
  const list = useRemote(() => api("/api/Categories"), []);
  const [current, setCurrent] = useState(null),
    [error, setError] = useState("");
  const edit = async (id) => {
    try {
      setCurrent(await api(`/api/Categories/${id}`));
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
        current ? `/api/Categories/${current.id}` : "/api/Categories",
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
      await api(`/api/Categories/${id}`, { method: "DELETE" });
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
        <div className="panel table-wrap">
          <Notice error={list.error} />
          {!list.error && !list.data && <p role="status">Đang tải danh mục…</p>}
          {list.data?.length === 0 && <p>Chưa có danh mục.</p>}
          <table className="table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Mô tả</th>
                <th>Sản phẩm</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.description || "—"}</td>
                  <td>{c.productCount}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn secondary"
                        onClick={() => edit(c.id)}
                      >
                        Sửa
                      </button>
                      <button
                        className="btn danger"
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
        <div className="panel">
          <h2>{current ? `Sửa danh mục #${current.id}` : "Thêm danh mục"}</h2>
          <form key={current?.id || "new"} onSubmit={save}>
            <div className="field">
              <label htmlFor="catName">Tên</label>
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
              <button className="btn dark">Lưu</button>
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
  const [result, setResult] = useState(null),
    [error, setError] = useState("");
  const run = async (path) => {
    try {
      await api(path);
      setResult(`${path}: phản hồi thành công`);
      setError("");
    } catch (e) {
      setResult(path);
      setError(
        [e.status && "HTTP " + e.status, e.message].filter(Boolean).join(" · "),
      );
    }
  };
  return (
    <div className="panel form-wrap">
      <h1>Kiểm tra phản hồi API</h1>

      <div className="actions">
        {[
          ["Danh mục", "/api/categories"],
          ["Phiên đấu giá", "/api/products?pageSize=1"],
          ["Quyền quản trị", "/api/admin/users?pageSize=1"],
        ].map(([x, path]) => (
          <button key={x} className="btn secondary" onClick={() => run(path)}>
            {x}
          </button>
        ))}
      </div>
      {result && <div className="notice">{result}</div>}
      <Notice error={error} />
    </div>
  );
}
