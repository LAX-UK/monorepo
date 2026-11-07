"use client";

import { PAY_COPY } from "@/lib/pay/pay-copy";
import { Button, Notice } from "@auction/ui/lax";
import { useEffect, useRef } from "react";
import { usePaySession } from "./pay-session";

/**
 * What the last attempt to pay says: a failure, the new total after the plan changed, or that the
 * secure payment page did not open in time (with a way to try again). It is announced at once and
 * takes focus, so a person who pressed Pay finds out why nothing opened.
 */
export function PayFeedbackNotice() {
  const { feedback, openTimedOut, retry, pending } = usePaySession();
  const ref = useRef<HTMLDivElement>(null);
  const showing = Boolean(feedback) || openTimedOut;
  useEffect(() => {
    if (showing) ref.current?.focus();
  }, [showing]);
  if (!showing) return null;
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {openTimedOut ? (
        <Notice
          tone="danger"
          alert
          title={PAY_COPY.openFailedTitle}
          actions={
            <Button variant="secondary" disabled={pending} onClick={retry}>
              {PAY_COPY.tryAgain}
            </Button>
          }
        >
          {PAY_COPY.openFailedBody}
        </Notice>
      ) : feedback ? (
        <Notice tone={feedback.tone} alert title={feedback.message}>
          {feedback.detail}
        </Notice>
      ) : null}
    </div>
  );
}
