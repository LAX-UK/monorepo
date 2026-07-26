"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { KpiStackRail, QuickActionsRail } from "@/components/admin/detail-rail";
import { LegalEntityImpersonationButton } from "@/components/admin/legal-entities/legal-entity-impersonation-button";
import { formatLegalEntityKindSubkind, statusLabel } from "@/lib/admin/legal-entity-list-presenter";
import { stripeRequirementsAttentionCountForEntity } from "@/lib/admin/stripe-connect-staff-presenter";
import type { LegalEntity } from "@auction/types";

type Props = {
  entity: LegalEntity;
  /** When true, impersonation is rendered in the page header instead. */
  hideImpersonation?: boolean;
};

/** Full-width support actions and entity summary (formerly the detail context rail). */
export function LegalEntitySupportActionsSection({ entity, hideImpersonation = false }: Props) {
  const stripeSummary = entity.stripeConnectAccountId
    ? entity.stripeConnectPayoutsEnabled
      ? "Payouts enabled"
      : "Payout setup in progress"
    : "Not connected";

  const dueCount = stripeRequirementsAttentionCountForEntity(entity);

  return (
    <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
      <div className="space-y-2">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Status
        </p>
        <AdminStatusBadge
          domain="legalEntity"
          status={entity.status}
          size="md"
          label={statusLabel(entity.status)}
        />
      </div>
      <KpiStackRail
        title="Entity"
        items={[
          {
            id: "kind",
            label: "Kind",
            value: formatLegalEntityKindSubkind(entity.kind, entity.subkind),
          },
          { id: "stripe", label: "Stripe Connect", value: stripeSummary },
          ...(dueCount > 0
            ? [
                {
                  id: "due",
                  label: "Requirements due",
                  value: String(dueCount),
                  tone: "warning" as const,
                },
              ]
            : []),
        ]}
      />
      {!hideImpersonation ? (
        <div className="space-y-3 border-t border-border-hairline pt-4">
          <p className="font-label text-[10px] uppercase text-on-surface-variant">
            Support session
          </p>
          <LegalEntityImpersonationButton
            legalEntityId={entity.id}
            displayName={entity.displayName}
            className="min-h-11 w-full"
          />
          <p className="font-body text-xs text-on-surface-variant">
            Starts a four-hour impersonation session. Owners and admins are notified automatically.
          </p>
        </div>
      ) : null}
      <QuickActionsRail
        actions={[
          {
            id: "onboarding",
            label: "Onboarding issues",
            href: "/admin/onboarding-issues?tab=entities",
            variant: "outline",
          },
          ...(dueCount > 0
            ? [
                {
                  id: "stripe-tab",
                  label: "Stripe tab",
                  href: `/admin/legal-entities/${entity.id}/stripe`,
                  variant: "outline" as const,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

/** @deprecated Use LegalEntitySupportActionsSection — kept for drawer/preview imports. */
export function LegalEntityDetailContextRail({ entity, hideImpersonation = false }: Props) {
  return <LegalEntitySupportActionsSection entity={entity} hideImpersonation={hideImpersonation} />;
}
