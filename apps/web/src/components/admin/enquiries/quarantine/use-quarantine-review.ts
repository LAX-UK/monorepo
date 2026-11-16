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

/** What an attach sends: the enquiry, the reason, and the confirmation an unverified sender needs. */
export type QuarantineAttachInput = {
  enquiryReference: string;
  reason: string;
  confirmSenderNotVerified: boolean;
};

/**
 * Attach or discard one held email. Each keeps the dialog open with the API's sentence when it is
 * refused, and refreshes the page when it goes through. When the API says the sender needs an
 * explicit confirmation, `needsSenderConfirmation` turns on so the dialog asks for it.
 */
export function useQuarantineReview(id: string, api: QuarantineReviewActions = SERVER_ACTIONS) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [needsSenderConfirmation, setNeedsSenderConfirmation] = useState(false);

  const run = useCallback(
    async <T>(
      call: () => Promise<
        { ok: true; data?: T } | { ok: false; error: string; errorCode?: string }
      >,
    ) => {
      setBusy(true);
      setFailure(null);
      try {
        const result = await call();
        if (result.ok) router.refresh();
        else {
          setFailure(result.error);
          if (result.errorCode === "sender_confirmation_required") {
            setNeedsSenderConfirmation(true);
          }
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const attach = useCallback(
    (input: QuarantineAttachInput) => run(() => api.attach(id, input)),
    [api, id, run],
  );
  const discard = useCallback(
    (reason: string) => run(() => api.discard(id, { reason })),
    [api, id, run],
  );

  return {
    busy,
    failure,
    needsSenderConfirmation,
    clearFailure: () => setFailure(null),
    attach,
    discard,
  };
}

export type QuarantineReview = ReturnType<typeof useQuarantineReview>;
