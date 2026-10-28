import { ArtMediaImage } from "@/components/media/art-media-image";
import {
  ARTIST_APPLY_PATH,
  FOR_ARTISTS_CONTENT,
  FOR_ARTISTS_HERO_IMAGE,
} from "@/lib/artist-application/for-artists.content";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingCtaBand,
  MarketingPageTitle,
  MarketingReveal,
  MarketingSplitFeature,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

const content = FOR_ARTISTS_CONTENT;

function ApplyButton() {
  return (
    <Button asChild size="lg" className="min-h-11 px-8 font-label">
      <Link href={ARTIST_APPLY_PATH} data-testid="for-artists-apply">
        {content.apply.action}
      </Link>
    </Button>
  );
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="m-0 font-headline text-[length:var(--text-title-section,clamp(1.5rem,2.8vw,2.5rem))] font-normal leading-[1.2] text-on-surface"
    >
      {children}
    </h2>
  );
}

/**
 * "For artists": what representation by the gallery means, what we look for, how the review
 * works and how long it takes, then one action, "Apply to join". The page alternates plain
 * sections with one tinted feature, so no two bands meet.
 */
export function ForArtistsPage({ teamBand }: { teamBand?: ReactNode }) {
  return (
    <div className="flex flex-col gap-16 pb-16 md:gap-24 md:pb-24">
      <div className={MARKETING_PAGE_SHELL}>
        <MarketingPageTitle
          title={content.title}
          subtitle={content.subtitle}
          actions={<ApplyButton />}
        />
      </div>

      <MarketingReveal index={0}>
        <section
          aria-labelledby="for-artists-representation"
          className={cn(
            MARKETING_PAGE_SHELL,
            "grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16",
          )}
        >
          <div className="flex max-w-[36rem] flex-col gap-4">
            <SectionHeading id="for-artists-representation">
              {content.representation.heading}
            </SectionHeading>
            <p className="m-0 text-base leading-relaxed text-on-surface-variant md:text-lg">
              {content.representation.intro}
            </p>
          </div>
          <ul className="m-0 grid list-none gap-x-10 gap-y-10 p-0 sm:grid-cols-2">
            {content.representation.points.map((point) => (
              <li
                key={point.id}
                className="flex flex-col gap-2 border-t border-outline-variant pt-5"
              >
                <h3 className="m-0 font-headline text-lg font-medium leading-snug text-on-surface">
                  {point.title}
                </h3>
                <p className="m-0 max-w-[60ch] text-base leading-relaxed text-on-surface-variant">
                  {point.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </MarketingReveal>

      <MarketingReveal index={1}>
        <MarketingSplitFeature
          title={content.lookFor.heading}
          mediaSide="left"
          media={
            <ArtMediaImage
              src={FOR_ARTISTS_HERO_IMAGE}
              alt=""
              sizes="(min-width: 48rem) 50vw, 100vw"
              className="absolute inset-0 size-full"
              imgClassName="object-cover"
            />
          }
          body={
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {content.lookFor.points.map((point) => (
                <li key={point} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-[0.7em] h-px w-4 shrink-0 bg-current opacity-60"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          }
        />
      </MarketingReveal>

      <MarketingReveal index={2}>
        <section
          aria-labelledby="for-artists-review"
          className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10")}
        >
          <SectionHeading id="for-artists-review">{content.review.heading}</SectionHeading>
          <ol className="m-0 grid list-none gap-10 p-0 md:grid-cols-3 md:gap-10">
            {content.review.steps.map((step, index) => (
              <li key={step.id} className="flex flex-col gap-3 border-t border-on-surface pt-5">
                <span className="font-headline text-sm font-medium text-on-surface-variant">
                  Step {index + 1}
                </span>
                <h3 className="m-0 font-headline text-xl font-medium leading-snug text-on-surface">
                  {step.title}
                </h3>
                <p className="m-0 max-w-[48ch] text-base leading-relaxed text-on-surface-variant">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </MarketingReveal>

      <MarketingCtaBand
        title={content.apply.heading}
        body={<p className="m-0 max-w-[52ch]">{content.apply.body}</p>}
        action={<ApplyButton />}
        className="py-0 md:py-0"
      />

      {teamBand ? <div className={MARKETING_PAGE_SHELL}>{teamBand}</div> : null}
    </div>
  );
}
