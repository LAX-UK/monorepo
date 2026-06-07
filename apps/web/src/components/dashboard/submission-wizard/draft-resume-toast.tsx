"use client";

import { notify } from "@/lib/ui/notify";
import { useEffect, useRef } from "react";

/** One-shot toast when resuming an existing draft wizard. */
export function DraftResumeToast() {
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    notify.info("Continue where you left off", {
      id: "submission-draft-resume",
      description: "Your progress saves automatically as you work.",
    });
  }, []);

  return null;
}
