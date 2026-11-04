import { DepartmentEvidenceView } from "@/components/marketing/department/department-evidence-view";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SellClosingCta } from "@/components/marketing/sell/sell-closing-cta";
import { hasDepartmentEvidence } from "@/lib/departments/department-evidence";
import type { DepartmentEvidence } from "@/lib/departments/department-evidence";
import { loadDepartmentEvidence } from "@/lib/departments/load-department-evidence";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { sellContactHref } from "@/lib/marketing/sell-intake";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { Notice } from "@auction/ui/lax";
import type { Metadata } from "next";

export type SellDepartmentPageProps = {
  path: "/sell/estate" | "/sell/corporate" | "/sell/prints" | "/sell/watches" | "/sell/motor-cars";
  title: string;
  description: string;
  lead: string;
  bullets: readonly string[];
  breadcrumbLabel: string;
  /** Category the form opens with when a visitor chooses "Sell a work". */
  categorySlug?: string;
  /** Kind of enquiry "Talk to a specialist" opens. */
  contactType?: Parameters<typeof sellContactHref>[0];
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
}: Pick<SellDepartmentPageProps, "path" | "title" | "description">): Metadata {
  return metadataForStatic({ title, description, path });
}

type ViewProps = SellDepartmentPageProps & {
  /** What the house has done in the department; null when there is nothing to show. */
  evidence: DepartmentEvidence | null;
};

/**
 * A department page: the title and what we look for, the works we sold and have on sale there,
 * what to prepare, and the way to send a work with the department already chosen.
 */
export function SellDepartmentView({
  path,
  description,
  lead,
  title,
  bullets,
  breadcrumbLabel,
  categorySlug,
  contactType,
  departmentNoun,
  evidence,
}: ViewProps) {
  return (
    <div className="bg-page-bg pt-[calc(var(--header-height)+1.5rem)] dark:bg-background">
      <section className={MARKETING_PAGE_SHELL}>
        <MarketingPageHero
          breadcrumb={
            <MarketingBreadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Sell", href: "/sell" },
                { label: breadcrumbLabel, current: true },
              ]}
              className={MARKETING_HUB_BREADCRUMB_CLASS}
            />
          }
          title={title}
          titleSize="lg"
          description={lead}
          className="mb-2 !max-w-[var(--container-inner,1376px)] !px-0 !py-0 md:mb-4 md:!py-2"
        />
        {evidence?.deadline && departmentNoun ? (
          <Notice
            tone="info"
            title={`Consign ${departmentNoun} by ${evidence.deadline.date}`}
            className="mt-6"
          >
            {evidence.deadline.saleTitle} is the next sale accepting {departmentNoun}.
          </Notice>
        ) : null}
      </section>

      {evidence && departmentNoun ? (
        <DepartmentEvidenceView
          evidence={evidence}
          department={breadcrumbLabel}
          noun={departmentNoun}
        />
      ) : null}

      <MarketingSection
        id="department-prepare"
        size="compact"
        heading="What to prepare"
        subtitle={description}
      >
        <ul className="grid gap-x-10 md:grid-cols-2">
          {bullets.map((item) => (
            <li
              key={item}
              className="border-t border-border-hairline py-4 font-body text-base leading-relaxed text-on-surface"
            >
              {item}
            </li>
          ))}
        </ul>
      </MarketingSection>

      <section className={`${MARKETING_PAGE_SHELL} py-16 md:py-24`}>
        <SellClosingCta
          source={`${path}_submit`}
          {...(categorySlug ? { categorySlug } : {})}
          {...(contactType ? { contactType } : {})}
        />
      </section>
    </div>
  );
}

/** Loads the department's evidence and shows its page; the evidence is left out if it fails. */
export async function SellTailoredLandingPage(props: SellDepartmentPageProps) {
  const { categorySlug, departmentNoun, path, breadcrumbLabel } = props;
  const loaded = categorySlug && departmentNoun ? await loadDepartmentEvidence(categorySlug) : null;
  const evidence =
    loaded?.ok && loaded.value && hasDepartmentEvidence(loaded.value) ? loaded.value : null;
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Sell", path: "/sell" },
      { name: breadcrumbLabel, path },
    ]),
  );
  return (
    <>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <SellDepartmentView {...props} evidence={evidence} />
    </>
  );
}
