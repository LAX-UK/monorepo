"use client";

import { staffSellingPlatformStatus } from "@/lib/admin/staff-kit-status";
import { StaffTooltip, StatusBadge } from "@auction/staff-ui";
import type { AtgSellingBadge } from "@auction/types";
import Link from "next/link";
import { useId } from "react";

const TRIGGER_CLASS = "staff-focus inline-flex max-w-full rounded-staff-xs";

/**
 * Where a sale or lot sells, in the header's status slot beside its status badge. The label and
 * explanation come from the shared ownership helpers in `@auction/types`, so they always match
 * the server guards. An ATG badge links to the sale's ATG tab; the explanation shows as a tooltip
 * and is read with the badge by screen readers.
 */
export function SellingPlatformBadge({
  badge,
  atgHref = null,
  syncError = false,
}: {
  badge: AtgSellingBadge;
  /** The sale's ATG tab, for staff who may open it. lax.bid badges never link. */
  atgHref?: string | null;
  syncError?: boolean;
}) {
  const descriptionId = useId();
  const status = staffSellingPlatformStatus(badge, { syncError });
  const chip = <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
  const href = badge.platform === "atg" ? atgHref : null;
  return (
    <span className="inline-flex max-w-full" data-selling-platform={badge.platform}>
      <StaffTooltip label={badge.description} multiline>
        {href ? (
          <Link href={href} className={TRIGGER_CLASS} aria-describedby={descriptionId}>
            {chip}
          </Link>
        ) : (
          // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users reach the explanation
          <span tabIndex={0} className={TRIGGER_CLASS} aria-describedby={descriptionId}>
            {chip}
          </span>
        )}
      </StaffTooltip>
      <span id={descriptionId} className="sr-only">
        {badge.description}
      </span>
    </span>
  );
}

/**
 * The compact marker a sales or lots row carries when its record page shows an ATG badge: the
 * row's second badge, after its status.
 */
export function AtgListMarker({ label }: { label: string }) {
  return (
    <span data-atg-marker="">
      <StatusBadge tone="info">
        <span aria-hidden>ATG</span>
        <span className="sr-only">{label}</span>
      </StatusBadge>
    </span>
  );
}
