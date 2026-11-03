import { DepartmentEvidenceView } from "@/components/marketing/department/department-evidence-view";
import { LegalPage } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { MarketingSectionSubheading } from "@/components/marketing/marketing-section-subheading";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { REPLY_WINDOW } from "@/lib/copy/glossary";
import { hasDepartmentEvidence } from "@/lib/departments/department-evidence";
import { loadDepartmentEvidence } from "@/lib/departments/load-department-evidence";
import { MARKETING_PAGE_SHELL, MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { Notice, buttonVariants } from "@auction/ui/lax";
import type { Metadata } from "next";
import Link from "next/link";

type Props = {
  path: "/sell/estate" | "/sell/corporate" | "/sell/prints" | "/sell/watches" | "/sell/motor-cars";
  title: string;
  description: string;
  eyebrow: string;
  lead: string;
  bullets: readonly string[];
  breadcrumbLabel: string;
  /** Pre-select category when starting the submission wizard. */
  categorySlug?: string;
  /**
   * The department in running text ("watches and clocks"). With a category, the page shows
   * what the house sold and has on sale there, and the next consignment deadline.
   */
  departmentNoun?: string;
};

export function sellTailoredPageMetadata({
  path,
  title,
  description,
}: Pick<Props, "path" | "title" | "description">): Metadata {
  return metadataForStatic({ title, description, path });
}

export async function SellTailoredLandingPage({
  path,
  title,
  description,
  eyebrow,
  lead,
  bullets,
  categorySlug,
  departmentNoun,
  breadcrumbLabel,
}: Props) {
  const loaded = categorySlug && departmentNoun ? await loadDepartmentEvidence(categorySlug) : null;
  const evidence =
    loaded?.ok && loaded.value && hasDepartmentEvidence(loaded.value) ? loaded.value : null;
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Selling with LAX Bid", path: "/sell" },
      { name: breadcrumbLabel, path },
    ]),
  );

  const closing = (
    <>
      <MarketingPromoCta
        className={evidence ? "" : "mt-8"}
        title="Ready to begin?"
        description={`Create an account and tell us about your work. Our specialists usually reply ${REPLY_WINDOW}.`}
        actions={
          <SellCtaLink
            href={sellIntakeHref(categorySlug ? { categorySlug } : undefined)}
            source={`${path}_submit`}
            className={buttonVariants({ variant: "primary" })}
          >
            {SELL_A_WORK_LABEL}
          </SellCtaLink>
        }
      />
      <p className="mt-6 font-body text-sm text-on-surface-variant">
        Back to{" "}
        <Link href="/sell" className={MARKETING_PROSE_LINK}>
          Selling with LAX Bid
        </Link>
      </p>
    </>
  );

  return (
    <>
      <PolicyHubLayout>
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdText}
        </script>
        <LegalPage
          title={title}
          breadcrumb={
            <MarketingBreadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Selling", href: "/sell" },
                { label: breadcrumbLabel, current: true },
              ]}
              className={MARKETING_HUB_BREADCRUMB_CLASS}
            />
          }
          kicker={eyebrow}
          embedded
        >
          <p>{lead}</p>
          <p>{description}</p>

          {evidence?.deadline ? (
            <Notice
              tone="info"
              title={`Consign ${departmentNoun} by ${evidence.deadline.date}`}
              className="mt-8"
            >
              {evidence.deadline.saleTitle} is the next sale accepting {departmentNoun}.
            </Notice>
          ) : null}

          <div className="mt-8 rounded-lg border border-border-hairline bg-surface-container-lowest p-6">
            <MarketingSectionSubheading>What to prepare</MarketingSectionSubheading>
            <ul className="mt-4 space-y-3">
              {bullets.map((item) => (
                <li key={item} className="font-body text-sm text-on-surface-variant">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {evidence ? null : closing}
        </LegalPage>
      </PolicyHubLayout>
      {evidence && departmentNoun ? (
        <div className="bg-page-bg pb-16 dark:bg-background md:pb-24">
          <div className="-mt-16">
            <DepartmentEvidenceView
              evidence={evidence}
              department={breadcrumbLabel}
              noun={departmentNoun}
            />
          </div>
          <div className={`${MARKETING_PAGE_SHELL} pt-16 md:pt-24`}>{closing}</div>
        </div>
      ) : null}
    </>
  );
}
