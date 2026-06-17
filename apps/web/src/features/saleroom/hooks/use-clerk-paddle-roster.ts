"use client";

import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import { fetchAdminSalePaddleRoster } from "@/lib/data/http/operations-snapshot.client";
import { useCallback, useEffect, useState } from "react";

export type ClerkPaddleRosterFetcher = (saleId: string) => Promise<AdminPaddleRosterEntry[]>;

type Options = {
  saleId: string;
  initialRoster: AdminPaddleRosterEntry[];
  fetchRoster?: ClerkPaddleRosterFetcher;
};

export function useClerkPaddleRoster({
  saleId,
  initialRoster,
  fetchRoster = fetchAdminSalePaddleRoster,
}: Options) {
  const [roster, setRoster] = useState(initialRoster);

  useEffect(() => {
    setRoster(initialRoster);
  }, [initialRoster]);

  const refreshRoster = useCallback(async () => {
    const next = await fetchRoster(saleId);
    setRoster(next);
    return next;
  }, [fetchRoster, saleId]);

  return { roster, refreshRoster };
}
