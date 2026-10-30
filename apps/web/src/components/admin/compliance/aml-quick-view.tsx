"use client";

import {
  AML_DECIDE_REASONS,
  AML_TRIAGE_REASONS,
  type AmlCapabilities,
  type AmlHitView,
  type AmlRecommendation,
  type AmlStaffRow,
  type AmlStageAccess,
  amlStageAccess,
  amlTimeline,
} from "@/lib/admin/compliance/aml-staff-list.vm";
import {
  CellLink,
  DetailPanel,
  KeyValueList,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  StaffButton,
  StaffDate,
  StatusBadge,
  Timeline,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

function HitDetail({ hit }: { hit: AmlHitView }) {
  return (
    <li className="rounded-staff-lg border border-staff-line px-3 py-2.5">
      <p className="text-staff-sm font-medium text-staff-fg">{hit.name}</p>
      {hit.facts.map((fact) => (
        <p key={fact} className="mt-0.5 text-staff-xs text-staff-muted">
          {fact}
        </p>
      ))}
      {hit.listings.map((listing) => (
        <div key={listing.category} className="mt-2">
          <p className="text-staff-xs font-medium text-staff-muted">{listing.category}</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {listing.items.map((item) => (
              <li key={`${item.source}-${item.date ?? ""}-${item.snippet ?? ""}`}>
                <p className="text-staff-sm text-staff-fg">{item.source}</p>
                {item.date ? <p className="text-staff-xs text-staff-muted">{item.date}</p> : null}
                {item.snippet ? (
                  <p className="text-staff-xs text-staff-muted">{item.snippet}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </li>
  );
}

/** Why the viewer cannot take the next step, when neither stage is on offer to them. */
function reviewBlocker(
  row: AmlStaffRow,
  access: AmlStageAccess,
): { tone: "info" | "warning"; title: string } | null {
  if (access.triage === "available" || access.decide === "available") return null;
  if (row.triage.recommendation === null) {
    return { tone: "info", title: AML_TRIAGE_REASONS["no-permission"] };
  }
  if (access.decide === "needs-triage") return null;
  return {
    tone: access.decide === "same-person" ? "warning" : "info",
    title: AML_DECIDE_REASONS[access.decide],
  };
}

/**
 * A watchlist screening beside the list, in the record header pattern: the client and both
 * statuses, a meta line (screened, hits), "Open client" and the same `…` menu as the row.
 * The two stages of the maker-checker sit under Review, the next step in the footer; every
 * decision opens the row's confirm dialog.
 */
export function AmlQuickView({
  row,
  capabilities,
  onClose,
  onTriage,
  onDecide,
  decisionActions = [],
}: {
  row: AmlStaffRow | null;
  capabilities: AmlCapabilities;
  onClose: () => void;
  onTriage: (row: AmlStaffRow, choice: AmlRecommendation) => void;
  onDecide: (row: AmlStaffRow, choice: AmlRecommendation) => void;
  /** The row menu's decision actions, for the panel's `…`. */
  decisionActions?: readonly OverflowAction[];
}) {
  const access = row ? amlStageAccess(row, capabilities) : null;
  const blocked = row && access ? reviewBlocker(row, access) : null;
  const clientHref = row ? `/admin/clients/${encodeURIComponent(row.userId)}` : "";
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.client ?? "Screening"}
      description="Watchlist screening"
      headerFacts={["Client", "Match", "Policy outcome", "Watchlist hits"]}
      summary={
        row
          ? [
              {
                label: "Client",
                value: (
                  <CellLink href={clientHref} Link={Link}>
                    {row.client}
                  </CellLink>
                ),
              },
              { label: "Match", value: row.match.label },
              { label: "Policy outcome", value: row.decision.label },
              { label: "Monitoring", value: row.monitor.label },
              { label: "Categories", value: row.categories },
              { label: "Watchlist hits", value: row.totalHits, numeric: true },
              { label: "Screened", value: <StaffDate value={row.screenedAt} withTime /> },
              { label: "Check type", value: row.checkType },
              { label: "Screening ID", value: row.id, copyValue: row.id },
              {
                label: "Provider session ID",
                value: row.providerSessionId,
                copyValue: row.providerSessionId,
              },
            ]
          : []
      }
      meta={
        row
          ? [
              { label: "Screened", value: <StaffDate value={row.screenedAt} /> },
              { label: "Hits", value: row.totalHits },
            ]
          : []
      }
      status={
        row ? (
          <>
            <StatusBadge tone={row.match.tone}>{row.match.label}</StatusBadge>
            <StatusBadge tone={row.decision.tone}>{row.decision.label}</StatusBadge>
          </>
        ) : null
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={clientHref}>Open client</Link>
          </StaffButton>
        ) : null
      }
      overflow={
        row && decisionActions.length > 0 ? (
          <OverflowMenu
            size="icon-sm"
            label={`More actions for screening ${row.client}`}
            Link={Link}
            actions={decisionActions}
          />
        ) : null
      }
      activity={
        row ? (
          <Timeline label={`Activity for screening ${row.client}`} events={amlTimeline(row)} />
        ) : null
      }
      footer={
        row && access?.triage === "available" ? (
          <>
            <StaffButton variant="secondary" onClick={() => onTriage(row, "block")}>
              Recommend block
            </StaffButton>
            <StaffButton variant="primary" onClick={() => onTriage(row, "clear")}>
              Recommend clear
            </StaffButton>
          </>
        ) : row && access?.decide === "available" ? (
          <>
            <StaffButton variant="danger-secondary" onClick={() => onDecide(row, "block")}>
              Block screening
            </StaffButton>
            <StaffButton variant="primary" onClick={() => onDecide(row, "clear")}>
              Clear screening
            </StaffButton>
          </>
        ) : null
      }
    >
      {row && access ? (
        <>
          <PanelSection title="Review">
            <div className="flex flex-col gap-2">
              <KeyValueList
                items={[
                  { label: "Step 1, analyst triage", value: row.triage.label },
                  { label: "Triage notes", value: row.triage.notes },
                  {
                    label: "Step 2, MLRO decision",
                    value: row.review ? row.decision.label : "Not decided yet",
                  },
                  { label: "Decision notes", value: row.review?.notes ?? null },
                ]}
              />
              {blocked ? <Notice tone={blocked.tone} title={blocked.title} /> : null}
            </div>
          </PanelSection>
          <PanelSection title="Hit detail">
            {row.hits.length === 0 ? (
              <p className="text-staff-sm text-staff-muted">No hit detail recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {row.hits.map((hit, index) => (
                  <HitDetail key={`${hit.name}-${index}`} hit={hit} />
                ))}
              </ul>
            )}
          </PanelSection>
        </>
      ) : null}
    </DetailPanel>
  );
}
