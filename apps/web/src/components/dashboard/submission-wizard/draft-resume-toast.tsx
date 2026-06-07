"use client";

import { notify } from "@/lib/ui/notify";
import { useEffect, useRef } from "react";

type Props = {
  readyToSubmit?: boolean;
};

/** One-shot toast when resuming an existing in-progress wizard. */
export function DraftResumeToast({ readyToSubmit = false }: Props) {
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    if (readyToSubmit) {
      // Ready-to-submit banner on the detail page is the primary CTA — skip duplicate toast.
      return;
    }
    notify.info("Continue where you left off", {
      id: "submission-draft-resume",
      description: "Your progress saves automatically as you work.",
    });
  }, [readyToSubmit]);

  return null;
}
