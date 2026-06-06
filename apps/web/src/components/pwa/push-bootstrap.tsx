"use client";

import { useAppSession } from "@/lib/auth/use-app-session";
import { getNotificationPermission, isPushSupported } from "@/lib/push/capability";
import { getPushClient } from "@/lib/push/push-client";
import { useEffect } from "react";

/** Registers the service worker for authenticated users and syncs existing push subscriptions. */
export function PushBootstrap() {
  const { user } = useAppSession();

  useEffect(() => {
    if (!user || !isPushSupported()) return;

    const client = getPushClient();
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await client.registerServiceWorker();
        if (cancelled || getNotificationPermission() !== "granted") return;
        const key = await client.fetchVapidPublicKey();
        if (!key || cancelled) return;
        const sub = await client.getBrowserSubscription();
        if (sub) {
          await client.sync(key);
        }
      } catch {
        // Push bootstrap is best-effort; settings UI surfaces actionable errors.
      }
    };

    void bootstrap();

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") {
        void (async () => {
          const key = await client.fetchVapidPublicKey();
          if (key) await client.sync(key);
        })();
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [user]);

  return null;
}
