"use client";

import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Progress } from "@auction/ui/components/progress";
import { ArrowUp } from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  MARKETING_UNDERLINE_TAB,
  MARKETING_UNDERLINE_TAB_ACTIVE,
} from "./marketing-underline-tab.js";
import { MediaImage } from "./media/media-image.js";
import { useSmoothScroll } from "./motion/index.js";

export type MarketingSubNavAnchorItem = {
  /** Id of the section the tab scrolls to. */
  id: string;
  label: string;
};

export type MarketingSubNavIdentity = {
  title: string;
  meta?: string | null;
  imageSrc?: string | null;
};

export type MarketingSubNavAnchorProps = {
  mode: "anchor";
  ariaLabel: string;
  /** Without items the bar is a reading bar: it overlays the page and appears once stuck. */
  items: readonly MarketingSubNavAnchorItem[];
  /** Sticks below the fixed site header (`--header-height`). */
  sticky?: boolean;
  /** Thumbnail (doubling as back-to-top), title and meta, shown while stuck. */
  identity?: MarketingSubNavIdentity;
  /** Element whose read-through drives the progress bar. */
  progressTargetId?: string;
  /** Trailing actions such as share. */
  actions?: ReactNode;
  className?: string;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Sticky `top` (the header height) plus the bar itself: the space a scrolled-to section must clear. */
function stickyOffset(sticky: HTMLElement | null, bar: HTMLElement | null): number {
  if (!sticky) return 0;
  const top = Number.parseFloat(getComputedStyle(sticky).top);
  return (Number.isFinite(top) ? top : 0) + (bar?.offsetHeight ?? 0);
}

/**
 * The root starts 1px below the sticky line, so a stuck element sits just outside it: partly
 * (or, for the zero-height reading bar, wholly) clipped while its top is on the line.
 */
function useStuck(enabled: boolean, stickyRef: RefObject<HTMLElement | null>) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const sticky = stickyRef.current;
    if (!enabled || !sticky) return;
    const top = Math.round(stickyOffset(sticky, null));
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setStuck(entry.intersectionRatio < 1 && entry.boundingClientRect.top <= top + 1);
        }
      },
      { rootMargin: `-${top + 1}px 0px 0px 0px`, threshold: [0, 1] },
    );
    observer.observe(sticky);
    return () => observer.disconnect();
  }, [enabled, stickyRef]);
  return stuck;
}

function useScrollSpy(
  ids: readonly string[],
  offset: () => number,
  pausedRef: RefObject<boolean>,
): [string | null, (id: string) => void] {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands in for the ids array.
  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (sections.length === 0) return;
    const visible = new Map<string, boolean>();
    // The band starts under the sticky bar and ends mid-viewport, so the active tab is the first
    // section whose content the reader is looking at.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        if (pausedRef.current) return;
        const first = ids.find((id) => visible.get(id));
        if (first) setActiveId(first);
      },
      { rootMargin: `-${Math.round(offset())}px 0px -55% 0px` },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [key]);
  return [activeId, setActiveId];
}

function useReadingProgress(targetId: string | undefined, offset: () => number): number | null {
  const [progress, setProgress] = useState<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `offset` reads layout at call time.
  useEffect(() => {
    if (!targetId) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const target = document.getElementById(targetId);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const top = offset();
      const readable = rect.height - (window.innerHeight - top);
      const ratio = readable <= 0 ? (rect.top <= top ? 1 : 0) : (top - rect.top) / readable;
      setProgress(Math.round(Math.min(1, Math.max(0, ratio)) * 100));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targetId]);
  return progress;
}

function focusWithoutScroll(el: HTMLElement) {
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}

export function MarketingSubNavAnchor({
  ariaLabel,
  items,
  sticky = false,
  identity,
  progressTargetId,
  actions,
  className,
}: MarketingSubNavAnchorProps) {
  const { scrollTo } = useSmoothScroll();
  const stickyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const offset = useCallback(() => stickyOffset(stickyRef.current, barRef.current), []);
  const stuck = useStuck(sticky, stickyRef);
  const [activeId, setActiveId] = useScrollSpy(
    items.map((item) => item.id),
    offset,
    pausedRef,
  );
  const progress = useReadingProgress(progressTargetId, offset);
  const readingBar = items.length === 0;
  const hidden = readingBar && !stuck;

  const onTabClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    setActiveId(id);
    // Keep the clicked tab active while the smooth scroll passes earlier sections.
    pausedRef.current = true;
    void scrollTo(target, { offset: -offset(), immediate: prefersReducedMotion() }).finally(() => {
      pausedRef.current = false;
    });
    history.replaceState(null, "", `#${id}`);
    focusWithoutScroll(target);
  };

  const onBackToTop = () => {
    void scrollTo(0, { immediate: prefersReducedMotion() });
    // The bar hides once unstuck, so focus moves to the page heading instead of being lost.
    const heading = document.querySelector<HTMLElement>("main h1, h1");
    if (heading) focusWithoutScroll(heading);
  };

  return (
    <div
      ref={stickyRef}
      className={cn(
        sticky && "sticky top-[var(--header-height,0px)] z-30",
        readingBar && "h-0",
        className,
      )}
      data-stuck={stuck ? "true" : "false"}
    >
      <nav
        aria-label={ariaLabel}
        className={cn(
          "w-full border-b border-outline-variant bg-surface/95 backdrop-blur-md supports-[backdrop-filter]:bg-surface/90",
          readingBar && "absolute inset-x-0 top-0",
          hidden ? "invisible -translate-y-2 opacity-0" : "visible translate-y-0 opacity-100",
          "motion-safe:transition-[opacity,transform,visibility] motion-safe:duration-200",
        )}
      >
        <div
          ref={barRef}
          className={cn(MARKETING_PAGE_SHELL, "flex min-h-14 items-stretch gap-4 lg:gap-8")}
        >
          {identity && stuck ? (
            <div className="flex min-w-0 shrink items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onBackToTop}
                aria-label="Back to top"
                className="relative size-11 shrink-0 overflow-hidden rounded-full bg-surface-container p-0 hover:bg-surface-container-high"
              >
                {identity.imageSrc ? (
                  <MediaImage
                    src={identity.imageSrc}
                    alt=""
                    shape="circle"
                    sizes="44px"
                    className="absolute inset-0"
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    "relative flex size-full items-center justify-center rounded-full",
                    identity.imageSrc &&
                      "bg-[var(--color-scrim-page-title,rgb(0_0_0/0.6))] text-[color:var(--color-hero-foreground,#fff)]",
                  )}
                >
                  <ArrowUp className="size-4" />
                </span>
              </Button>
              <div className="flex min-w-0 flex-col justify-center">
                <p className="truncate font-body text-sm font-medium text-on-surface sm:text-base">
                  {identity.title}
                </p>
                {identity.meta ? (
                  <p className="truncate font-body text-xs text-on-surface-variant">
                    {identity.meta}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {items.length > 0 ? (
            <div className="-mb-px flex min-w-0 items-stretch gap-x-5 overflow-x-auto [scrollbar-width:none] sm:gap-x-8">
              {items.map((item) => {
                const current = item.id === activeId;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={current ? "true" : undefined}
                    onClick={(event) => onTabClick(event, item.id)}
                    className={cn(
                      MARKETING_UNDERLINE_TAB,
                      "self-stretch",
                      current && MARKETING_UNDERLINE_TAB_ACTIVE,
                    )}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          ) : null}
          {actions ? (
            <div className="ml-auto flex shrink-0 items-center border-l border-outline-variant pl-4">
              {actions}
            </div>
          ) : null}
        </div>
        {progress != null ? (
          <Progress
            value={progress}
            aria-label="Reading progress"
            className="h-0.5 rounded-none bg-transparent"
          />
        ) : null}
      </nav>
    </div>
  );
}
