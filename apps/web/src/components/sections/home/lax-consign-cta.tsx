import { CONSIGN_COPY } from "@/components/sections/home/home-copy";
import { RevealInView } from "@/components/ui/reveal";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** B6 — Consign CTA. Centered band against a slightly darker surface so it
 * breaks the visual rhythm of stacked white sections.
 */
export function LaxConsignCTA() {
  return (
    <section
      id="consign"
      aria-labelledby="consign-heading"
      className="cv-auto bg-surface-container-low px-4 pt-[var(--section-spacing-tight)] pb-[var(--section-spacing-tight)] dark:bg-surface-container-lowest sm:px-6 md:px-10 md:pt-[var(--section-spacing)] md:pb-[var(--section-spacing)] lg:px-14"
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col items-start gap-6 md:gap-8 lg:flex-row lg:items-center lg:gap-16">
        <RevealInView variant="fadeUp" className="flex-1">
          <p className="mb-3 font-label text-xs font-semibold uppercase leading-4 tracking-[0.18em] text-primary">
            {CONSIGN_COPY.kicker}
          </p>
          <DisplayHeading
            id="consign-heading"
            as="h2"
            className="font-headline text-4xl font-semibold leading-[1.1] text-on-surface md:text-[44px]"
          >
            {CONSIGN_COPY.title}
          </DisplayHeading>
          <p className="mt-4 max-w-[640px] font-body text-lg leading-7 text-on-surface-variant">
            {CONSIGN_COPY.body}
          </p>
        </RevealInView>
        <RevealInView variant="fadeUp" delayMs={120} className="lg:shrink-0">
          <div className="flex flex-col items-start gap-3">
            <Button variant="cta" size="xl" className="min-h-[44px] w-fit" asChild>
              <Link href={CONSIGN_COPY.ctaHref} className="inline-flex items-center gap-2">
                {CONSIGN_COPY.cta}
                <ArrowRight className="size-5 shrink-0" aria-hidden />
              </Link>
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
