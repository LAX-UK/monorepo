"use client";

import type { ClientLayout } from "@/lib/navigation/client-layout";
import { type ReactNode, createContext, useContext } from "react";

/** Outside the client area (staff pages, tests) pages keep the workspace frame they had. */
const ClientLayoutContext = createContext<ClientLayout>("workspace");

/** Tells the shared page parts which frame the client layout chose for this account. */
export function ClientLayoutProvider({
  layout,
  children,
}: {
  layout: ClientLayout;
  children: ReactNode;
}) {
  return <ClientLayoutContext.Provider value={layout}>{children}</ClientLayoutContext.Provider>;
}

/** The frame the client layout chose; pages read it through shared parts, never decide it. */
export function useClientLayout(): ClientLayout {
  return useContext(ClientLayoutContext);
}
