"use client";

import type {
  LegalEntitiesListSearch,
  LegalEntitiesStaffRow,
  LegalEntityPreview,
} from "@/lib/admin/people/legal-entities-staff-list.vm";
import { legalEntityRecordHref } from "@/lib/admin/people/legal-entities-staff-list.vm";
import {
  CellLink,
  DetailPanel,
  KeyValueList,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  Skeleton,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/**
 * A legal entity beside the list: name and status, a meta line (kind, last update), "Open full
 * record" and the `…` menu, then the entity's Stripe state and readiness. The list row gives the
 * header at once; the rest arrives with the entity's details. The next step sits in the footer.
 */
export function LegalEntityQuickView({
  row,
  preview,
  search,
  onClose,
  onImpersonate,
  extraActions = [],
}: {
  row: LegalEntitiesStaffRow | null;
  /** The open entity's details; null while they load. */
  preview: LegalEntityPreview | null;
  search: LegalEntitiesListSearch;
  onClose: () => void;
  onImpersonate: (row: LegalEntitiesStaffRow) => void;
  /** The row menu's actions, for the panel's `…`. */
  extraActions?: readonly OverflowAction[];
}) {
  const recordHref = row ? legalEntityRecordHref(search, row.id) : "";
  const stripeHref = row ? legalEntityRecordHref(search, row.id, "stripe") : "";
  const details = row && preview?.row.id === row.id ? preview : null;
  const stripeDue = details?.requirementsDue ?? row?.stripeDueCount ?? 0;
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.name ?? "Legal entity"}
      status={
        row ? (
          <StatusBadge
            tone={row.statusPresentation.tone}
            live={row.statusPresentation.live ?? false}
          >
            {row.statusPresentation.label}
          </StatusBadge>
        ) : null
      }
      summary={
        row
          ? [
              { label: "Kind", value: row.kind },
              { label: "Stripe requirements", value: row.stripe ?? "None due" },
              ...(details
                ? [
                    { label: "Stripe Connect", value: details.stripeConnect },
                    { label: "Managed by LAX", value: details.laxManaged ? "Yes" : "No" },
                    { label: "Platform fee", value: details.platformFee },
                    ...(details.creator
                      ? [
                          {
                            label: "Created by",
                            value: (
                              <CellLink
                                href={`/admin/clients/${encodeURIComponent(details.creator.id)}`}
                                Link={Link}
                              >
                                {details.creator.name}
                              </CellLink>
                            ),
                          },
                        ]
                      : []),
                    ...(details.documents
                      ? [
                          {
                            label: "Documents",
                            value:
                              details.documents.total === 0
                                ? "None uploaded"
                                : `${details.documents.total} on file${
                                    details.documents.pending > 0
                                      ? ` · ${details.documents.pending} pending review`
                                      : ""
                                  }`,
                          },
                        ]
                      : []),
                  ]
                : []),
              { label: "Updated", value: <StaffDate value={row.updatedAt} withTime /> },
              { label: "Legal entity ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      meta={
        row
          ? [
              { label: "Kind", value: row.kind },
              { label: "Updated", value: <StaffDate value={row.updatedAt} /> },
            ]
          : []
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={recordHref}>Open full record</Link>
          </StaffButton>
        ) : null
      }
      overflow={
        row ? (
          <OverflowMenu
            size="icon-sm"
            label={`More actions for ${row.name}`}
            Link={Link}
            actions={[
              ...(stripeDue > 0
                ? [{ id: "stripe", label: "Review Stripe requirements", href: stripeHref }]
                : []),
              ...extraActions,
            ]}
          />
        ) : null
      }
      footer={
        row ? (
          <>
            <StaffButton variant="secondary" onClick={() => onImpersonate(row)}>
              Impersonate
            </StaffButton>
            {stripeDue > 0 ? (
              <StaffButton asChild variant="primary">
                <Link href={stripeHref}>Review Stripe requirements</Link>
              </StaffButton>
            ) : null}
          </>
        ) : null
      }
    >
      {row ? (
        <>
          <PanelSection title="Readiness">
            {details ? (
              <div className="flex flex-col gap-3">
                <KeyValueList
                  items={[
                    { label: "Connect stage", value: details.health.stageLabel },
                    {
                      label: "Can sell",
                      value: (
                        <StatusBadge tone={details.health.canPublish ? "success" : "warning"}>
                          {details.health.canPublish
                            ? "Ready to publish lots"
                            : "Not ready to sell"}
                        </StatusBadge>
                      ),
                    },
                    {
                      label: "Can get paid",
                      value: (
                        <StatusBadge
                          tone={details.health.canReceivePayouts ? "success" : "warning"}
                        >
                          {details.health.canReceivePayouts
                            ? "Payouts enabled"
                            : "Payout setup incomplete"}
                        </StatusBadge>
                      ),
                    },
                  ]}
                />
                {details.health.blockers.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {details.health.blockers.map((blocker) => (
                      <li
                        key={blocker.key}
                        className="rounded-staff-lg border border-staff-line px-3 py-2 text-staff-sm"
                      >
                        <span className="font-medium text-staff-fg">{blocker.label}</span>
                        <span className="mt-0.5 block text-staff-muted">{blocker.hint}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-staff-sm text-staff-muted">
                    No outstanding blockers. This legal entity is ready for commerce.
                  </p>
                )}
              </div>
            ) : (
              <output className="flex flex-col gap-2" aria-label="Loading readiness">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-3/4" />
              </output>
            )}
          </PanelSection>
        </>
      ) : null}
    </DetailPanel>
  );
}
