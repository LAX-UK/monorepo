import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { getAdminLegalEntitiesWithStripeConnectRequirements } from "@/lib/data/http/admin.server";
import { labelForRequirement } from "@auction/connect";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
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
    return (
      <p className="text-sm text-error" role="alert">
        {loadError}
      </p>
    );
  }

  return (
    <Surface variant="card" className="border-border-hairline">
      <div className="space-y-1 p-4 pb-0">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          {rows.length} entities with Stripe requirements
        </h3>
        <p className="font-body text-sm text-on-surface-variant">
          Legal entities where Stripe Connect currently-due requirements are non-empty.
        </p>
      </div>
      <div className="p-4">
        {rows.length === 0 ? (
          <AdminEmptyState
            title="All clear"
            description="No entities with outstanding Stripe Connect requirements."
          />
        ) : (
          <ul className="divide-y divide-outline-variant/15 rounded-md border border-border-hairline">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-on-surface">{r.displayName}</p>
                  <p className="text-xs text-on-surface-variant">
                    <AdminStatusBadge domain="legalEntity" status={r.status} size="sm" /> · {r.id}
                  </p>
                  {r.stripeConnectRequirementsCurrentlyDue.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
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
                </div>
                <Button variant="chevron" size="sm" asChild>
                  <Link
                    href={`/admin/legal-entities/${r.id}?tab=stripe`}
                    className="inline-flex items-center gap-1"
                  >
                    Open
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Surface>
  );
}
