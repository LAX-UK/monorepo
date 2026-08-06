"use client";

import { authClient } from "@/lib/auth-client";
import { setupPasswordOnServer } from "@/lib/auth/setup-password.client";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Provider identifiers we surface in the UI. */
export type LinkableProvider = "google" | "apple";

/** A single linked auth identity on the user's account. Mirrors Better
 * Auth's `/list-accounts` response shape.
 */
export type ConnectedAccount = {
  id: string;
  accountId: string;
  providerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  scopes: string[];
};

export type ConnectedAccountsState = {
  /** Raw list as returned by the API; preserved for diagnostics. */
  accounts: ConnectedAccount[];
  /** True when a `credential` (password) row exists. */
  hasPassword: boolean;
  /** The Google account row, if linked. */
  google: ConnectedAccount | null;
  /** The Apple account row, if linked. */
  apple: ConnectedAccount | null;
  /** Count of distinct sign-in methods (password + each social provider). */
  totalMethods: number;
};

const EMPTY_STATE: ConnectedAccountsState = {
  accounts: [],
  hasPassword: false,
  google: null,
  apple: null,
  totalMethods: 0,
};

type MutationResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

type UseConnectedAccountsReturn = {
  state: ConnectedAccountsState;
  /** True only for the very first load. Background refreshes after a
   * mutation do not flip this back to true so the skeleton does not flash.
   */
  loading: boolean;
  /** True while a background refresh is in flight (e.g. right after unlink). */
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** True when unlinking `providerId` would still leave at least one
   * *account row* (password or another social provider). UX guard only —
   * Better Auth enforces server-side.
   *
   * @deprecated Does not account for the email magic-link sign-in method,
   * so it under-counts available methods for verified-email users. Prefer
   * `computeSignInMethods` (`@/lib/auth/sign-in-methods`) composed with the
   * page's `emailVerified` flag, as done in `SecurityAccountMethods`.
   */
  canUnlink: (providerId: LinkableProvider) => boolean;
  linkSocial: (provider: LinkableProvider) => Promise<MutationResult>;
  unlinkAccount: (providerId: LinkableProvider) => Promise<MutationResult>;
  setupPassword: (password: string) => Promise<MutationResult>;
};

/** Narrow surface for presentational components that consume account state. */
export type ConnectedAccountsActions = Pick<
  UseConnectedAccountsReturn,
  "state" | "loading" | "error" | "canUnlink" | "linkSocial" | "unlinkAccount" | "setupPassword"
>;

/** Type-narrowing helper for Better Auth client responses, whose shape
 * varies slightly between fetch and SDK calls.
 */
function isBetterAuthError(value: unknown): value is { message?: string; code?: string } {
  return typeof value === "object" && value !== null;
}

function readMessage(error: unknown, fallback: string): string {
  if (isBetterAuthError(error) && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}

/** Single API surface for the Connected accounts settings section.
 *
 * The hook deliberately wraps {@link authClient} (Better Auth) so the
 * consuming component depends on a narrow, fully-typed interface (DIP).
 * Mutations refresh the list on success.
 */
export function useConnectedAccounts(): UseConnectedAccountsReturn {
  const [state, setState] = useState<ConnectedAccountsState>(EMPTY_STATE);
  /** Has the first load completed yet? Stays false after the first
   * successful refresh so subsequent mutations don't show the skeleton.
   */
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error: err } = await authClient.listAccounts();
      if (err) {
        setError(readMessage(err, "Could not load connected accounts."));
        // Keep stale state on background refresh failure so the UI does
        // not collapse to an all-empty list; first-load failure renders the
        // alert + skeletons via `loading === true`.
        return;
      }
      const accounts = Array.isArray(data) ? data : [];
      const hasPassword = accounts.some((a) => a.providerId === "credential");
      const google = accounts.find((a) => a.providerId === "google") ?? null;
      const apple = accounts.find((a) => a.providerId === "apple") ?? null;
      const totalMethods = (hasPassword ? 1 : 0) + (google ? 1 : 0) + (apple ? 1 : 0);
      setError(null);
      setState({ accounts, hasPassword, google, apple, totalMethods });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load connected accounts.");
    } finally {
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canUnlink = useCallback(
    (providerId: LinkableProvider): boolean => {
      // unlinking would leave the user with at least one other sign-in method.
      let remaining = state.totalMethods;
      if (providerId === "google" && state.google) remaining -= 1;
      else if (providerId === "apple" && state.apple) remaining -= 1;
      return remaining >= 1;
    },
    [state.totalMethods, state.google, state.apple],
  );

  const linkSocial = useCallback<UseConnectedAccountsReturn["linkSocial"]>(async (provider) => {
    const callbackURL = `${window.location.origin}/dashboard/settings?tab=security&linked=${provider}`;
    try {
      const { error: err } = await authClient.linkSocial({ provider, callbackURL });
      if (err) return { ok: false, error: readMessage(err, "Could not start linking.") };
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Could not start linking." };
    }
  }, []);

  const unlinkAccount = useCallback<UseConnectedAccountsReturn["unlinkAccount"]>(
    async (providerId) => {
      try {
        const { error: err } = await authClient.unlinkAccount({ providerId });
        if (err) return { ok: false, error: readMessage(err, "Could not disconnect.") };
        await refresh();
        return { ok: true, value: undefined };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Could not disconnect." };
      }
    },
    [refresh],
  );

  const setupPassword = useCallback<UseConnectedAccountsReturn["setupPassword"]>(
    async (password) => {
      const result = await setupPasswordOnServer(password);
      if (!result.ok) return { ok: false, error: result.error };
      await refresh();
      return { ok: true, value: undefined };
    },
    [refresh],
  );

  const loading = !hasLoadedOnce && refreshing;

  return useMemo(
    () => ({
      state,
      loading,
      refreshing,
      error,
      refresh,
      canUnlink,
      linkSocial,
      unlinkAccount,
      setupPassword,
    }),
    [
      state,
      loading,
      refreshing,
      error,
      refresh,
      canUnlink,
      linkSocial,
      unlinkAccount,
      setupPassword,
    ],
  );
}
