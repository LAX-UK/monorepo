import { IdentityOnboardingViewTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import { BuyerOnboardingShell } from "@/components/onboarding/buyer-onboarding-shell";
import { IdentityStartActions } from "@/components/onboarding/identity-start-actions";
import { IdentityTrustGuidance } from "@/components/onboarding/identity-trust-guidance";
import { MediaImage } from "@/components/ui/media-image";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import { getServerLotById } from "@/lib/data/http/lots.server";
import {
  resolveIdentityOnboardingNext,
  resolveIdentityOnboardingSource,
} from "@/lib/kyc/identity-onboarding";
import { resolveIdentityOnboardingPresentation } from "@/lib/kyc/identity-onboarding-presentation";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function IdentityOnboardingWhyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; source?: string; lot?: string }>;
}) {
  const params = await searchParams;
  const next = resolveIdentityOnboardingNext(params.next);
  const source = resolveIdentityOnboardingSource(params.source);
  const summary = await getServerKycStatusSummary();

  if (summary?.status === "approved") redirect(next);
  const isFullBuyerFlow = source === "post_verify" || source === "sign_in_resume";
  const featuredLot = isFullBuyerFlow && params.lot ? await getServerLotById(params.lot) : null;
  const presentation = resolveIdentityOnboardingPresentation(summary, source, featuredLot !== null);

  return (
    <BuyerOnboardingShell
      title={
        <span className="flex flex-col items-center gap-3">
          <span>{presentation.title}</span>
          {featuredLot ? (
            <span className="flex h-[52px] items-center gap-2 rounded-full bg-[#1f1f1f] py-1.5 pl-2 pr-4 text-xs normal-case leading-[18px] tracking-normal text-white dark:bg-[#e8e8e8] dark:text-[#1f1f1f]">
              <MediaImage
                src={featuredLot.images[0]}
                alt=""
                label="Lot artwork"
                shape="circle"
                sizes="44px"
                className="size-11 shrink-0"
              />
              <span className="max-w-[220px] truncate sm:max-w-[360px]">{featuredLot.title}</span>
            </span>
          ) : null}
        </span>
      }
      progress={presentation.showProgress ? 3 : undefined}
      width="identity"
      backHref={
        isFullBuyerFlow
          ? featuredLot
            ? `/onboarding/recommendations?${new URLSearchParams({ next, source }).toString()}`
            : `/onboarding/interests?${new URLSearchParams({ next, source }).toString()}`
          : undefined
      }
    >
      <IdentityOnboardingViewTracker source={source} step="why" />
      <div className="flex w-full flex-col items-center gap-3 text-center">
        <p className="text-lg font-medium leading-[26px]">{presentation.message}</p>
        <p className="flex items-center gap-1 text-base leading-6 text-[#4b4b4b] dark:text-[#b8b8b8]">
          <Image
            src="/images/onboarding/identity/clock.svg"
            alt=""
            width={20}
            height={20}
            aria-hidden
          />
          {presentation.detail}
        </p>
      </div>
      {presentation.showPreparation ? (
        <section className="flex flex-col items-center gap-6 rounded-lg border border-primary/20 bg-primary-container/20 px-6 py-6 sm:px-10">
          <h2 className="text-xs font-medium uppercase leading-[22px]">Before you start</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            {[
              {
                label: "Photo ID ready",
                icon: "/images/onboarding/identity/photo-id.svg",
              },
              {
                label: "Good lighting",
                icon: "/images/onboarding/identity/good-lighting.svg",
              },
              { label: "Phone nearby", icon: "/images/onboarding/identity/phone.svg" },
            ].map(({ label, icon }) => (
              <div
                key={label}
                className="flex items-center gap-1 rounded bg-surface-container-lowest p-3 text-sm font-medium leading-[22px]"
              >
                <span className="flex size-6 items-center justify-center">
                  <Image src={icon} alt="" width={24} height={24} aria-hidden />
                </span>
                {label}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <IdentityTrustGuidance />
      <div className="w-full pt-0 sm:pt-0">
        <IdentityStartActions summary={summary} next={next} source={source} />
      </div>
    </BuyerOnboardingShell>
  );
}
