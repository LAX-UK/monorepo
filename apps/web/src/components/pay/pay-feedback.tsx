"use client";

import { Notice } from "@auction/ui/lax";
import { useEffect, useRef } from "react";
import { usePaySession } from "./pay-session";

/**
 * What the last attempt to pay says: a failure, or the new total after the plan changed. It is
 * announced at once and takes focus, so a person who pressed Pay finds out why nothing opened.
 */
export function PayFeedbackNotice() {
  const { feedback } = usePaySession();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feedback) ref.current?.focus();
  }, [feedback]);
  if (!feedback) return null;
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <Notice tone={feedback.tone} alert title={feedback.message}>
        {feedback.detail}
      </Notice>
    </div>
  );
}
