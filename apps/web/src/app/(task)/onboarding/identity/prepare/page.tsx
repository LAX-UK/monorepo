import {
  identityOnboardingHref,
  resolveIdentityOnboardingNext,
  resolveIdentityOnboardingSource,
} from "@/lib/kyc/identity-onboarding";
import { redirect } from "next/navigation";

export default async function IdentityOnboardingPreparePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; source?: string }>;
}) {
  const params = await searchParams;
  const next = resolveIdentityOnboardingNext(params.next);
  const source = resolveIdentityOnboardingSource(params.source);
  redirect(identityOnboardingHref("why", next, source));
}
