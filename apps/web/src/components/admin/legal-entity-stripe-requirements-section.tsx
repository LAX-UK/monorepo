import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { LegalEntityBrowseRow } from "@/components/admin/legal-entities/legal-entity-browse-row";
import { getAdminLegalEntitiesWithStripeConnectRequirements } from "@/lib/data/http/admin.server";
import { labelForRequirement } from "@auction/connect";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export async function LegalEntityStripeRequirementsSection() {
  let rows: Awaited<ReturnType<typeof getAdminLegalEntitiesWithStripeConnectRequirements>> = [];
  let loadError: string | null = null;
  try {
    rows = await getAdminLegalEntitiesWithStripeConnectRequirements();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load legal entities.";
  }

  if (loadError) {
    return <AdminListAlert title="Could not load Stripe requirements">{loadError}</AdminListAlert>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          {rows.length} entities with Stripe requirements
        </h2>
        <p className="font-body text-sm text-on-surface-variant">
          Legal entities where Stripe Connect currently-due requirements are non-empty.
        </p>
      </div>
      {rows.length === 0 ? (
        <AdminEmptyState
          title="All clear"
          description="No entities with outstanding Stripe Connect requirements."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4">
                <LegalEntityBrowseRow
                  entity={{ id: r.id, displayName: r.displayName, status: r.status }}
                />
                {r.stripeConnectRequirementsCurrentlyDue.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-border-hairline pt-3 text-xs text-on-surface-variant">
                    {r.stripeConnectRequirementsCurrentlyDue.slice(0, 3).map((req) => {
                      const label = labelForRequirement(req);
                      return (
                        <li key={req}>
                          <span className="font-medium text-on-surface">{label.label}</span>
                          {" · "}
                          {label.hint}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/legal-entities/${r.id}?tab=stripe`}>Open Stripe tab</Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
