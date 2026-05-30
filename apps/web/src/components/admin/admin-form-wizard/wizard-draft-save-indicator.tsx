"use client";

import { formatRelativeTime } from "@/lib/ui/format";
import { cn } from "@auction/ui";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export type WizardDraftSaveStatus = "idle" | "saving" | "saved";

type Props = {
  status: WizardDraftSaveStatus;
  savedAt?: string | null;
  className?: string;
};

/** Visible autosave feedback for wizard drafts. */
export function WizardDraftSaveIndicator({ status, savedAt, className }: Props) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (status !== "saved" || !savedAt) return;
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [status, savedAt]);

  if (status === "idle" && !savedAt) return null;

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 font-body text-xs text-on-surface-variant",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      {status === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Saving draft…
        </>
      ) : savedAt ? (
        <>Draft saved {formatRelativeTime(new Date(savedAt))}</>
      ) : (
        <>Draft saved</>
      )}
    </p>
  );
}
