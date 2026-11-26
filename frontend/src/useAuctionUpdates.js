import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE, getSession } from "./api";

export default function useAuctionUpdates(productIds, onBid) {
  const callback = useRef(onBid);
  callback.current = onBid;
  const [error, setError] = useState("");
  const ids = [...new Set(productIds.map(Number).filter(Number.isInteger))].sort(
    (a, b) => a - b,
  );
  const key = ids.join(",");

  useEffect(() => {
    if (!key || !getSession()?.accessToken) return undefined;
    let active = true;
    setError("");
    const productIdList = key.split(",").map(Number);
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/auction`, {
        accessTokenFactory: () => getSession()?.accessToken || "",
      })
      .withAutomaticReconnect()
      .build();
    const joinProducts = () =>
      Promise.all(productIdList.map((productId) => connection.invoke("JoinProduct", productId)));

    connection.on("BidAccepted", (event) => callback.current?.(event));
    connection.onreconnected(() => {
      joinProducts()
        .then(() => active && setError(""))
        .catch((cause) => active && setError(cause.message || "Không thể kết nối cập nhật đấu giá."));
    });
    connection.onclose((cause) => {
      if (active && cause) setError(cause.message || "Mất kết nối cập nhật đấu giá.");
    });
    connection.start()
      .then(joinProducts)
      .then(() => active && setError(""))
      .catch((cause) => {
        if (active) setError(cause.message || "Không thể kết nối cập nhật đấu giá.");
        return connection.stop();
      });
    return () => {
      active = false;
      connection.stop();
    };
  }, [key]);
  return error;
}
