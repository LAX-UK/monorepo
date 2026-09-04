"use client";

/**
 * Root auth session provider backed only by the Bid BFF session.
 *
 * - Seeds client state from server `SessionUser` (`GET /users/me`) when Better Auth
 *   has not resolved yet (`clientUser ?? serverUser`).
 * - Cross-tab sync: listens for our `lax-auth` signed-in broadcast (Better Auth does
 *   not broadcast email sign-in) and Better Auth's `better-auth.message` storage event
 *   (sign-out / user updates). Window-focus refetch is handled by Better Auth defaults.
 * - Do not call `authClient.useSession()` outside this module (enforced by lint script).
 */
import { AUTH_BROADCAST_CHANNEL, type AuthBroadcastMessage } from "@/lib/auth/auth-broadcast";
import type { SessionUser } from "@/lib/data/contracts";
import { fetchCurrentBffSession } from "@/lib/data/http/auth-session.client";
import { type ReactNode, createContext, useCallback, useEffect, useMemo, useState } from "react";

/** Better Auth cross-tab session signal key (localStorage storage event). */
export const BETTER_AUTH_MESSAGE_STORAGE_KEY = "better-auth.message";

export type AuthSessionContextValue = {
  user: SessionUser | null;
  pending: boolean;
  refetch: () => Promise<void>;
};

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({
  serverUser,
  authCookiePresent,
  children,
}: {
  serverUser: SessionUser | null;
  /** When false, SSR already confirmed a signed-out visitor — skip client pending chrome. */
  authCookiePresent: boolean;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(serverUser);
  const [pending, setPending] = useState(serverUser == null && authCookiePresent);

  const refetch = useCallback(async () => {
    setPending(true);
    try {
      setUser(await fetchCurrentBffSession());
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    bc.onmessage = (event: MessageEvent<AuthBroadcastMessage>) => {
      if (event.data?.type === "signed-in") {
        void refetch();
      }
    };
    return () => bc.close();
  }, [refetch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === BETTER_AUTH_MESSAGE_STORAGE_KEY && event.newValue) {
        void refetch();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refetch]);

  const value = useMemo(() => ({ user, pending, refetch }), [user, pending, refetch]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}
