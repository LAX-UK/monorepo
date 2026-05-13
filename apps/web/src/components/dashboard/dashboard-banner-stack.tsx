import "server-only";

import {
  DASHBOARD_BANNER_PRIORITIES,
  type DashboardBannerCandidate,
  selectTopDashboardBannerCandidates,
} from "@/components/dashboard/dashboard-banner-priority";
import {
  EntityStatusBanner,
  isEntityStatusBannerVisible,
} from "@/components/dashboard/entity-status-banner";
import { KycVerificationBanner } from "@/components/dashboard/kyc-verification-banner";
import { OrgOnboardingResumeBanner } from "@/components/dashboard/org-onboarding-resume-banner";
import { EmailStatusBanner } from "@/components/layout/email-status-banner";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/http/kyc.server";
import type { OrgOnboardingResumeVm } from "@/lib/data/http/org-onboarding.server";
import type { LegalEntitySummary } from "@auction/types";

export { DASHBOARD_BANNER_PRIORITIES, selectTopDashboardBannerCandidates };
export type { DashboardBannerCandidate };

function shouldOfferEmailStatusBanner(user: SessionUser): boolean {
  return (
    user.emailStatus === "bounced" ||
    user.emailStatus === "complained" ||
    user.emailVerified === false
  );
}

type StackProps = {
  user: SessionUser;
  acting: LegalEntitySummary | null;
  kycSummary: KycStatusSummaryDto | null;
  orgOnboardingResume: OrgOnboardingResumeVm | null;
};

/** Renders at most two dashboard alerts by priority; overflow is dropped (Phase A). */
export function DashboardBannerStack({
  user,
  acting,
  kycSummary,
  orgOnboardingResume,
}: StackProps) {
  const candidates: DashboardBannerCandidate[] = [];

  if (kycSummary?.requiresKyc) {
    candidates.push({
      id: "kyc",
      priority: DASHBOARD_BANNER_PRIORITIES.kyc,
      node: <KycVerificationBanner summary={kycSummary} />,
    });
  }

  if (orgOnboardingResume) {
    candidates.push({
      id: "org-onboarding-resume",
      priority: DASHBOARD_BANNER_PRIORITIES.orgOnboardingResume,
      node: <OrgOnboardingResumeBanner resume={orgOnboardingResume} />,
    });
  }

  if (isEntityStatusBannerVisible(acting)) {
    candidates.push({
      id: "org-status",
      priority: DASHBOARD_BANNER_PRIORITIES.org,
      node: <EntityStatusBanner acting={acting} />,
    });
  }

  if (shouldOfferEmailStatusBanner(user)) {
    candidates.push({
      id: "email",
      priority: DASHBOARD_BANNER_PRIORITIES.email,
      node: <EmailStatusBanner user={user} />,
    });
  }

  const chosen = selectTopDashboardBannerCandidates(candidates, 2);

  return (
    <div className="flex flex-col gap-3 empty:hidden" data-testid="dashboard-banner-stack">
      {chosen.map((c) => (
        <div key={c.id}>{c.node}</div>
      ))}
    </div>
  );
}
