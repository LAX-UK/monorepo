"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { type ScrollEdges, useScrollEdges } from "../../hooks/use-scroll-edges.js";
import { cn } from "../../lib/utils.js";

export type SectionTabItem<Id extends string = string> = {
  id: Id;
  label: ReactNode;
  href: string;
  badge?: ReactNode;
  /** When set, overrides pathname matching */
  active?: boolean;
};

export type SectionTabsProps<Id extends string = string> = {
  ariaLabel: string;
  items: ReadonlyArray<SectionTabItem<Id>>;
  /** Active tab id — required when items do not set `active` */
  active?: Id;
  variant?: "underline" | "pill";
  /** `caps` (default) is the label style; `sentence` keeps the words as written. */
  casing?: "caps" | "sentence";
  sticky?: boolean;
  className?: string;
  scrollOnNav?: boolean;
  renderLink?: (props: {
    href: string;
    className: string;
    children: ReactNode;
    "aria-current"?: "page";
    scroll?: boolean;
  }) => ReactNode;
};

const underlineLinkClass = (isActive: boolean, sentence: boolean) =>
  cn(
    "-mb-px inline-flex min-h-[var(--tap-target-min,44px)] shrink-0 items-center gap-2 border-b-2 pb-2 font-label text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    sentence
      ? "normal-case tracking-normal"
      : "uppercase tracking-[var(--text-label-caps-tracking-tight,0.18em)]",
    isActive
      ? "border-on-surface text-on-surface"
      : "border-transparent text-on-surface-variant hover:text-on-surface",
  );

const pillLinkClass = (isActive: boolean, sentence: boolean) =>
  cn(
    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 font-label text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    sentence
      ? "normal-case tracking-normal"
      : "uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
    isActive
      ? "border-primary/35 bg-primary-container/45 text-primary shadow-sm"
      : "border-border-hairline bg-surface-container-lowest text-on-surface-variant hover:border-primary/25 hover:bg-surface-container-high hover:text-on-surface",
  );

/** The fade drawn at an edge that hides more tabs: the cue that the row scrolls. */
const EDGE_FADE: Record<"none" | "start" | "end" | "both", string | undefined> = {
  none: undefined,
  start: "[mask-image:linear-gradient(to_right,transparent,black_1.5rem)]",
  end: "[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]",
  both: "[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]",
};

function edgeFade({ start, end }: ScrollEdges): string | undefined {
  if (start && end) return EDGE_FADE.both;
  if (start) return EDGE_FADE.start;
  if (end) return EDGE_FADE.end;
  return EDGE_FADE.none;
}

/**
 * Underline tabs stay on one line. When they do not fit (on a phone) the row scrolls sideways,
 * with a fade at the edge that hides more, and the current tab is scrolled into view. The
 * scroller pads its edges so a focus ring is never clipped.
 */
function UnderlineScroller({
  sticky,
  children,
}: {
  sticky: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(ref);

  useEffect(() => {
    const el = ref.current;
    const current = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !current) return;
    const right = current.offsetLeft + current.offsetWidth;
    if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth + 24;
  }, []);

  return (
    <div
      ref={ref}
      data-tabs-scroller
      className={cn(
        "-mx-1 min-w-0 overflow-x-auto px-1 pt-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        sticky && "sticky top-0 z-10 bg-surface/95 py-2 backdrop-blur-sm",
        edgeFade(edges),
      )}
    >
      {children}
    </div>
  );
}

/** Section navigation — underline (default) or pill tabs; framework-agnostic via `renderLink`. */
export function SectionTabs<Id extends string>({
  ariaLabel,
  items,
  active,
  variant = "underline",
  casing = "caps",
  sticky = false,
  className,
  scrollOnNav = false,
  renderLink,
}: SectionTabsProps<Id>) {
  const navClass =
    variant === "pill"
      ? cn(
          sticky &&
            "sticky top-0 z-10 -mx-1 overflow-x-auto rounded-2xl border border-border-hairline bg-surface-container-lowest/90 px-2 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80",
          className,
        )
      : cn(
          "flex w-max min-w-full flex-nowrap gap-4 border-b border-border-soft sm:gap-6",
          className,
        );

  const inner =
    variant === "pill" ? (
      <div className="flex min-w-[max-content] items-center gap-2">{renderItems()}</div>
    ) : (
      renderItems()
    );

  function renderItems() {
    return items.map((item) => {
      const isActive = item.active ?? item.id === active;
      const classNameLink =
        variant === "pill"
          ? pillLinkClass(isActive, casing === "sentence")
          : underlineLinkClass(isActive, casing === "sentence");
      const content = (
        <>
          <span>{item.label}</span>
          {item.badge !== undefined ? <span>{item.badge}</span> : null}
        </>
      );

      if (renderLink) {
        return (
          <span key={item.id} className={variant === "pill" ? "shrink-0" : undefined}>
            {renderLink({
              href: item.href,
              className: classNameLink,
              children: content,
              ...(isActive ? { "aria-current": "page" as const } : {}),
              scroll: scrollOnNav,
            })}
          </span>
        );
      }

      return (
        <a
          key={item.id}
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={classNameLink}
        >
          {content}
        </a>
      );
    });
  }

  const nav = (
    <nav aria-label={ariaLabel} className={navClass}>
      {inner}
    </nav>
  );
  return variant === "pill" ? nav : <UnderlineScroller sticky={sticky}>{nav}</UnderlineScroller>;
}
