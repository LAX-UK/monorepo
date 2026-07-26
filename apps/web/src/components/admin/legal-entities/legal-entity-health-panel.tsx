import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogDetailTabCard } from "@/components/admin/catalog";
import type { LegalEntityHealthVM } from "@/lib/admin/legal-entity-health";
import { cn } from "@auction/ui";

type Props = {
  health: LegalEntityHealthVM;
};

const gateTone = (ready: boolean) =>
  ready ? "border-positive/30 bg-positive/5" : "border-warning/40 bg-warning-container/20";

export function LegalEntityHealthPanel({ health }: Props) {
  return (
    <CatalogDetailTabCard
      title="Organisation readiness"
      description="Connect stage and commerce gates for this legal entity."
    >
      <p className="font-body text-sm text-on-surface-variant">
        Connect stage: <span className="font-medium text-on-surface">{health.stageLabel}</span>
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className={cn("space-y-2 rounded-md border px-3 py-3", gateTone(health.canPublish))}>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Can sell</dt>
          <dd>
            <AdminStatusBadge
              domain="legalEntity"
              status={health.canPublish ? "approved" : "under_review"}
              label={health.canPublish ? "Ready to publish lots" : "Not ready to sell"}
              size="sm"
            />
          </dd>
        </div>
        <div
          className={cn(
            "space-y-2 rounded-md border px-3 py-3",
            gateTone(health.canReceivePayouts),
          )}
        >
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Can get paid</dt>
          <dd>
            <AdminStatusBadge
              domain="legalEntity"
              status={health.canReceivePayouts ? "approved" : "under_review"}
              label={health.canReceivePayouts ? "Payouts enabled" : "Payout setup incomplete"}
              size="sm"
            />
          </dd>
        </div>
      </dl>

      {health.blockers.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="font-label text-[10px] uppercase text-on-surface-variant">Blockers</p>
          <ul className="space-y-2">
            {health.blockers.map((blocker) => (
              <li
                key={blocker.key}
                className="rounded-md border border-border-hairline/60 bg-surface-container-low/40 px-3 py-2 text-sm"
              >
                <span className="font-medium text-on-surface">{blocker.label}</span>
                <span className="mt-0.5 block text-on-surface-variant">{blocker.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 font-body text-sm text-on-surface-variant">
          No outstanding blockers — this organisation is ready for commerce.
        </p>
      )}
    </CatalogDetailTabCard>
  );
}
