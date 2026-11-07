"use client";

import { PAY_COPY } from "@/lib/pay/pay-copy";
import { nextPollDelay, pollPolicyFor } from "@/lib/pay/pay-poll";
import type { PayProgressVm } from "@/lib/pay/pay-progress.vm";
import { payProgressAction } from "@/lib/pay/pay.actions";
import { Button, ButtonLink, Notice } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Watches a payment that is under way. It asks the server, with a growing wait between asks,
 * whether the payment has moved, and reads the page again when it has; it stops when the time is
 * up or the payment reaches a final state (the page then shows the state it moved to). A card
 * payment being confirmed says so and, once the time is up, says it is still confirming with a
 * way to check and to reach settlements. It never offers to pay again.
 */
export function PayProgressWatch({ progress }: { progress: PayProgressVm }) {
  const router = useRouter();
  // Read through a ref so the watch is not restarted when the router object is replaced.
  const routerRef = useRef(router);
  routerRef.current = router;
  const [stopped, setStopped] = useState(false);
  const { stage, signature, lotIds } = progress;

  useEffect(() => {
    setStopped(false);
    const policy = pollPolicyFor(stage);
    const started = Date.now();
    let attempt = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const wait = nextPollDelay(policy, attempt, Date.now() - started);
      if (wait === null) {
        setStopped(true);
        return;
      }
      timer = setTimeout(async () => {
        attempt += 1;
        if (document.visibilityState === "visible") {
          const now = await payProgressAction(lotIds).catch(() => null);
          if (cancelled) return;
          // A different answer means the payment moved: read the page again and stop here.
          if (now !== null && now !== signature) {
            routerRef.current.refresh();
            return;
          }
        }
        schedule();
      }, wait);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [stage, signature, lotIds]);

  if (stage !== "confirming") return null;
  return stopped ? (
    <Notice
      tone="info"
      title={PAY_COPY.stillConfirmingTitle}
      actions={
        <>
          <Button variant="secondary" onClick={() => router.refresh()}>
            {PAY_COPY.refresh}
          </Button>
          <ButtonLink href={progress.contactHref} variant="secondary">
            {PAY_COPY.contactSettlements}
          </ButtonLink>
        </>
      }
    >
      {PAY_COPY.stillConfirmingBody}
    </Notice>
  ) : (
    <Notice tone="info" title={PAY_COPY.confirmingTitle}>
      {PAY_COPY.confirmingLiveBody}
    </Notice>
  );
}
