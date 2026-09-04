import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogDetailTabCard } from "@/components/admin/catalog";
import type { AdminUserReadinessSnapshot } from "@/lib/admin/admin-user-readiness.vm";
import { cn } from "@auction/ui";
import Link from "next/link";

const toneClass = {
  ready: "border-positive/30 bg-positive/5 text-positive",
  warning: "border-warning/40 bg-warning-container/20 text-on-surface",
  blocked: "border-live-red/40 bg-live-red/5 text-on-surface",
} as const;

export function AdminUserReadinessPanel({ snapshot }: { snapshot: AdminUserReadinessSnapshot }) {
  const { identity, compliance, commerce, nextAction } = snapshot;

  return (
    <CatalogDetailTabCard
      title="Client health & readiness"
      description="Identity, compliance, and commerce readiness for this client."
    >
      <div className={cn("rounded-lg border px-4 py-3", toneClass[nextAction.tone])}>
        <p className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
          Next action
        </p>
        <Link
          href={nextAction.href}
          className="mt-1 block font-body text-sm font-medium hover:underline"
        >
          {nextAction.label}
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div className="space-y-2 rounded-md border border-border-hairline/60 bg-surface-container-low/40 p-3">
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Identity</dt>
          <dd className="flex flex-wrap gap-2">
            <AdminStatusBadge
              domain="kyc"
              status={identity.emailVerified ? "approved" : "pending"}
              label={identity.emailVerified ? "Email verified" : "Email unverified"}
              size="sm"
            />
            <AdminStatusBadge domain="kyc" status={identity.kycStatus} size="sm" />
            {identity.securityStatusAvailable ? (
              <AdminStatusBadge
                domain="kyc"
                status={identity.twoFactorEnabled ? "approved" : "unverified"}
                label={identity.twoFactorEnabled ? "2FA on" : "2FA off"}
                size="sm"
              />
            ) : (
              <AdminStatusBadge domain="kyc" status="unknown" label="2FA unavailable" size="sm" />
            )}
          </dd>
        </div>

        <div className="space-y-2 rounded-md border border-border-hairline/60 bg-surface-container-low/40 p-3">
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Compliance</dt>
          <dd className="flex flex-wrap gap-2">
            {compliance.amlHoldActive ? (
              <AdminStatusBadge domain="amlHold" status="active" label="AML hold" size="sm" />
            ) : (
              <AdminStatusBadge
                domain="amlDecision"
                status="approved"
                label="No AML hold"
                size="sm"
              />
            )}
            {compliance.amlReviewPending ? (
              <AdminStatusBadge
                domain="amlDecision"
                status="pending"
                label="Review pending"
                size="sm"
              />
            ) : null}
            {compliance.latestAmlDecision ? (
              <AdminStatusBadge
                domain="amlDecision"
                status={compliance.latestAmlDecision}
                size="sm"
              />
            ) : null}
          </dd>
        </div>

        <div className="space-y-2 rounded-md border border-border-hairline/60 bg-surface-container-low/40 p-3">
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Commerce</dt>
          <dd className="space-y-1 text-on-surface">
            <p>
              {commerce.legalEntityCount} entit{commerce.legalEntityCount === 1 ? "y" : "ies"}
              {commerce.connectGapsCount > 0
                ? ` · ${commerce.connectGapsCount} Connect gap(s)`
                : ""}
            </p>
            <p className="text-on-surface-variant">
              {commerce.lotsWon} lot{commerce.lotsWon === 1 ? "" : "s"} won ·{" "}
              {commerce.lifetimeSpendLabel} spend
            </p>
          </dd>
        </div>
      </dl>
    </CatalogDetailTabCard>
  );
}
