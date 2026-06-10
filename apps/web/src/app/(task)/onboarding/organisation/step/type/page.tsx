import { OrgTypeStepClient } from "@/app/(task)/onboarding/organisation/step/type/org-type-step-client";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { redirectIfOrgOnboardingTypeStepComplete } from "@/lib/data/http/org-onboarding-step-guard.server";
import type { PublicOrganisationSubkind } from "@auction/validators";

type SubkindOption = { value: PublicOrganisationSubkind; label: string };

const PREFERRED_ORDER: PublicOrganisationSubkind[] = [
  "gallery",
  "dealer",
  "estate",
  "company",
  "charity",
  "institution",
  "other",
];

async function loadSubkinds(): Promise<{ subkinds: SubkindOption[]; loadFailed: boolean }> {
  const res = await authedServerFetch("/organizations/subkinds", { cache: "no-store" });
  if (!res.ok) return { subkinds: [], loadFailed: true };
  const body = (await res.json()) as { data: SubkindOption[] };
  const all = body.data ?? [];
  const preferred = PREFERRED_ORDER.map((v) => all.find((s) => s.value === v)).filter(
    Boolean,
  ) as SubkindOption[];
  const rest = all.filter((s) => !PREFERRED_ORDER.includes(s.value));
  return { subkinds: [...preferred, ...rest], loadFailed: false };
}

export default async function OrgOnboardingTypeStepPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; fresh?: string }>;
}) {
  const sp = await searchParams;
  const fresh = sp.fresh === "1";
  const entityId = fresh ? undefined : sp.entityId;
  const { subkinds, loadFailed } = await loadSubkinds();

  let initialSubkind: PublicOrganisationSubkind | undefined;
  let subkindLocked = false;

  if (entityId) {
    const state = await redirectIfOrgOnboardingTypeStepComplete(entityId);
    if (state?.subkind) {
      initialSubkind = state.subkind;
      subkindLocked = true;
    }
  }

  return (
    <OrgTypeStepClient
      subkinds={subkinds}
      fresh={fresh}
      loadFailed={loadFailed}
      {...(entityId ? { entityId } : {})}
      {...(initialSubkind ? { initialSubkind } : {})}
      subkindLocked={subkindLocked}
    />
  );
}
