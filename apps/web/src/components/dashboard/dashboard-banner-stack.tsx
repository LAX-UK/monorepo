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
import type { KycStatusSummaryDto, OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import type { LegalEntitySummary } from "@auction/types";
import Link from "next/link";

export { DASHBOARD_BANNER_PRIORITIES };
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

/** Renders dashboard alerts by priority; overflow links to settings. */
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

  const maxVisible = 2;
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  const chosen = selectTopDashboardBannerCandidates(sorted, maxVisible);
  const overflow = sorted.length - chosen.length;

  return (
    <div className="flex flex-col gap-3 empty:hidden" data-testid="dashboard-banner-stack">
      {chosen.map((c) => (
        <div key={c.id}>{c.node}</div>
      ))}
      {overflow > 0 ? (
        <p className="font-body text-sm text-on-surface-variant">
          <Link href="/dashboard/settings" className="font-medium text-primary underline">
            +{overflow} more account alert{overflow === 1 ? "" : "s"}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
