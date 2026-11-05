"use client";

import { updatePurchaseProblemAction } from "@/lib/actions/admin/admin-purchase-problems";
import { isStalePurchaseProblem } from "@/lib/admin/purchase-problems/purchase-problem-errors";
import type { PurchaseProblemView } from "@/lib/data/http/admin-purchase-problems.schema";
import type { ActionResult } from "@/lib/forms/form-result";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PurchaseProblemWriteFailure } from "./purchase-problem-write-failure";

/** The server action a record page calls; injectable so the flow can be tested on its own. */
export type PurchaseProblemWriteActions = { update: typeof updatePurchaseProblemAction };

const SERVER_ACTIONS: PurchaseProblemWriteActions = { update: updatePurchaseProblemAction };

export type PurchaseProblemWriteResult = ActionResult<PurchaseProblemView>;

export function failureOf(
  result: Extract<PurchaseProblemWriteResult, { ok: false }>,
): PurchaseProblemWriteFailure {
  return { message: result.error, stale: isStalePurchaseProblem(result.errorCode) };
}

/**
 * Every change a person can make to one report. Each call sends the version the page loaded;
 * after a change the newer version is kept, so the next one is not taken for a stale edit. The
 * page refreshes after each success.
 */
export function usePurchaseProblemWrites(
  id: string,
  loadedVersion: number,
  api: PurchaseProblemWriteActions = SERVER_ACTIONS,
) {
  const router = useRouter();
  const version = useRef(loadedVersion);
  const [busy, setBusy] = useState(false);

  // A reload hands the page the report's real version.
  useEffect(() => {
    version.current = loadedVersion;
  }, [loadedVersion]);

  const patch = useCallback(
    async (body: Record<string, unknown>): Promise<PurchaseProblemWriteResult> => {
      setBusy(true);
      try {
        const result = await api.update(id, { ...body, version: version.current });
        if (result.ok && result.data) {
          version.current = result.data.version;
          router.refresh();
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [api, id, router],
  );

  return { busy, patch, reload: () => router.refresh() };
}

export type PurchaseProblemWrites = ReturnType<typeof usePurchaseProblemWrites>;
