"use client";

import { AdminCopyField } from "@/components/admin/admin-copy-field";
import type { AdminTechnicalIdItem } from "@/lib/admin/admin-technical-id.types";
import { Button } from "@auction/ui/components/button";
import { useId, useState } from "react";

export type { AdminTechnicalIdItem };

type Props = {
  items: readonly AdminTechnicalIdItem[];
  /** Button label when collapsed */
  triggerLabel?: string;
};

/**
 * Collapsed reference IDs for support — copy on expand, hidden from default drawer view.
 *
 * Queue drawer contract: primary `<dl>` fields must be human-readable (names, links, badges).
 * UUIDs, Stripe IDs, and raw JSON belong in `AdminTechnicalIdDisclosure` or `AdminJsonDisclosure`.
 * Reference: `payments-board/drawer.tsx`, `payouts-board/drawer.tsx`.
 */
export function AdminTechnicalIdDisclosure({ items, triggerLabel = "Show reference IDs" }: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const visible = items.filter((item) => {
    const v = item.value?.trim();
    return v != null && v.length > 0 && v !== "—";
  });

  if (visible.length === 0) return null;

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
        {open ? "Hide reference IDs" : triggerLabel}
      </Button>
      {open ? (
        <dl
          id={panelId}
          className="space-y-3 rounded-md border border-border-hairline bg-surface-container-low/40 p-3"
        >
          {visible.map((item) => (
            <div key={item.label}>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                {item.label}
              </dt>
              <dd className="mt-1">
                <AdminCopyField value={item.value ?? ""} label={item.copyLabel ?? item.label} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
