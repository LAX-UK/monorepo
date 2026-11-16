"use client";

import {
  attachQuarantinedEmailAction,
  discardQuarantinedEmailAction,
} from "@/lib/actions/admin/admin-enquiry-quarantine";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/** The server actions the record calls; injectable so the flow can be tested on its own. */
export type QuarantineReviewActions = {
  attach: typeof attachQuarantinedEmailAction;
  discard: typeof discardQuarantinedEmailAction;
};

const SERVER_ACTIONS: QuarantineReviewActions = {
  attach: attachQuarantinedEmailAction,
  discard: discardQuarantinedEmailAction,
};

/**
 * Attach or discard one held email. Each keeps the dialog open with the API's sentence when it is
 * refused, and refreshes the page when it goes through.
 */
export function useQuarantineReview(id: string, api: QuarantineReviewActions = SERVER_ACTIONS) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = useCallback(
    async <T>(call: () => Promise<{ ok: true; data?: T } | { ok: false; error: string }>) => {
      setBusy(true);
      setFailure(null);
      try {
        const result = await call();
        if (result.ok) router.refresh();
        else setFailure(result.error);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const attach = useCallback(
    (enquiryReference: string) => run(() => api.attach(id, { enquiryReference })),
    [api, id, run],
  );
  const discard = useCallback(() => run(() => api.discard(id)), [api, id, run]);

  return { busy, failure, clearFailure: () => setFailure(null), attach, discard };
}

export type QuarantineReview = ReturnType<typeof useQuarantineReview>;
