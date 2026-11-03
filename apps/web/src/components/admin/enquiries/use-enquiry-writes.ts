"use client";

import { updateEnquiryAction } from "@/lib/actions/admin/admin-enquiries";
import { isStaleEnquiry } from "@/lib/admin/enquiries/enquiry-errors";
import type { EnquiryView } from "@/lib/data/http/admin-enquiries.schema";
import type { ActionResult } from "@/lib/forms/form-result";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EnquiryWriteFailure } from "./enquiry-write-failure";

/** The server action a record page calls; injectable so the flow can be tested on its own. */
export type EnquiryWriteActions = { update: typeof updateEnquiryAction };

const SERVER_ACTIONS: EnquiryWriteActions = { update: updateEnquiryAction };

export type EnquiryWriteResult = ActionResult<EnquiryView>;

export function failureOf(result: Extract<EnquiryWriteResult, { ok: false }>): EnquiryWriteFailure {
  return { message: result.error, stale: isStaleEnquiry(result.errorCode) };
}

/**
 * Every change a person can make to one enquiry. Each call sends the version the page loaded;
 * after a change the newer version is kept, so the next one is not taken for a stale edit. The
 * page refreshes after each success.
 */
export function useEnquiryWrites(
  reference: string,
  loadedVersion: number,
  api: EnquiryWriteActions = SERVER_ACTIONS,
) {
  const router = useRouter();
  const version = useRef(loadedVersion);
  const [busy, setBusy] = useState(false);

  // A reload hands the page the enquiry's real version.
  useEffect(() => {
    version.current = loadedVersion;
  }, [loadedVersion]);

  const patch = useCallback(
    async (body: Record<string, unknown>): Promise<EnquiryWriteResult> => {
      setBusy(true);
      try {
        const result = await api.update(reference, { ...body, version: version.current });
        if (result.ok && result.data) {
          version.current = result.data.version;
          router.refresh();
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [api, reference, router],
  );

  return { busy, patch, reload: () => router.refresh() };
}

export type EnquiryWrites = ReturnType<typeof useEnquiryWrites>;
