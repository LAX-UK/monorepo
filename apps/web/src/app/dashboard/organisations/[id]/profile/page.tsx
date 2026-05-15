import { subkindLabel } from "@/components/organisations/labels";
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
import { SectionHeader } from "@auction/ui/components/section-header";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function OrganisationProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/organisations/${id}/profile`,
  });
  const ctx = await createPerOrgGateway().getContext(id);
  if (!ctx) notFound();
  const { member, entity } = ctx;

  const href = `/onboarding/organisation/step/details?entityId=${encodeURIComponent(id)}`;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker={<LabelCaps>Legal</LabelCaps>}
        heading={<DisplayHeading as="h2">Organisation profile</DisplayHeading>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Registered details</CardTitle>
          <CardDescription>
            Trading name, legal name, VAT, and address are edited in the secure onboarding flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-label text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Display name
              </dt>
              <dd className="mt-1 text-sm font-medium text-on-surface">{member.displayName}</dd>
            </div>
            <div>
              <dt className="font-label text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Kind
              </dt>
              <dd className="mt-1 text-sm capitalize text-on-surface">{member.kind}</dd>
            </div>
            <div>
              <dt className="font-label text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Subkind
              </dt>
              <dd className="mt-1 text-sm text-on-surface">{subkindLabel(member.subkind)}</dd>
            </div>
            <div>
              <dt className="font-label text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Legal name
              </dt>
              <dd className="mt-1 text-sm text-on-surface">
                {entity?.legalName?.trim() ? entity.legalName : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-label text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                VAT number
              </dt>
              <dd className="mt-1 text-sm text-on-surface">
                {entity?.vatNumber?.trim() ? entity.vatNumber : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter>
          <Button asChild variant="cta" size="sm">
            <Link href={href} prefetch>
              Edit profile
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
