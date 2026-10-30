"use client";

import { AdminCopyField } from "@/components/admin/admin-copy-field";
import type { AdminTechnicalIdItem } from "@/lib/admin/admin-technical-id.types";
import { StaffButton } from "@auction/staff-ui";
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
    <div className="flex flex-col gap-2 border-t border-staff-line-subtle pt-4">
      <StaffButton
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide reference IDs" : triggerLabel}
      </StaffButton>
      {open ? (
        <dl
          id={panelId}
          className="flex flex-col gap-3 rounded-staff-lg border border-staff-line bg-staff-sunken p-3"
        >
          {visible.map((item) => (
            <div key={item.label}>
              <dt className="text-staff-xs text-staff-muted">{item.label}</dt>
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
