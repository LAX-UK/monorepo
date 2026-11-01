import { BETWEEN_SEASONS_COPY } from "@/components/sections/home/home-copy";
import { NewsletterSignupForm } from "@/components/sections/home/newsletter-signup-form";
import { HOME_HERO_CONTENT_PT } from "@/lib/marketing/home-hero-layout";
import { RECENT_RESULTS_HREF, RECENT_RESULTS_LABEL } from "@/lib/marketing/recent-results-link";
import { DisplayHeading, cn } from "@auction/ui";
import Link from "next/link";

/**
 * Home hero when no sale is live or scheduled. Purely typographic: it states
 * that the next sales are being prepared and offers the newsletter as the one
 * action. It carries no live indicator, prices or placeholder lot data.
 * The dark ground matches the other home heroes, so the transparent header
 * stays legible above it.
 */
export function LaxHeroBetweenSeasons() {
  return (
    <section
      aria-labelledby="home-between-seasons-heading"
      className="relative w-full bg-brand-900 text-white"
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-[var(--container-max,1440px)] flex-col items-center px-6 pb-20 text-center md:px-10 md:pb-28",
          HOME_HERO_CONTENT_PT,
        )}
      >
        <div className="flex max-w-[640px] flex-col items-center gap-6 pt-16 md:pt-28">
          <p className="font-label text-sm font-medium tracking-normal text-white/80">
            {BETWEEN_SEASONS_COPY.eyebrow}
          </p>
          <DisplayHeading
            as="h1"
            id="home-between-seasons-heading"
            size="lg"
            className="font-medium text-white"
          >
            {BETWEEN_SEASONS_COPY.title}
          </DisplayHeading>
          <p className="font-body text-base leading-7 text-white/80">{BETWEEN_SEASONS_COPY.body}</p>
          <div className="mt-2 w-full">
            <NewsletterSignupForm tone="onDark" />
          </div>
          <Link
            href={RECENT_RESULTS_HREF}
            className="rounded-sm font-body text-sm font-medium text-white underline underline-offset-4 hover:text-brand-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            {RECENT_RESULTS_LABEL}
          </Link>
        </div>
      </div>
    </section>
  );
}
