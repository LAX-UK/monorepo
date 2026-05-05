"use client";

import { useUserNotifications } from "@/hooks/use-user-notifications";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseUserNotification } from "@/lib/data/http/parse";
import type { UserNotification } from "@auction/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function useUnreadNotifications() {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const client = getBrowserHc();
      const res = await client.users.me.notifications.$get({ query: { limit: "20" } });
      if (!res.ok) {
        setItems([]);
        setLoaded(true);
        return;
      }
      const body = (await res.json()) as { data: unknown[] };
      setItems(body.data.map(parseUserNotification));
      setLoaded(true);
    } catch {
      setItems([]);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onRealtimeNotification = useCallback((n: UserNotification) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === n.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = n;
        return next;
      }
      return [n, ...prev].slice(0, 50);
    });
    toast.info(n.title, {
      id: `inbox-${n.id}`,
      description: n.message,
      duration: 6000,
    });
  }, []);

  useUserNotifications({
    enabled: loaded,
    onNotification: onRealtimeNotification,
  });

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  return { items, setItems, loaded, unread, refresh };
}
