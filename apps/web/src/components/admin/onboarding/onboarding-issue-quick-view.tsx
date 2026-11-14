"use client";

import type { OnboardingStaffRow } from "@/lib/admin/onboarding-issues-staff-list.vm";
import {
  DetailPanel,
  type DetailPanelProps,
  Notice,
  OverflowMenu,
  PanelSection,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";

const URGENCY_BADGE = {
  attention: { tone: "warning", label: "Aging" },
  stale: { tone: "danger", label: "Stale" },
} as const;

/**
 * An item waiting on staff, beside the queue: what holds it up and who it waits on, the next
 * step, how long it has waited, and the record page that settles it ("Open full page" and the
 * footer). A work queue: its place ("3 of 120") and J and K to the next item without closing.
 */
export function OnboardingIssueQuickView({
  row,
  panelProps,
}: {
  row: OnboardingStaffRow | null;
  /** The queue panel's open state, place in the queue and stepping (`useStaffQueue`). */
  panelProps: Pick<DetailPanelProps, "open" | "onOpenChange" | "queue">;
}) {
  const urgency = row && row.urgency !== "none" ? URGENCY_BADGE[row.urgency] : null;
  return (
    <DetailPanel
      {...panelProps}
      title={row?.title ?? "Onboarding item"}
      description={row?.kind}
      headerFacts={["Name", "Client", "Status", "Type"]}
      {...(row ? { fullPage: { href: row.href, Link } } : {})}
      notice={
        row ? (
          <Notice tone={row.urgency === "stale" ? "warning" : "info"} title={row.nextStep.blocker}>
            {row.nextStep.detail}
          </Notice>
        ) : null
      }
      summary={
        row
          ? [
              { label: "Waiting on", value: row.nextStep.waitingOn },
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
            ]
          : []
      }
      meta={row ? [{ label: "Waiting", value: row.ageLabel ?? "Date unknown" }] : []}
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
          <StaffButton asChild variant="primary">
            <Link href={row.href}>{row.hrefLabel}</Link>
          </StaffButton>
        ) : null
      }
    >
      {row ? (
        <PanelSection title="Next step">
          <p className="text-staff-sm text-staff-fg">{row.nextStep.action}</p>
        </PanelSection>
      ) : null}
    </DetailPanel>
  );
}
