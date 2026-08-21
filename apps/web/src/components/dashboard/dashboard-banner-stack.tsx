"use client";

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
import { shouldOfferIdentityOnboarding } from "@/lib/kyc/identity-onboarding";
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
  orgModuleEnabled?: boolean;
  kycOnboardingEnabled?: boolean;
  maxVisible?: number;
  compactOverflow?: boolean;
  /** Skip org entity status banner (e.g. org detail layout renders its own). */
  suppressOrgStatusBanner?: boolean;
  /** Skip KYC banner on overview when ComplianceStatusStrip covers it. */
  suppressKycOnOverview?: boolean;
  /** Skip email banner on overview when ComplianceStatusStrip covers deliverability. */
  suppressEmailOnOverview?: boolean;
  /** Skip connect_pending entity banner when user is on payout setup page. */
  suppressConnectPendingEntityBanner?: boolean;
};

export type DashboardBannerStackProps = StackProps;

/** Renders dashboard alerts by priority; overflow links to settings. */
export function DashboardBannerStack({
  user,
  acting,
  kycSummary,
  orgOnboardingResume,
  orgModuleEnabled = true,
  kycOnboardingEnabled = false,
  maxVisible = 2,
  compactOverflow = false,
  suppressOrgStatusBanner = false,
  suppressKycOnOverview = false,
  suppressEmailOnOverview = false,
  suppressConnectPendingEntityBanner = false,
}: StackProps) {
  const candidates: DashboardBannerCandidate[] = [];
  const proactiveKyc =
    !kycSummary?.requiresKyc &&
    shouldOfferIdentityOnboarding({
      enabled: kycOnboardingEnabled,
      summary: kycSummary,
      signupPersona: user.signupPersona,
    });

  if (kycSummary && (kycSummary.requiresKyc || proactiveKyc) && !suppressKycOnOverview) {
    candidates.push({
      id: "kyc",
      priority: DASHBOARD_BANNER_PRIORITIES.kyc,
      node: (
        <KycVerificationBanner
          summary={kycSummary}
          proactive={proactiveKyc}
          onboardingEnabled={kycOnboardingEnabled}
        />
      ),
    });
  }

  if (orgModuleEnabled && orgOnboardingResume) {
    candidates.push({
      id: "org-onboarding-resume",
      priority: DASHBOARD_BANNER_PRIORITIES.orgOnboardingResume,
      node: <OrgOnboardingResumeBanner resume={orgOnboardingResume} />,
    });
  }

  const showEntityStatus =
    orgModuleEnabled &&
    !suppressOrgStatusBanner &&
    isEntityStatusBannerVisible(acting) &&
    !(suppressConnectPendingEntityBanner && acting?.status === "connect_pending");

  if (showEntityStatus) {
    candidates.push({
      id: "org-status",
      priority: DASHBOARD_BANNER_PRIORITIES.org,
      node: <EntityStatusBanner acting={acting} />,
    });
  }

  if (shouldOfferEmailStatusBanner(user) && !suppressEmailOnOverview) {
    candidates.push({
      id: "email",
      priority: DASHBOARD_BANNER_PRIORITIES.email,
      node: <EmailStatusBanner user={user} />,
    });
  }

  const chosen = selectTopDashboardBannerCandidates(candidates, maxVisible);
  const overflow = candidates.length - chosen.length;

  return (
    <div className="flex flex-col gap-3 empty:hidden" data-testid="dashboard-banner-stack">
      {compactOverflow && overflow > 0 ? (
        <p className="font-label text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
          Action required
        </p>
      ) : null}
      {chosen.map((c) => (
        <div key={c.id}>{c.node}</div>
      ))}
      {overflow > 0 ? (
        <p className="font-body text-sm text-on-surface-variant">
          <Link href="/dashboard/settings" className="font-medium text-link underline">
            {compactOverflow
              ? `View ${overflow} more alert${overflow === 1 ? "" : "s"}`
              : `+${overflow} more account alert${overflow === 1 ? "" : "s"}`}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
