import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { CONSIGN_COPY } from "@/components/sections/home/home-copy";
import { RevealInView } from "@/components/ui/reveal";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { LabelCaps } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ArrowRight } from "lucide-react";

/** B6 — Consign CTA. Centered band against a slightly darker surface so it
 * breaks the visual rhythm of stacked white sections.
 */
export function LaxConsignCTA() {
  return (
    <section
      id="consign"
      aria-labelledby="consign-heading"
      className={cn(
        MARKETING_PAGE_SHELL,
        "cv-auto bg-surface-container-low pt-[var(--section-spacing-tight)] pb-[var(--section-spacing-tight)] dark:bg-surface-container-lowest md:pt-[var(--section-spacing)] md:pb-[var(--section-spacing)]",
      )}
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col items-start gap-6 md:gap-8 lg:flex-row lg:items-center lg:gap-16">
        <RevealInView variant="fadeUp" className="flex-1">
          <MarketingPromoCta
            as="div"
            headingId="consign-heading"
            className="border-0 bg-transparent p-0 shadow-none md:p-0"
            eyebrow={<LabelCaps className="text-primary">{CONSIGN_COPY.kicker}</LabelCaps>}
            title={CONSIGN_COPY.title}
            titleClassName="font-semibold leading-[1.1]"
            description={
              <p className="max-w-[640px] font-body text-lg leading-7 text-on-surface-variant">
                {CONSIGN_COPY.body}
              </p>
            }
          />
        </RevealInView>
        <RevealInView variant="fadeUp" delayMs={120} className="lg:shrink-0">
          <div className="flex flex-col items-start gap-3">
            <Button variant="cta" size="xl" className="min-h-[44px] w-fit" asChild>
              <SellCtaLink
                href={CONSIGN_COPY.ctaHref}
                source="home_consign"
                className="inline-flex items-center gap-2"
              >
                {CONSIGN_COPY.cta}
                <ArrowRight className="size-5 shrink-0" aria-hidden />
              </SellCtaLink>
            </Button>
            <Button
              variant="ctaLink"
              asChild
              className="font-label text-xs uppercase tracking-[0.16em]"
            >
              <SellCtaLink
                href={sellIntakeHref()}
                source="home_start_now"
                className="underline-offset-4"
              >
                Start submission now
              </SellCtaLink>
            </Button>
            <p className="font-label text-xs uppercase tracking-[0.16em] text-on-surface-variant">
              {CONSIGN_COPY.microcopy}
            </p>
          </div>
        </RevealInView>
      </div>
    </section>
  );
}
