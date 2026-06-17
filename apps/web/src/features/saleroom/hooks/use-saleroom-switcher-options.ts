"use client";

import type { SaleroomSwitcherOption } from "@/features/saleroom/components/clerk-console/saleroom-sale-switcher";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import { filterSaleroomHubRows } from "@/lib/data/view-models/admin-saleroom-hub.vm";
import { useCallback, useEffect, useState } from "react";

async function fetchSwitcherOptions(): Promise<SaleroomSwitcherOption[]> {
  const salesRes = await browserFetch(`${browserApiBase()}/sales?limit=50`, { cache: "no-store" });
  if (!salesRes.ok) {
    throw new Error(`Failed to load sales: ${salesRes.status}`);
  }
  const salesBody = (await salesRes.json()) as { data?: { items?: AdminSaleListRow[] } };
  const rows = filterSaleroomHubRows(salesBody.data?.items ?? []);
  if (rows.length === 0) return [];

  const saleIds = rows.map((row) => row.sale.id);
  const sessionsRes = await browserFetch(
    `${browserApiBase()}/admin/saleroom/sessions?saleIds=${saleIds.map(encodeURIComponent).join(",")}`,
    { cache: "no-store" },
  );
  if (!sessionsRes.ok) {
    throw new Error(`Failed to load saleroom sessions: ${sessionsRes.status}`);
  }
  const sessionsBody = (await sessionsRes.json()) as {
    sessions?: Array<{ saleId: string; status: SaleroomSwitcherOption["sessionStatus"] }>;
  };
  const sessions = sessionsBody.sessions ?? [];

  return rows.map((row) => {
    const match = sessions.find((session) => session.saleId === row.sale.id);
    return {
      id: row.sale.id,
      title: row.sale.title ?? "Sale",
      sessionStatus: match?.status ?? "none",
    };
  });
}

export function useSaleroomSwitcherOptions() {
  const [options, setOptions] = useState<SaleroomSwitcherOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOptions(await fetchSwitcherOptions());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load rooms");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { options, isLoading, error, reload: load };
}
