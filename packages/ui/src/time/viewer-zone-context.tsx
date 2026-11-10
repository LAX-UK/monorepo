"use client";

import { type ViewerZone, decodeViewerZone, encodeViewerZone } from "@auction/datetime";
import { type ReactNode, createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { getClientViewerZoneSnapshot, subscribeViewerZone } from "./viewer-zone-store.js";

/** What the server knew when it drew the page; also what React hydrates against. */
const ServerViewerZoneContext = createContext<ViewerZone>(null);

export function ViewerZoneProvider({
  initial,
  children,
}: {
  initial: ViewerZone;
  children: ReactNode;
}) {
  return (
    <ServerViewerZoneContext.Provider value={initial}>{children}</ServerViewerZoneContext.Provider>
  );
}

/**
 * The visitor's zone. The server's reading is the server snapshot, so hydration always agrees
 * with the HTML; afterwards the browser's own reading takes over. A zone saved in LAX Account
 * (`account`) is the person's own and the device never overrides it.
 */
export function useViewerZone(): ViewerZone {
  const server = useContext(ServerViewerZoneContext);
  const serverSnapshot = encodeViewerZone(server);
  const snapshot = useSyncExternalStore(
    subscribeViewerZone,
    getClientViewerZoneSnapshot,
    () => serverSnapshot,
  );
  return useMemo(
    () => (server?.source === "account" ? server : decodeViewerZone(snapshot)),
    [server, snapshot],
  );
}
