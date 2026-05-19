"use client";

import { useEffect } from "react";

type Props = {
  isDirty: boolean;
  message?: string;
};

/** Warn before leaving the page when a form has unsaved changes. */
export function FormDirtyGuard({
  isDirty,
  message = "You have unsaved changes. Leave this page?",
}: Props) {
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, message]);

  return null;
}
