"use client";

import type { OnboardingStaffRow } from "@/lib/admin/onboarding-issues-staff-list.vm";
import {
  DetailPanel,
  KeyValueList,
  MetaItem,
  OverflowMenu,
  PanelSection,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const URGENCY_BADGE = {
  attention: { tone: "warning", label: "Aging" },
  stale: { tone: "danger", label: "Stale" },
} as const;

/**
 * An item waiting on staff, beside the queue: its name and status, how long it has waited, and
 * the record page that settles it, from the header, the `…` menu and the footer. Previous and
 * next walk the queue without closing the panel.
 */
export function OnboardingIssueQuickView({
  row,
  position,
  onClose,
  onPrevious,
  onNext,
}: {
  row: OnboardingStaffRow | null;
  /** "3 of 120" in the whole queue; null when the item is not on this page. */
  position: { index: number; total: number } | null;
  onClose: () => void;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const urgency = row && row.urgency !== "none" ? URGENCY_BADGE[row.urgency] : null;
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.title ?? "Onboarding item"}
      description={row?.kind}
      meta={
        row ? (
          <>
            <MetaItem label="Waiting">{row.ageLabel ?? "Date unknown"}</MetaItem>
            {position ? (
              <MetaItem label="Position">
                {position.index} of {position.total}
              </MetaItem>
            ) : null}
          </>
        ) : null
      }
      status={
        row ? (
          <>
            {row.status ? (
              <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>
            ) : null}
            {urgency ? <StatusBadge tone={urgency.tone}>{urgency.label}</StatusBadge> : null}
          </>
        ) : null
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={row.href}>Open full page</Link>
          </StaffButton>
        ) : null
      }
      overflow={
        row ? (
          <OverflowMenu
            size="icon-sm"
            label={`More actions for ${row.title}`}
            Link={Link}
            actions={[{ id: "full-page", label: row.hrefLabel, href: row.href }]}
          />
        ) : null
      }
      footer={
        row ? (
          <>
            <StaffButton
              variant="secondary"
              icon={<ChevronLeft aria-hidden />}
              disabled={!onPrevious}
              onClick={() => onPrevious?.()}
            >
              Previous
            </StaffButton>
            <StaffButton variant="secondary" disabled={!onNext} onClick={() => onNext?.()}>
              Next
              <ChevronRight aria-hidden />
            </StaffButton>
            <StaffButton asChild variant="primary">
              <Link href={row.href}>{row.hrefLabel}</Link>
            </StaffButton>
          </>
        ) : null
      }
    >
      {row ? (
        <PanelSection title="Summary">
          <KeyValueList
            items={[
              { label: "Type", value: row.kind },
              { label: row.tab === "kyc" ? "Client" : "Name", value: row.title },
              { label: "Status", value: row.status?.label ?? null },
              { label: "Provider", value: row.tab === "kyc" ? row.secondary : null },
              {
                label: row.tab === "documents" ? "Uploaded" : "Created",
                value: <StaffDate value={row.since} withTime />,
              },
              { label: "Waiting", value: row.ageLabel },
              { label: "Reference", value: row.id, copyValue: row.id },
            ]}
          />
        </PanelSection>
      ) : null}
    </DetailPanel>
  );
}
