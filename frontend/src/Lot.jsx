import React, { useState } from 'react';

const PLACEHOLDER = /^\/images\/(tech|watch|art|vehicle|sport|home)\.svg$/;

// Ảnh minh họa theo danh mục không phải ảnh thật của sản phẩm.
export const isPlaceholderImage = (url) => !url || PLACEHOLDER.test(url);

export function LotPhoto({ item, priority = false }) {
  const [failed, setFailed] = useState(null);
  if (item.imageUrl && !isPlaceholderImage(item.imageUrl) && failed !== item.imageUrl) {
    return <img src={item.imageUrl} alt={item.name} loading={priority ? 'eager' : 'lazy'}
      onError={() => setFailed(item.imageUrl)} />;
  }
  return <div className="lot-fallback" aria-label="Chưa có ảnh sản phẩm">
    <span>Chưa có ảnh sản phẩm</span><b>#{String(item.id).padStart(3, '0')}</b>
  </div>;
}

export function priceLabel(item) {
  if (item.status === 'Scheduled') return 'Giá khởi điểm';
  if (item.status === 'Completed' && item.winnerId) return 'Giá trúng';
  if (item.status === 'Completed' || item.status === 'Cancelled') return 'Giá cuối phiên';
  return 'Giá hiện tại';
}
