import React, { useEffect, useState } from "react";
import { api, json } from "./api";
import useRemote from "./useRemote";
import { Modal, PageHeader, EmptyState, LoadingState, ErrorState, useConfirm } from "./UI.jsx";

const Notice = ({ error }) =>
  error && <div className="notice error">{error}</div>;
export function AdminCategories({ notify }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = useRemote(() => api("/api/Categories"), []);
  const [current, setCurrent] = useState(null),
    [error, setError] = useState("");
  const edit = async (id) => {
    setBusy(true);
    try {
      setCurrent(await api(`/api/Categories/${id}`));
      setError("");
      setEditing(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form).entries());
    try {
      await json(
        current ? "PUT" : "POST",
        current ? `/api/Categories/${current.id}` : "/api/Categories",
        { name: v.name, description: v.description || null },
      );
      setCurrent(null);
      setEditing(false);
      form.reset();
      list.reload();
      notify("Đã lưu danh mục.");
      setError("");
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    if (
      !await confirm({ title: "Xóa danh mục", message: "Danh mục chưa có sản phẩm sẽ được xóa khỏi danh sách. Thao tác này không thể hoàn tác.", action: "Xóa danh mục", danger: true })
    )
      return;
    setBusy(true);
    try {
      await api(`/api/Categories/${id}`, { method: "DELETE" });
      if (current?.id === id) setCurrent(null);
      setError("");
      list.reload();
      notify("Đã xóa danh mục.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader eyebrow="Tổ chức dữ liệu" title="Danh mục sản phẩm" description="Quản lý nhóm sản phẩm và mô tả. Danh mục đã có sản phẩm được giữ lại để bảo toàn dữ liệu."><button className="btn dark" disabled={busy} onClick={() => { setCurrent(null); setError(""); setEditing(true); }}>+ Thêm danh mục</button></PageHeader>
      {!editing && <Notice error={error} />}
      <div>
        <div className="panel table-wrap">
          {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
          {!list.error && !list.data && <LoadingState label="Đang tải danh mục…" />}
          {list.data?.length === 0 && <EmptyState title="Chưa có danh mục" description="Thêm danh mục đầu tiên để tổ chức sản phẩm trên sàn." />}
          {!!list.data?.length && <table className="table">
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
                        disabled={busy}
                        onClick={() => edit(c.id)}
                      >
                        Sửa
                      </button>
                      <button
                        className="btn danger"
                        disabled={busy || c.productCount > 0}
                        title={c.productCount > 0 ? "Danh mục đang có sản phẩm" : "Xóa danh mục"}
                        onClick={() => remove(c.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
        {editing && <Modal title={current ? `Sửa danh mục #${current.id}` : "Thêm danh mục"} busy={busy} onClose={() => { setEditing(false); setError(""); }}>
          <form key={current?.id || "new"} onSubmit={save}>
            <div className="field">
              <label htmlFor="catName">Tên</label>
              <input
                id="catName"
                name="name"
                defaultValue={current?.name || ""}
                maxLength={100}
                required
                autoFocus
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="catDescription">Mô tả</label>
              <textarea
                id="catDescription"
                name="description"
                defaultValue={current?.description || ""}
                maxLength={500}
                disabled={busy}
              />
            </div>
            <Notice error={error} />
            <div className="dialog-actions">
              <button className="btn dark" disabled={busy}>{busy ? "Đang lưu…" : "Lưu danh mục"}</button>
              {(
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Quay lại
                </button>
              )}
            </div>
          </form>
        </Modal>}
      </div>
    </>
  );
}
export function Diagnostics() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null),
    [error, setError] = useState("");
  const run = async (path) => {
    if (busy) return;
    setBusy(true);
    try {
      await api(path);
      setResult(`${path}: phản hồi thành công`);
      setError("");
    } catch (e) {
      setResult(path);
      setError(
        [e.status && "HTTP " + e.status, e.message].filter(Boolean).join(" · "),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div><PageHeader eyebrow="Công cụ kỹ thuật" title="Kiểm tra phản hồi API" description="Đối chiếu cách hệ thống hiển thị lỗi trong môi trường Development." /><section className="workspace-section diagnostics-panel">
      <p className="muted">
        Các endpoint dưới đây cố ý tạo lỗi để kiểm tra định dạng phản hồi của
        backend trong môi trường Development.
      </p>
      <div className="actions">
        {["bad-request", "not-found", "unauthorized", "server"].map((x) => (
          <button
            key={x}
              className="btn secondary"
              disabled={busy}
            onClick={() => run(`/api/Errors/${x}`)}
          >
            {x}
          </button>
        ))}
      </div>
      {result && <div className="notice">{result}</div>}
      {busy && <LoadingState label="Đang kiểm tra phản hồi…" />}
      <Notice error={error} />
    </section></div>
  );
}
