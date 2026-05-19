"use client";

import { Button } from "@auction/ui/components/button";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

const COOKIE = "lax.staffWhatsNew.dismissed";
const VERSION = "2026-05-staff-ux";

/** One-time staff dashboard UX announcement (dismiss persists in localStorage). */
export function StaffWhatsNewBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(COOKIE);
      setVisible(dismissed !== VERSION);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <output className="mb-6 flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary-container/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-body text-sm text-on-surface">
        <span className="font-semibold">Staff dashboard refresh:</span> mobile lists, quick-create
        in the header, bottom navigation on phones, and embedded activity on lot detail. Press{" "}
        <kbd className="rounded border border-border-hairline bg-surface px-1.5 py-0.5 font-mono text-xs">
          ⌘K
        </kbd>{" "}
        to jump anywhere.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-9 shrink-0 gap-1 self-end sm:self-center"
        onClick={() => {
          try {
            localStorage.setItem(COOKIE, VERSION);
          } catch {
            /* ignore */
          }
          setVisible(false);
        }}
      >
        <X className="size-4" aria-hidden />
        Dismiss
      </Button>
    </output>
  );
}
