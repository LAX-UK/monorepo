"use client";

import type { SaleroomSwitcherOption } from "@/features/saleroom/components/clerk-console/saleroom-sale-switcher";
import {
  fetchAdminSaleroomSessionStatuses,
  fetchAdminSalesListForSaleroom,
} from "@/lib/data/http/operations-snapshot.client";
import { filterSaleroomHubRows } from "@/lib/data/view-models/admin-saleroom-hub.vm";
import { useCallback, useEffect, useState } from "react";

async function fetchSwitcherOptions(): Promise<SaleroomSwitcherOption[]> {
  const rows = filterSaleroomHubRows(await fetchAdminSalesListForSaleroom(50));
  if (rows.length === 0) return [];

  const saleIds = rows.map((row) => row.sale.id);
  const sessions = await fetchAdminSaleroomSessionStatuses(saleIds);

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
