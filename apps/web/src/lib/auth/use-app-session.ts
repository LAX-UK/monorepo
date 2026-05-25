"use client";

import { AuthSessionContext } from "@/lib/auth/auth-session-provider";
import type { SessionUser } from "@/lib/data/contracts";
import { useContext } from "react";

export function useAppSession(): { user: SessionUser | null; pending: boolean } {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAppSession must be used within AuthSessionProvider");
  }
  return { user: ctx.user, pending: ctx.pending };
}
