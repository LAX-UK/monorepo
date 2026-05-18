import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { KpiTile } from "@auction/ui/components/kpi-tile";
import { SectionHeader } from "@auction/ui/components/section-header";
import { StatStrip } from "@auction/ui/components/stat-strip";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function OrganisationConnectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/organisations/${id}/connect`,
  });
  const ctx = await createPerOrgGateway().getContext(id);
  if (!ctx) notFound();
  const { entity } = ctx;

  const href = `/onboarding/organisation/step/connect?entityId=${encodeURIComponent(id)}`;
  const reqs = entity?.stripeConnectRequirementsCurrentlyDue ?? [];
  const reqDue = reqs.length;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker={<LabelCaps>Payouts</LabelCaps>}
        heading={<DisplayHeading as="h2">Stripe Connect</DisplayHeading>}
      />

      {entity ? (
        <>
          <StatStrip>
            <KpiTile
              label="Charges"
              value={entity.stripeConnectChargesEnabled ? "Enabled" : "Disabled"}
              emphasize={entity.stripeConnectChargesEnabled}
            />
            <KpiTile
              label="Payouts"
              value={entity.stripeConnectPayoutsEnabled ? "Enabled" : "Disabled"}
              emphasize={entity.stripeConnectPayoutsEnabled}
            />
            <KpiTile label="Requirements due" value={String(reqDue)} />
          </StatStrip>

          <Surface variant="section" padding="md" className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-on-surface">Stripe requirements</h3>
              <p className="font-body text-sm text-on-surface-variant">
                Resolve each item in the Connect dashboard or continue Express onboarding.
              </p>
            </div>
            {reqs.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No outstanding requirements.</p>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
                {reqs.map((r) => (
                  <li key={r} className="font-mono text-xs">
                    {r}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="cta" size="sm">
                <Link href={href} prefetch>
                  Open Connect onboarding
                </Link>
              </Button>
              {reqDue > 0 ? (
                <StatusBadge variant="warning" size="sm">
                  Action needed
                </StatusBadge>
              ) : null}
            </div>
          </Surface>
        </>
      ) : (
        <Surface variant="section" padding="md" className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Connect details are not available yet. Try again shortly.
          </p>
          <Button asChild variant="cta" size="sm">
            <Link href={href} prefetch>
              Open Connect onboarding
            </Link>
          </Button>
        </Surface>
      )}
    </div>
  );
}
