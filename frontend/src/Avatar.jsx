import React, { useState } from "react";

export default function Avatar({ user }) {
  const [failed, setFailed] = useState(null);
  const name = user?.fullName || user?.username || "?";
  return <span className="avatar" aria-label={`Ảnh đại diện ${name}`}>{user?.avatarUrl && failed !== user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(user.avatarUrl)} /> : name.slice(0, 1).toUpperCase()}</span>;
}
