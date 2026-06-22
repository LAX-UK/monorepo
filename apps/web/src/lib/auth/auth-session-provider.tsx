"use client";

/**
 * Root auth session provider — the single owner of `authClient.useSession()`.
 *
 * - Seeds client state from server `SessionUser` (`GET /users/me`) when Better Auth
 *   has not resolved yet (`clientUser ?? serverUser`).
 * - Cross-tab sync: listens for our `lax-auth` signed-in broadcast (Better Auth does
 *   not broadcast email sign-in) and Better Auth's `better-auth.message` storage event
 *   (sign-out / user updates). Window-focus refetch is handled by Better Auth defaults.
 * - Do not call `authClient.useSession()` outside this module (enforced by lint script).
 */
import { authClient } from "@/lib/auth-client";
import { AUTH_BROADCAST_CHANNEL, type AuthBroadcastMessage } from "@/lib/auth/auth-broadcast";
import { type AuthUserLike, mapAuthSessionUser } from "@/lib/auth/map-auth-session-user";
import { refetchAuthSessionClient } from "@/lib/auth/refetch-auth-session.client";
import type { SessionUser } from "@/lib/data/contracts";
import { type ReactNode, createContext, useCallback, useEffect, useMemo } from "react";

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
  const session = authClient.useSession();
  const rawUser = session.data?.user as AuthUserLike | undefined;
  const clientUser = rawUser ? mapAuthSessionUser(rawUser) : null;
  const user = clientUser ?? serverUser ?? null;
  const pending = session.isPending && serverUser == null && authCookiePresent;

  const refetch = useCallback(() => refetchAuthSessionClient(session.refetch), [session.refetch]);

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
