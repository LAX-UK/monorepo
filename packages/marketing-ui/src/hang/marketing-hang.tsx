"use client";

import { FOCUS_RING, MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { type CSSProperties, type ReactNode, useCallback, useId, useMemo, useState } from "react";
import {
  HANG_DESKTOP_FIT_PX,
  HANG_MAX_WORKS,
  HANG_SCROLL_FROM_COUNT,
  type HangLayout,
  type HangWorkInput,
  solveHangLayout,
} from "./hang-layout.js";
import { MarketingHangArrows } from "./marketing-hang-arrows.js";
import { MarketingHangFigure } from "./marketing-hang-figure.js";
import { MarketingHangFooter } from "./marketing-hang-footer.js";
import { useHangScroll } from "./use-hang-scroll.js";

export type MarketingHangWork = HangWorkInput & {
  href: string;
  imageSrc: string;
  /** Alt text for the picture. Empty by default: the wall label already names the work. */
  imageAlt?: string;
  /** Source picture size in pixels, so the box is sized before the picture arrives. */
  sourceWidthPx?: number | null | undefined;
  /** The wall label beside the work. A live label can swap its text in place. */
  label: ReactNode;
};

export type MarketingHangSeeAll = {
  href: string;
  /** The link beside the arrows and under the wall on a phone: "See all 8 lots". */
  label: string;
  /** The end tile of a scroll row; omit to end the row at the last work. */
  tile?: { title: string; note?: string } | undefined;
};

export type MarketingHangProps = {
  title: ReactNode;
  headingLevel?: 2 | 3;
  /** The line under the title: "8 lots · hung at true relative scale". */
  meta?: ReactNode;
  works: readonly MarketingHangWork[];
  seeAll?: MarketingHangSeeAll | undefined;
  /** A single work beside a 170 cm figure. For the sale page; a home page leaves one work out. */
  figure?: boolean;
  /** Right-hand note under the wall on desktop. */
  footerNote?: ReactNode;
  /** Accessible name of the row of works. */
  rowLabel?: string;
  className?: string;
};

const SEE_ALL_LINK_CLASS = cn(
  "inline-flex items-center rounded-sm font-body text-sm font-medium text-on-surface underline-offset-4 hover:underline",
  FOCUS_RING,
);

/** The gutter used by the page shell, so the wall lines up with the sections around it. */
const GUTTER_VARS =
  "[--hang-gutter:1rem] md:[--hang-gutter:1.5rem] lg:[--hang-gutter:2.5rem]" as const;

function wallVars(desktop: HangLayout, phone: HangLayout): CSSProperties {
  const vars: Record<string, string> = {
    "--slot-d": `${desktop.slotHeight}px`,
    "--slot-m": `${phone.slotHeight}px`,
  };
  if (desktop.figure && phone.figure) {
    vars["--fw-d"] = `${desktop.figure.width}px`;
    vars["--fh-d"] = `${desktop.figure.height}px`;
    vars["--fw-m"] = `${phone.figure.width}px`;
    vars["--fh-m"] = `${phone.figure.height}px`;
  }
  return vars as CSSProperties;
}

function workVars(desktop: HangLayout, phone: HangLayout, index: number): CSSProperties {
  const d = desktop.items[index];
  const m = phone.items[index];
  return {
    "--w-d": `${d?.width ?? 0}px`,
    "--h-d": `${d?.height ?? 0}px`,
    "--w-m": `${m?.width ?? 0}px`,
    "--h-m": `${m?.height ?? 0}px`,
  } as CSSProperties;
}

/**
 * The works of a sale hung at their real relative size on a warm paper wall, each with a wall
 * label. One pixels-per-centimetre factor scales the wall, so size is felt; where sizes are
 * missing the wall says "Not to scale". Six or more works scroll sideways with arrows beside
 * "See all"; on a phone the row is always a swipe row. Layout is solved once for desktop and once
 * for a phone and switched with CSS, so the first paint is right at every width.
 */
export function MarketingHang({
  title,
  headingLevel = 2,
  meta,
  works: allWorks,
  seeAll,
  figure = false,
  footerNote,
  rowLabel = "Works on the wall, scrolls sideways",
  className,
}: MarketingHangProps) {
  const headingId = useId();
  const rowId = useId();
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const dropWork = useCallback((id: string) => setFailed((prev) => new Set(prev).add(id)), []);
  const scroll = useHangScroll();

  const works = useMemo(
    () => allWorks.filter((w) => !failed.has(w.id)).slice(0, HANG_MAX_WORKS),
    [allWorks, failed],
  );
  const scrolls = works.length >= HANG_SCROLL_FROM_COUNT;
  const withFigure = figure && works.length === 1;

  const { desktop, phone } = useMemo(() => {
    const inputs: HangWorkInput[] = works.map(
      ({ id, aspect, longSideCm, sourceHeightPx }): HangWorkInput => ({
        id,
        aspect,
        longSideCm,
        sourceHeightPx,
      }),
    );
    return {
      desktop: solveHangLayout(inputs, {
        viewport: "desktop",
        figure: withFigure,
        fitWidth: scrolls ? undefined : HANG_DESKTOP_FIT_PX,
      }),
      phone: solveHangLayout(inputs, { viewport: "phone", figure: withFigure }),
    };
  }, [works, scrolls, withFigure]);

  if (works.length === 0) return null;

  const Heading = headingLevel === 2 ? "h2" : "h3";
  const scrollable = scroll.canScrollStart || scroll.canScrollEnd;

  return (
    <section aria-labelledby={headingId} className={cn("pt-10 sm:pt-14", className)}>
      <div
        className={cn(
          MARKETING_PAGE_SHELL,
          "flex flex-col items-start gap-0.5 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        )}
      >
        <div className="min-w-0">
          <Heading
            id={headingId}
            className="font-headline text-[22px] font-medium leading-7 tracking-[-0.01em] text-on-surface sm:text-[28px] sm:leading-9"
          >
            {title}
          </Heading>
          {meta ? (
            <p className="mt-0.5 font-body text-[13px] leading-5 text-on-surface-variant sm:mt-1 sm:text-sm">
              {meta}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-4 max-sm:hidden">
          {seeAll ? (
            <Link href={seeAll.href} className={SEE_ALL_LINK_CLASS}>
              {seeAll.label}
            </Link>
          ) : null}
          {scrolls ? (
            <MarketingHangArrows
              controls={rowId}
              canScrollStart={scroll.canScrollStart}
              canScrollEnd={scroll.canScrollEnd}
              onPage={scroll.scrollPage}
              previousLabel="Previous works"
              nextLabel="Next works"
            />
          ) : null}
        </div>
      </div>

      <div className="relative mt-4 overflow-hidden bg-[var(--color-surface-paper,#f6f4ee)] pt-6 pb-4 sm:mt-6 sm:pt-12 sm:pb-7">
        {/* The row scrolls, so it takes focus when there is more to reach and answers the arrow keys. */}
        <section
          ref={scroll.ref}
          id={rowId}
          aria-label={rowLabel}
          tabIndex={scrollable ? 0 : undefined}
          onKeyDown={scroll.onKeyDown}
          data-lenis-prevent-horizontal
          className={cn(
            "snap-x snap-proximity overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
            GUTTER_VARS,
          )}
        >
          <ul
            className={cn(
              "m-0 flex w-max min-w-full list-none items-start gap-7 p-0 sm:gap-14",
              !scrolls && "sm:[justify-content:safe_center]",
            )}
            style={{
              ...wallVars(desktop, phone),
              paddingInline:
                "max(var(--hang-gutter), calc((100% - var(--container-max, 1440px)) / 2 + var(--hang-gutter)))",
            }}
          >
            {withFigure && desktop.figure ? (
              <li className="flex-none self-end">
                <span className="block h-[var(--fh-m)] w-[var(--fw-m)] sm:h-[var(--fh-d)] sm:w-[var(--fw-d)]">
                  <MarketingHangFigure />
                </span>
                <span className="mt-3 block font-body text-xs leading-4 text-on-surface-variant sm:mt-[18px]">
                  Figure, 170 cm
                </span>
              </li>
            ) : null}
            {works.map((work, i) => (
              <li
                key={work.id}
                className="w-[max(var(--w-m),140px)] flex-none snap-start sm:w-[max(var(--w-d),168px)]"
                style={workVars(desktop, phone, i)}
              >
                <Link
                  href={work.href}
                  className={cn(
                    "group block rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring",
                  )}
                >
                  <figure className="m-0 flex flex-col">
                    <span className="flex h-[var(--slot-m)] items-center sm:h-[var(--slot-d)]">
                      <span className="relative block flex-none bg-surface-container-low shadow-[var(--hang-art-shadow)] transition-shadow duration-150 group-hover:shadow-[var(--hang-art-shadow-hover)]">
                        <img
                          src={work.imageSrc}
                          alt={work.imageAlt ?? ""}
                          width={work.sourceWidthPx ?? undefined}
                          height={work.sourceHeightPx ?? undefined}
                          loading="lazy"
                          decoding="async"
                          onError={() => dropWork(work.id)}
                          className="block h-[var(--h-m)] w-[var(--w-m)] object-cover sm:h-[var(--h-d)] sm:w-[var(--w-d)]"
                        />
                      </span>
                    </span>
                    <figcaption className="mt-3 max-w-[168px] sm:mt-[18px] sm:max-w-[220px]">
                      {work.label}
                    </figcaption>
                  </figure>
                </Link>
              </li>
            ))}
            {scrolls && seeAll?.tile ? (
              <li className="flex-none snap-start self-center">
                <Link
                  href={seeAll.href}
                  className={cn(
                    "flex size-[140px] flex-col items-start justify-center gap-1.5 border border-outline p-4 sm:size-44 sm:p-5",
                    "text-on-surface hover:bg-surface-container-low",
                    FOCUS_RING,
                  )}
                >
                  <span className="font-headline text-[15px] font-medium leading-[22px]">
                    {seeAll.tile.title}
                  </span>
                  {seeAll.tile.note ? (
                    <span className="font-body text-[13px] leading-5 text-on-surface-variant">
                      {seeAll.tile.note}
                    </span>
                  ) : null}
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
        {scroll.canScrollEnd ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent to-[var(--color-surface-paper,#f6f4ee)]"
          />
        ) : null}
        <div className={cn(MARKETING_PAGE_SHELL)}>
          <MarketingHangFooter desktop={desktop} phone={phone} note={footerNote} />
        </div>
      </div>

      {seeAll ? (
        <div className="flex justify-center px-4 pt-1 sm:hidden">
          <Link href={seeAll.href} className={cn(SEE_ALL_LINK_CLASS, "min-h-11")}>
            {seeAll.label}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
