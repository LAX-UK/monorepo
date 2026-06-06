"use client";

import { getNotificationPermission, isPushSupported } from "@/lib/push/capability";
import { type PushClientSnapshot, getPushClient } from "@/lib/push/push-client";
import { useCallback, useEffect, useState } from "react";

export type PushSubscriptionUiState = PushClientSnapshot & {
  loading: boolean;
  busy: boolean;
};

const EMPTY: PushClientSnapshot = {
  supported: false,
  permission: "default",
  hasBrowserSubscription: false,
  hasServerSubscription: false,
};

export function usePushSubscription({ enabled = true }: { enabled?: boolean } = {}) {
  const [state, setState] = useState<PushSubscriptionUiState>({
    ...EMPTY,
    loading: enabled,
    busy: false,
  });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ ...EMPTY, loading: false, busy: false });
      return;
    }
    const client = getPushClient();
    try {
      const snapshot = await client.getSnapshot();
      setState((prev) => ({ ...snapshot, loading: false, busy: prev.busy }));
    } catch {
      setState({
        supported: isPushSupported(),
        permission: getNotificationPermission(),
        hasBrowserSubscription: false,
        hasServerSubscription: false,
        loading: false,
        busy: false,
      });
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, refresh]);

  const enable = useCallback(async () => {
    setState((prev) => ({ ...prev, busy: true }));
    try {
      const client = getPushClient();
      const key = await client.fetchVapidPublicKey();
      if (!key) {
        throw new Error("Push is not configured on the server (missing VAPID keys).");
      }
      await client.subscribe(key);
      await refresh();
    } finally {
      setState((prev) => ({ ...prev, busy: false }));
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setState((prev) => ({ ...prev, busy: true }));
    try {
      await getPushClient().unsubscribe();
      await refresh();
    } finally {
      setState((prev) => ({ ...prev, busy: false }));
    }
  }, [refresh]);

  const sync = useCallback(async () => {
    const client = getPushClient();
    const key = await client.fetchVapidPublicKey();
    if (!key) return;
    await client.sync(key);
    await refresh();
  }, [refresh]);

  return { ...state, refresh, enable, disable, sync };
}
