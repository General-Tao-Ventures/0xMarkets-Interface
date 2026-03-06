import { useEffect, useState } from "react";

import { useKeeperWebSocket, useKeeperWebSocketState } from "lib/keeperWebSocket";

import "./KeeperStatusBanner.scss";

const CHECK_INTERVAL_MS = 60_000;
const KEEPER_HEALTH_URL = "/api/keeper/prices/tickers";

export function KeeperStatusBanner() {
  const [isKeeperDown, setIsKeeperDown] = useState(false);

  // Initialize WebSocket connection on app load (this component is always mounted)
  useKeeperWebSocket();
  const wsState = useKeeperWebSocketState();

  useEffect(() => {
    let mounted = true;

    async function checkKeeperHealth() {
      try {
        const response = await fetch(KEEPER_HEALTH_URL, { method: "GET" });
        if (mounted) {
          setIsKeeperDown(!response.ok);
        }
      } catch {
        if (mounted) {
          setIsKeeperDown(true);
        }
      }
    }

    checkKeeperHealth();

    const interval = setInterval(checkKeeperHealth, CHECK_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {isKeeperDown && (
        <div className="KeeperStatusBanner">
          System maintenance in progress. You can browse markets but trading operations may be delayed.
        </div>
      )}
      {!isKeeperDown && wsState === "reconnecting" && (
        <div className="KeeperStatusBanner-ws-reconnecting">
          Reconnecting to live price feed...
        </div>
      )}
    </>
  );
}
