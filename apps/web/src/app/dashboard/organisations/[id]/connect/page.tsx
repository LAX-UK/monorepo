import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { KpiTile } from "@auction/ui/components/kpi-tile";
import { SectionHeader } from "@auction/ui/components/section-header";
import { StatStrip } from "@auction/ui/components/stat-strip";
import { StatusBadge } from "@auction/ui/components/status-badge";
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Stripe requirements</CardTitle>
              <CardDescription>
                Resolve each item in the Connect dashboard or continue Express onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
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
            </CardFooter>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-on-surface-variant">
              Connect details are not available yet. Try again shortly.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="cta" size="sm">
              <Link href={href} prefetch>
                Open Connect onboarding
              </Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
