import { AccountOverviewHeader } from "@/components/account-overview-header";
import { AccountShell } from "@/components/account-shell";
import { AccountUnavailable } from "@/components/account-unavailable";
import { CompleteAccountBanner } from "@/components/complete-account-banner.client";
import { ProductCards } from "@/components/product-cards";
import { CardLinkSection } from "@/components/section-cards";
import { SecurityCheckupCard } from "@/components/security-checkup-card";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import {
  buildAccountLinks,
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
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Overview · LAX Account" };

/** LAX Account overview: who is signed in, the Security Checkup, products, then the categories. */
export default async function AccountOverviewPage() {
  const session = await loadAccountSession();
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.overview} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.overview}`);
  const { overview } = session;
  const { config } = getLaxAccountContainer();
  const links = buildAccountLinks(config, { email: overview.email });
  const checkup = buildSecurityCheckup(readAccountSecurityFacts(overview), links);
  // Email and phone are covered by the Security Checkup, so the prompt only asks for the name.
  const gaps = profileGaps(overview, { profileEditable: links.bidSettings !== null }).filter(
    (gap) => gap === "name",
  );
  const launchGroups = buildLaunchGroups({
    payoutLinks: buildPayoutLaunchLinks(config),
    staffPlatforms: buildStaffPlatformLinks(config, overview.staffPlatforms),
  });

  return (
    <AccountShell>
      <AccountOverviewHeader overview={overview} />

      {gaps.length > 0 ? (
        <CompleteAccountBanner gapsKey={gaps.join(",")} href={ACCOUNT_ROUTES.profile} />
      ) : null}

      <SecurityCheckupCard checkup={checkup} />
      <ProductCards products={buildAccountProducts(config)} />
      <CardLinkSection
        id="account-sections"
        heading="Manage your account"
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

      <form method="post" action="/api/auth/logout">
        <Button type="submit" variant="outline" size="lg" className="w-full border-border-hairline">
          Sign out
        </Button>
      </form>
    </AccountShell>
  );
}
