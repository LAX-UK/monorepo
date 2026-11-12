import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { EnquiryHost } from "@/components/private-sales/enquiry-host";
import {
  PrivateSalesContactLines,
  PrivateSalesPoints,
} from "@/components/private-sales/private-sales-intro";
import type { EnquiryPath } from "@/lib/private-sales/enquiry-values";
import { MarketingDetailAccordion } from "@auction/marketing-ui/marketing-detail-accordion";
import { MarketingPageShell } from "@auction/marketing-ui/marketing-page-shell";

/**
 * Buy or sell a work privately: what a private sale is, on the left, and the enquiry beside it.
 * On a phone the form comes first and the explanation folds under the title.
 */
export function PrivateSalesPage({ initialPath }: { initialPath: EnquiryPath }) {
  return (
    <div className="bg-page-bg pt-[var(--header-height)] dark:bg-background">
      <MarketingPageShell variant="inner" className="pt-6 pb-12 lg:pt-10 lg:pb-20">
        <MarketingBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Selling", href: "/sell" },
            { label: "Private sales", current: true },
          ]}
          className={MARKETING_HUB_BREADCRUMB_CLASS}
        />
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-16">
          <div className="flex flex-col gap-6">
            <header>
              <p className="m-0 mb-2 font-label text-xs font-medium tracking-wide text-on-surface-variant">
                Private sales
              </p>
              <h1 className="m-0 font-headline text-[1.625rem] font-semibold leading-[2.125rem] tracking-tight text-on-surface lg:text-4xl lg:leading-[2.75rem]">
                Buy or sell a work privately
              </h1>
              <p className="m-0 mt-3 max-w-[56ch] font-body text-[0.9375rem] leading-6 text-on-surface-variant lg:text-[1.0625rem] lg:leading-7">
                For works you'd rather not offer at public auction, or a work you're looking for
                that isn't in a sale. A specialist handles it from first conversation to payment, in
                confidence.
              </p>
            </header>
            <MarketingDetailAccordion
              className="lg:hidden"
              items={[
                {
                  id: "how",
                  title: "How private sales work",
                  content: <PrivateSalesPoints />,
                },
              ]}
            />
            <PrivateSalesPoints className="hidden lg:grid" />
            <PrivateSalesContactLines className="hidden lg:flex" />
          </div>
          <div className="flex flex-col gap-6">
            <EnquiryHost initialPath={initialPath} />
            <PrivateSalesContactLines className="lg:hidden" />
          </div>
        </div>
      </MarketingPageShell>
    </div>
  );
}
