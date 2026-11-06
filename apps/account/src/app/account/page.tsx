import { AccountOverviewHeader } from "@/components/account-overview-header";
import { AccountShell } from "@/components/account-shell";
import { AccountUnavailable } from "@/components/account-unavailable";
import { CompleteAccountBanner } from "@/components/complete-account-banner.client";
import { HomeLaunchGroups, LaunchGroups } from "@/components/home-launch-groups";
import { HomePortfolioSection, HomePortfolioSkeleton } from "@/components/home-portfolio-section";
import { OrganisationsCard } from "@/components/portfolio-overview-cards";
import { SecurityCheckupCard } from "@/components/security-checkup-card";
import { toAccountViewer } from "@/components/shell/account-viewer";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import {
  buildAccountLinks,
  buildOrganisationsLink,
  buildPayoutLaunchLinks,
  buildStaffPlatformLinks,
} from "@/server/domain/account-links";
import { buildAccountProducts } from "@/server/domain/account-products.vm";
import { buildSecurityCheckup } from "@/server/domain/account-security-checkup.vm";
import { readAccountSecurityFacts } from "@/server/domain/account-security-facts";
import { ACCOUNT_ROUTES, buildLaunchGroups } from "@/server/domain/account-settings.vm";
import { profileGaps } from "@/server/domain/profile-completeness";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Home · LAX Account" };

/** LAX Account Home: a greeting, what needs you, the collection, the products, the Security Checkup and any launch links. */
export default async function AccountOverviewPage() {
  const session = await loadAccountSession({
    withLiveSecurity: true,
    withLiveName: true,
    withLiveSessions: true,
  });
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.overview} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.overview}`);
  const { overview, liveSecurity, liveSessions } = session;
  const { config } = getLaxAccountContainer();
  const links = buildAccountLinks(config, { email: overview.email });
  const checkup = buildSecurityCheckup(
    readAccountSecurityFacts(
      overview,
      liveSecurity,
      liveSessions?.status === "ok" ? liveSessions.value : null,
    ),
    links,
  );
  // Email and phone are covered by the Security Checkup, so the prompt only asks for the name.
  const gaps = profileGaps(overview).filter((gap) => gap === "name");
  const launchGroups = buildLaunchGroups({
    payoutLinks: buildPayoutLaunchLinks(config),
    staffPlatforms: buildStaffPlatformLinks(config, overview.staffPlatforms),
  });

  const organisationsHref = buildOrganisationsLink(config);
  const products = buildAccountProducts(config);

  return (
    <AccountShell width="wide" viewer={toAccountViewer(overview)}>
      <AccountOverviewHeader overview={overview} />

      {gaps.length > 0 ? (
        <CompleteAccountBanner gapsKey={gaps.join(",")} href={ACCOUNT_ROUTES.profile} />
      ) : null}

      {/* The products can take seconds to answer, so these sections stream in after the rest. */}
      <Suspense fallback={<HomePortfolioSkeleton products={products} />}>
        <HomePortfolioSection products={products} />
      </Suspense>

      <SecurityCheckupCard checkup={checkup} />

      {organisationsHref ? <OrganisationsCard href={organisationsHref} /> : null}

      <Suspense fallback={<LaunchGroups groups={launchGroups} />}>
        <HomeLaunchGroups groups={launchGroups} />
      </Suspense>
    </AccountShell>
  );
}
