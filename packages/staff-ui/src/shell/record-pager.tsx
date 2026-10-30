"use client";

import type { LinkComponent } from "@auction/ui/lax";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { StaffButton } from "../primitives/button.js";
import { StaffTooltip } from "../primitives/menu.js";
import { useStaffShortcut } from "./shortcuts.js";

export type RecordPosition = {
  /** 1-based place of this record in the list. */
  position: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
};

/**
 * Where a record sits in the list it was opened from, given that list's ids in order (from the
 * URL or the session). Null when the record is not in the list, so no pager is shown.
 */
export function recordPosition(ids: readonly string[], currentId: string): RecordPosition | null {
  const index = ids.indexOf(currentId);
  if (index < 0) return null;
  return {
    position: index + 1,
    total: ids.length,
    previousId: ids[index - 1] ?? null,
    nextId: ids[index + 1] ?? null,
  };
}

const COUNT = new Intl.NumberFormat("en-GB");

/**
 * "‹ 3 of 50 ›" in a record's header, to work through a list without going back to it. K opens
 * the previous record and J the next, as in the list. At either end the button is disabled
 * rather than wrapping round.
 */
export function RecordPager({
  position,
  total,
  previousHref,
  nextHref,
  noun = "record",
  Link,
  navigate,
}: {
  position: number;
  total: number;
  previousHref: string | null;
  nextHref: string | null;
  /** What the list holds, singular: "order" gives "Previous order". */
  noun?: string;
  Link: LinkComponent;
  /** Client-side navigation for the J and K keys (e.g. `router.push`). */
  navigate: (href: string) => void;
}) {
  useStaffShortcut(
    previousHref
      ? {
          id: "staff:record-previous",
          keys: "k",
          label: `Previous ${noun}`,
          group: "Records",
          handler: () => navigate(previousHref),
        }
      : null,
  );
  useStaffShortcut(
    nextHref
      ? {
          id: "staff:record-next",
          keys: "j",
          label: `Next ${noun}`,
          group: "Records",
          handler: () => navigate(nextHref),
        }
      : null,
  );

  const button = (href: string | null, label: string, key: string, icon: React.ReactNode) =>
    href ? (
      <StaffTooltip label={label} shortcut={key}>
        <StaffButton asChild variant="ghost" size="icon-sm" aria-keyshortcuts={key}>
          <Link href={href} aria-label={label}>
            {icon}
          </Link>
        </StaffButton>
      </StaffTooltip>
    ) : (
      <StaffButton variant="ghost" size="icon-sm" aria-label={label} disabled>
        {icon}
      </StaffButton>
    );

  return (
    <nav aria-label="Position in list" className="flex items-center gap-1">
      {button(previousHref, `Previous ${noun}`, "K", <ChevronLeft aria-hidden />)}
      <p className="min-w-16 text-center text-staff-sm text-staff-muted tabular-nums">
        <span className="text-staff-fg">{COUNT.format(position)}</span> of {COUNT.format(total)}
      </p>
      {button(nextHref, `Next ${noun}`, "J", <ChevronRight aria-hidden />)}
    </nav>
  );
}
