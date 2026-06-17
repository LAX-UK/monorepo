"use client";

import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { SaleroomDisplayDeviceRow } from "@auction/types";
import { useCallback, useEffect, useState } from "react";

export function useClerkDisplayDevices(saleId: string) {
  const [devices, setDevices] = useState<SaleroomDisplayDeviceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const res = await browserFetch(
        `${browserApiBase()}/admin/sales/${encodeURIComponent(saleId)}/saleroom/display/devices`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setError(`Could not load display devices (${res.status})`);
        return;
      }
      const body = (await res.json()) as { data?: { items?: SaleroomDisplayDeviceRow[] } };
      setDevices(body.data?.items ?? []);
      setError(null);
    } catch {
      setError("Could not load display devices");
    } finally {
      setIsLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    setIsLoading(true);
    void loadDevices();
    const timer = setInterval(() => void loadDevices(), 15_000);
    return () => clearInterval(timer);
  }, [loadDevices]);

  return { devices, isLoading, error, retry: loadDevices };
}
