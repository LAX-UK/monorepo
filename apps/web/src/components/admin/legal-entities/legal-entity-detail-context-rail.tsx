import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { KpiStackRail, QuickActionsRail } from "@/components/admin/detail-rail";
import { statusLabel } from "@/lib/admin/legal-entity-list-presenter";
import type { LegalEntity } from "@auction/types";

type Props = {
  entity: LegalEntity;
};

export function LegalEntityDetailContextRail({ entity }: Props) {
  const stripeSummary = entity.stripeConnectAccountId
    ? entity.stripeConnectPayoutsEnabled
      ? "Payouts enabled"
      : "Payout setup in progress"
    : "Not connected";

  const dueCount = entity.stripeConnectRequirementsCurrentlyDue.length;

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
          { id: "kind", label: "Kind", value: `${entity.kind} / ${entity.subkind}` },
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
      <QuickActionsRail
        actions={[
          {
            id: "impersonate",
            label: "Impersonation",
            href: "/admin/impersonation",
            variant: "outline",
          },
          {
            id: "onboarding",
            label: "Onboarding queues",
            href: "/admin/onboarding-issues?tab=entities",
            variant: "outline",
          },
          ...(dueCount > 0
            ? [
                {
                  id: "stripe-tab",
                  label: "Stripe tab",
                  href: `/admin/legal-entities/${entity.id}?tab=stripe`,
                  variant: "outline" as const,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
