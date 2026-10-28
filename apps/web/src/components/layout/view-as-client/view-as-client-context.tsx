"use client";

import { type ReactNode, createContext, useContext } from "react";

/** The client support is viewing Bid as, or `null` in a normal session. */
export type ViewingAsClient = { name: string } | null;

const ViewAsClientContext = createContext<ViewingAsClient>(null);

export function ViewAsClientProvider({
  viewingAs,
  children,
}: {
  viewingAs: ViewingAsClient;
  children: ReactNode;
}) {
  return <ViewAsClientContext.Provider value={viewingAs}>{children}</ViewAsClientContext.Provider>;
}

export function useViewingAsClient(): ViewingAsClient {
  return useContext(ViewAsClientContext);
}
