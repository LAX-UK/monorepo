import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const STEPS = [
  "Send photos and what you know about the work",
  "A specialist proposes an estimate and terms",
  "Accept, and we catalogue, market and sell it",
] as const;

/**
 * Selling before the first submission: an invitation rather than an empty list. A painting from
 * the LAX collection beside three plain steps and the way to start.
 */
export function SellWithLaxInvitation() {
  return (
    <section
      aria-labelledby="sell-with-lax-heading"
      className="grid overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
    >
      <picture className="block aspect-[4/3] bg-surface-container-high md:aspect-auto">
        <source srcSet="/images/marketing-prompts/selling.avif" type="image/avif" />
        <img
          src="/images/marketing-prompts/selling.webp"
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      </picture>
      <div className="flex flex-col justify-center gap-5 p-6 md:p-10">
        <div>
          <h2
            id="sell-with-lax-heading"
            className="font-headline text-2xl font-semibold text-on-surface"
          >
            Thinking of selling a work?
          </h2>
          <p className="mt-2 font-body text-base text-on-surface-variant">
            Our specialists give a free auction estimate. Most replies come within two working days.
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-3 font-body text-sm text-on-surface">
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-container-high font-body text-xs font-semibold"
              >
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" asChild>
            <Link href={DASHBOARD_ROUTES.submissionsNew}>Start a valuation</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/sell">How selling works</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
