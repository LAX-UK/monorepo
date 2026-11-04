"use client";

import {
  closeDataRequestAction,
  continueDataRequestAction,
  extendDataRequestAction,
  patchDataRequestAction,
} from "@/lib/actions/admin/admin-data-requests";
import { isStaleDataRequest } from "@/lib/admin/data-requests/data-request-errors";
import type { ActionResult } from "@/lib/forms/form-result";
import type { DataRequestRecord } from "@auction/identity-contracts/data-requests";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** The server actions a record page calls; injectable so the flow can be tested on its own. */
export type DataRequestWriteActions = {
  patch: typeof patchDataRequestAction;
  extend: typeof extendDataRequestAction;
  close: typeof closeDataRequestAction;
  continueManually: typeof continueDataRequestAction;
};

const SERVER_ACTIONS: DataRequestWriteActions = {
  patch: patchDataRequestAction,
  extend: extendDataRequestAction,
  close: closeDataRequestAction,
  continueManually: continueDataRequestAction,
};

export type WriteResult = ActionResult<DataRequestRecord>;

/** A failed write as the page shows it: the sentence, and whether the record changed under the editor. */
export type WriteFailure = { message: string; stale: boolean };

export function failureOf(result: Extract<WriteResult, { ok: false }>): WriteFailure {
  return { message: result.error, stale: isStaleDataRequest(result.errorCode) };
}

/**
 * Every change a person can make to one request. Each call sends the version the page loaded;
 * after a change the newer version is kept, so the next one (or an Undo) is not taken for a
 * stale edit. The page refreshes after each success.
 */
export function useDataRequestWrites(
  reference: string,
  loadedVersion: number,
  api: DataRequestWriteActions = SERVER_ACTIONS,
) {
  const router = useRouter();
  const version = useRef(loadedVersion);
  const [busy, setBusy] = useState(false);

  // A reload hands the page the record's real version.
  useEffect(() => {
    version.current = loadedVersion;
  }, [loadedVersion]);

  const run = useCallback(
    async (call: (version: number) => Promise<WriteResult>): Promise<WriteResult> => {
      setBusy(true);
      try {
        const result = await call(version.current);
        if (result.ok && result.data) {
          version.current = result.data.version;
          router.refresh();
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  return {
    busy,
    reload: () => router.refresh(),
    patch: (body: Record<string, unknown>) =>
      run((v) => api.patch(reference, { ...body, version: v })),
    extend: (body: Record<string, unknown>) =>
      run((v) => api.extend(reference, { ...body, version: v })),
    close: (body: Record<string, unknown>) =>
      run((v) => api.close(reference, { ...body, version: v })),
    continueManually: () => run(() => api.continueManually(reference)),
  };
}

export type DataRequestWrites = ReturnType<typeof useDataRequestWrites>;
