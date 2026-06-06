"use client";

import { Button } from "@auction/ui/components/button";
import { useId, useState } from "react";

type Props = {
  label: string;
  value: Record<string, unknown>;
  /** Button label when collapsed */
  triggerLabel?: string;
};

/** Collapsed JSON payload for support — hidden from default drawer view. */
export function AdminJsonDisclosure({
  label,
  value,
  triggerLabel = "Show request payload",
}: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  if (Object.keys(value).length === 0) return null;

  return (
    <div className="space-y-2 border-t border-border-hairline pt-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 font-body text-xs text-on-surface-variant"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide request payload" : triggerLabel}
      </Button>
      {open ? (
        <div id={panelId}>
          <p className="mb-2 font-label text-[10px] uppercase text-on-surface-variant">{label}</p>
          <pre className="overflow-auto rounded-md border border-border-hairline bg-surface-container-low/40 p-3 font-mono text-xs">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
