"use client";

import { type RefObject, useCallback, useEffect } from "react";

type UseSubmissionDecisionShortcutsInput = {
  active: boolean;
  panelRootRef: RefObject<HTMLDivElement | null>;
  approveFormRef: RefObject<HTMLFormElement | null>;
};

export function useSubmissionDecisionShortcuts({
  active,
  panelRootRef,
  approveFormRef,
}: UseSubmissionDecisionShortcutsInput) {
  const isPanelShortcutsActive = useCallback(() => {
    const el = panelRootRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, [panelRootRef]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isPanelShortcutsActive()) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const inTextField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el?.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        approveFormRef.current?.requestSubmit();
        return;
      }
      if (inTextField) return;
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        approveFormRef.current?.requestSubmit();
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        document.getElementById("rejectionReason")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, approveFormRef, isPanelShortcutsActive]);
}
