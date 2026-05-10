import { redirect } from "next/navigation";

export default async function OrganisationOnboardingIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; fresh?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.fresh === "1") qs.set("fresh", "1");
  if (sp.entityId && sp.fresh !== "1") qs.set("entityId", sp.entityId);
  const suffix = qs.toString();
  redirect(
    suffix ? `/onboarding/organisation/step/type?${suffix}` : "/onboarding/organisation/step/type",
  );
}
