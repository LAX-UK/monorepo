import { BuyerInterestsForm } from "@/components/onboarding/buyer-interests-form";
import { BuyerInterestsViewTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import { BuyerOnboardingShell } from "@/components/onboarding/buyer-onboarding-shell";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerCategoryInterests } from "@/lib/data/http/category-interests.server";
import { isFullBuyerOnboardingEnabled } from "@/lib/kyc/full-buyer-onboarding-rollout.server";
import {
  identityOnboardingHref,
  resolveIdentityOnboardingNext,
} from "@/lib/kyc/identity-onboarding";
import { redirect } from "next/navigation";

export default async function BuyerInterestsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; source?: string }>;
}) {
  const params = await searchParams;
  const next = resolveIdentityOnboardingNext(params.next);
  const source = params.source === "sign_in_resume" ? "sign_in_resume" : "post_verify";
  if (!isFullBuyerOnboardingEnabled()) {
    redirect(identityOnboardingHref("why", next, "post_verify"));
  }
  const [reader, interests] = await Promise.all([
    getServerCategoryReader(),
    getServerCategoryInterests(),
  ]);
  if (
    interests.onboardingCompleted &&
    params.source !== "post_verify" &&
    params.source !== "sign_in_resume"
  ) {
    redirect(next);
  }
  const categories = await reader.list();
  const categoryIdBySlug = Object.fromEntries(
    categories.map((category) => [category.slug, category.id]),
  );
  return (
    <BuyerOnboardingShell
      title="What are your areas of interest?"
      description={
        <>
          Pick as many as you like. We&apos;ll only show you what&apos;s relevant
          <br className="hidden sm:block" /> this is about taste, nothing else.
        </>
      }
      progress={1}
    >
      <BuyerInterestsViewTracker source={source} />
      <BuyerInterestsForm
        next={next}
        source={source}
        categoryIdBySlug={categoryIdBySlug}
        initialCategoryIds={interests.categoryIds}
      />
    </BuyerOnboardingShell>
  );
}
