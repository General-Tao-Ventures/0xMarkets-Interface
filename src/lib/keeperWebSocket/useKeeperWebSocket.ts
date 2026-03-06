import { useEffect, useRef, useState } from "react";
import type { ConnectionState } from "./types";
import { KeeperWebSocketManager, getKeeperWebSocketUrl } from "./KeeperWebSocketManager";

let manager: KeeperWebSocketManager | null = null;
let refCount = 0;

export function getManager(): KeeperWebSocketManager {
  if (!manager) {
    manager = new KeeperWebSocketManager(getKeeperWebSocketUrl());
  }
  return manager;
}

/**
 * Hook that provides access to the singleton KeeperWebSocketManager.
 * Manages connection lifecycle with ref-counting -- connects on first mount,
 * disconnects only when all consumers unmount.
 */
export function useKeeperWebSocket(): { manager: KeeperWebSocketManager } {
  const mgr = getManager();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    refCount++;
    if (refCount === 1) {
      mgr.connect();
    }

    return () => {
      mountedRef.current = false;
      refCount--;
      if (refCount === 0) {
        mgr.disconnect();
        manager = null;
      }
    };
  }, [mgr]);

  return { manager: mgr };
}

/**
 * Hook that provides reactive connection state for the keeper WebSocket.
 * Re-renders the component whenever the connection state changes.
 */
export function useKeeperWebSocketState(): ConnectionState {
  const mgr = getManager();
  const [state, setState] = useState<ConnectionState>(mgr.getState());

  useEffect(() => {
    const handler = (newState: ConnectionState) => {
      setState(newState);
    };

    mgr.on("stateChange", handler);

    // Sync initial state in case it changed between render and effect
    setState(mgr.getState());

    return () => {
      mgr.off("stateChange", handler);
    };
  }, [mgr]);

  return state;
}
