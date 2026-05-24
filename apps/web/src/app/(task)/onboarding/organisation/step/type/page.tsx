import { OrgTypeStepClient } from "@/app/(task)/onboarding/organisation/step/type/org-type-step-client";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { PublicOrganisationSubkind } from "@auction/validators";
import { Suspense } from "react";

type SubkindOption = { value: PublicOrganisationSubkind; label: string };

const PREFERRED_ORDER: PublicOrganisationSubkind[] = ["gallery", "dealer", "estate", "other"];

async function loadSubkinds(): Promise<SubkindOption[]> {
  const res = await authedServerFetch("/organizations/subkinds", { cache: "no-store" });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: SubkindOption[] };
  const all = body.data ?? [];
  const preferred = PREFERRED_ORDER.map((v) => all.find((s) => s.value === v)).filter(
    Boolean,
  ) as SubkindOption[];
  const rest = all.filter((s) => !PREFERRED_ORDER.includes(s.value));
  return [...preferred, ...rest];
}

export default async function OrgOnboardingTypeStepPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; fresh?: string }>;
}) {
  const sp = await searchParams;
  const fresh = sp.fresh === "1";
  const entityId = fresh ? undefined : sp.entityId;
  const subkinds = await loadSubkinds();

  return (
    <Suspense fallback={<p className="px-4 py-6 text-sm text-on-surface-variant">Loading…</p>}>
      <OrgTypeStepClient subkinds={subkinds} {...(entityId ? { entityId } : {})} fresh={fresh} />
    </Suspense>
  );
}
