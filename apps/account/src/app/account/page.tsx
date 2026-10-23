import { AccountOverviewHeader } from "@/components/account-overview-header";
import { AccountShell } from "@/components/account-shell";
import { AccountUnavailable } from "@/components/account-unavailable";
import { CompleteAccountBanner } from "@/components/complete-account-banner.client";
import {
  OrganisationsCard,
  PortfolioSummaryCardSkeleton,
} from "@/components/portfolio-overview-cards";
import { PortfolioSummarySection } from "@/components/portfolio-summary-section";
import { ProductCards } from "@/components/product-cards";
import { CardLinkSection } from "@/components/section-cards";
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
import {
  ACCOUNT_ROUTES,
  buildAccountSections,
  buildLaunchGroups,
} from "@/server/domain/account-settings.vm";
import { profileGaps } from "@/server/domain/profile-completeness";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Home · LAX Account" };

/** LAX Account Home: a greeting, the Security Checkup, the portfolio, the products and shortcuts. */
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

  return (
    <AccountShell width="wide" viewer={toAccountViewer(overview)}>
      <AccountOverviewHeader overview={overview} />

      {gaps.length > 0 ? (
        <CompleteAccountBanner gapsKey={gaps.join(",")} href={ACCOUNT_ROUTES.profile} />
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SecurityCheckupCard checkup={checkup} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* The products can take seconds to answer, so the card streams in after the rest. */}
          <Suspense fallback={<PortfolioSummaryCardSkeleton />}>
            <PortfolioSummarySection />
          </Suspense>
          {organisationsHref ? <OrganisationsCard href={organisationsHref} /> : null}
        </div>
      </div>

      <ProductCards products={buildAccountProducts(config)} />

      <CardLinkSection
        id="account-sections"
        heading="Shortcuts"
        items={buildAccountSections(links).map((section) => ({ ...section, key: section.id }))}
      />

      {launchGroups.map((group) => (
        <CardLinkSection
          key={group.id}
          id={group.id}
          heading={group.label}
          items={group.rows.map(({ title, subtitle, href }) => ({
            key: href,
            title,
            href,
            ...(subtitle ? { description: subtitle } : {}),
          }))}
          {...(group.footer ? { footer: group.footer } : {})}
        />
      ))}
    </AccountShell>
  );
}
