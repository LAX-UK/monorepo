"use client";

import { AuthSessionContext } from "@/lib/auth/auth-session-provider";
import { useContext } from "react";

export function useRefetchAppSession(): () => Promise<void> {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useRefetchAppSession must be used within AuthSessionProvider");
  }
  return ctx.refetch;
}
