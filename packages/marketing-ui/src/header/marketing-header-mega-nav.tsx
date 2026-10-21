"use client";

import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { MarketingChevronDownIcon } from "../marketing-icons.js";
import { MediaImage } from "../media/media-image.js";
import { computeMegaMenuContentShift } from "./compute-mega-menu-content-shift.js";
import {
  type MarketingHeaderTone,
  headerMegaNavChevronClass,
  headerMegaNavTriggerClass,
} from "./header-chrome-tone.js";
import { useFinePointerHover } from "./use-fine-pointer-hover.js";
import { useMegaMenuHoverIntent } from "./use-mega-menu-hover-intent.js";

export type MarketingMegaNavMedia = { src: string; alt: string; caption: string };

export type MarketingMegaNavItem = {
  href: string;
  label: string;
  /** When any item in a list has media, the panel shows the hovered or focused item's image. */
  media?: MarketingMegaNavMedia;
};

export type MarketingMegaNavColumn = {
  id: string;
  title: string;
  items: readonly MarketingMegaNavItem[];
};

export type MarketingMegaNavSection = {
  id: string;
  label: string;
  items: readonly MarketingMegaNavItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Renders the section as a plain link with no panel. */
  linkHref?: string;
  /** Titled link columns shown instead of `items`. */
  columns?: readonly MarketingMegaNavColumn[];
};

function sectionPanelLinkCount(section: MarketingMegaNavSection): number {
  return section.columns
    ? section.columns.reduce((count, column) => count + column.items.length, 0)
    : section.items.length;
}

const PANEL_LINK_CLASS = cn(
  "rounded-sm font-body text-sm font-medium text-brand-900 underline-offset-4 transition-colors hover:underline motion-reduce:transition-none dark:text-on-surface",
  FOCUS_RING,
);

export type MarketingHeaderMegaNavProps<TSection extends MarketingMegaNavSection> = {
  sections: readonly TSection[];
  isSectionActive: (section: TSection) => boolean;
  resetKey: string;
  logo: ReactNode;
  trailing: ReactNode;
  headerTone?: MarketingHeaderTone;
  panelId?: string;
  onOpenChange?: (open: boolean) => void;
  onPanelLinkClick?: () => void;
  renderTriggerBadge?: (section: TSection) => ReactNode;
};

export function MarketingHeaderMegaNav<TSection extends MarketingMegaNavSection>({
  sections,
  isSectionActive,
  resetKey,
  logo,
  trailing,
  headerTone = "on-light",
  panelId = "site-header-megamenu",
  onOpenChange,
  onPanelLinkClick,
  renderTriggerBadge,
}: MarketingHeaderMegaNavProps<TSection>) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [menuContentShiftPx, setMenuContentShiftPx] = useState(0);
  const finePointerHover = useFinePointerHover();
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const contentBlockRef = useRef<HTMLDivElement | null>(null);
  const focusFirstOnOpenRef = useRef(false);

  const {
    scheduleOpenHover,
    scheduleCloseHover,
    clearAllHover,
    onRootMouseEnter,
    onRootMouseLeave,
  } = useMegaMenuHoverIntent(setOpenIndex, finePointerHover);

  const updateMegaMenuContentShift = useCallback(() => {
    if (openIndex === null) {
      setMenuContentShiftPx(0);
      return;
    }
    const panel = panelRef.current;
    const trigger = triggerRefs.current[openIndex];
    if (!panel || !trigger) {
      setMenuContentShiftPx(0);
      return;
    }
    const panelRect = panel.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    if (triggerRect.width <= 0 && triggerRect.height <= 0) {
      setMenuContentShiftPx(0);
      return;
    }
    const block = contentBlockRef.current;
    const panelRoot =
      block?.querySelector<HTMLElement>(".header-megamenu__panel-content") ?? block ?? panel;
    const ul = panelRoot.querySelector("ul");
    const contentWidth =
      ul?.offsetWidth && ul.offsetWidth > 0 ? ul.offsetWidth : panelRoot.offsetWidth;
    setMenuContentShiftPx(
      computeMegaMenuContentShift({
        panelLeft: panelRect.left,
        panelWidth: panelRect.width,
        triggerLeft: triggerRect.left,
        triggerWidth: triggerRect.width,
        triggerHeight: triggerRect.height,
        contentWidth,
      }),
    );
  }, [openIndex]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the panel when the route changes
  useEffect(() => {
    clearAllHover();
    setOpenIndex(null);
    setMenuContentShiftPx(0);
  }, [resetKey, clearAllHover]);

  useEffect(() => {
    onOpenChange?.(openIndex !== null);
  }, [openIndex, onOpenChange]);

  useLayoutEffect(() => {
    updateMegaMenuContentShift();
    if (openIndex === null) return;
    const id = requestAnimationFrame(() => {
      updateMegaMenuContentShift();
    });
    return () => cancelAnimationFrame(id);
  }, [openIndex, updateMegaMenuContentShift]);

  useEffect(() => {
    if (openIndex === null) return;
    const block = contentBlockRef.current;
    const panel = panelRef.current;
    const onResize = () => {
      updateMegaMenuContentShift();
    };
    window.addEventListener("resize", onResize, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateMegaMenuContentShift();
          })
        : null;
    if (panel) ro?.observe(panel);
    if (block) ro?.observe(block);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [openIndex, updateMegaMenuContentShift]);

  useEffect(() => {
    if (openIndex === null) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenIndex(null);
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const idx = openIndex;
      setOpenIndex(null);
      triggerRefs.current[idx]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null || !focusFirstOnOpenRef.current) return;
    focusFirstOnOpenRef.current = false;
    const first = panelRef.current?.querySelector<HTMLAnchorElement>("a[data-megamenu-link]");
    queueMicrotask(() => first?.focus());
  }, [openIndex]);

  const closeMenu = useCallback(() => {
    clearAllHover();
    setOpenIndex(null);
  }, [clearAllHover]);

  const openFromKeyboard = (index: number) => {
    clearAllHover();
    focusFirstOnOpenRef.current = true;
    setOpenIndex(index);
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    const target = sections[index];
    if (openIndex === index && target && sectionPanelLinkCount(target) > 0) {
      panelRef.current?.querySelector<HTMLAnchorElement>("a[data-megamenu-link]")?.focus();
      return;
    }
    openFromKeyboard(index);
  };

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = [
      ...(panelRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-megamenu-link]") ?? []),
    ];
    if (links.length === 0) return;
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (current < 0) return;
    event.preventDefault();
    const next =
      event.key === "ArrowDown"
        ? Math.min(current + 1, links.length - 1)
        : Math.max(current - 1, 0);
    links[next]?.focus();
  };

  const section = openIndex !== null ? sections[openIndex] : null;
  const handlePanelLinkClick = () => {
    closeMenu();
    onPanelLinkClick?.();
  };

  return (
    <div
      ref={rootRef}
      className="relative w-full"
      onMouseEnter={onRootMouseEnter}
      onMouseLeave={onRootMouseLeave}
    >
      <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 shrink items-center gap-4 lg:gap-5 xl:gap-9">
          {logo}
          <nav
            className="hidden min-w-0 items-center gap-4 lg:flex lg:gap-5 xl:gap-9"
            aria-label="Primary"
          >
            {sections.map((item, index) => {
              const active = isSectionActive(item);
              const open = openIndex === index;
              if (item.linkHref) {
                return (
                  <Link
                    key={item.id}
                    href={item.linkHref}
                    className={headerMegaNavTriggerClass(
                      headerTone,
                      { active, open: false },
                      // Matches the trigger Button's box (min-h-9, pt-2) so labels share a baseline.
                      "inline-flex min-h-9 items-center whitespace-nowrap pt-2",
                    )}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={() => {
                      if (finePointerHover) scheduleCloseHover();
                    }}
                  >
                    {item.label}
                    {renderTriggerBadge?.(item)}
                  </Link>
                );
              }
              return (
                <div key={item.id} className="flex flex-col items-start">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    ref={(el) => {
                      triggerRefs.current[index] = el;
                    }}
                    className={headerMegaNavTriggerClass(headerTone, { active, open })}
                    aria-current={active ? "page" : undefined}
                    aria-haspopup="true"
                    aria-expanded={open}
                    aria-controls={open ? panelId : undefined}
                    onMouseEnter={() => {
                      if (finePointerHover) scheduleOpenHover(index);
                    }}
                    onClick={() => {
                      clearAllHover();
                      setOpenIndex((current) => (current === index ? null : index));
                    }}
                    onKeyDown={(event) => onTriggerKeyDown(event, index)}
                  >
                    <span className="relative flex items-center">
                      <span>{item.label}</span>
                      {renderTriggerBadge?.(item)}
                    </span>
                    <MarketingChevronDownIcon
                      className={headerMegaNavChevronClass(headerTone, open)}
                    />
                  </Button>
                </div>
              );
            })}
          </nav>
        </div>
        {trailing}
      </div>
      <section
        ref={panelRef}
        id={panelId}
        data-open={openIndex !== null ? "true" : "false"}
        aria-hidden={openIndex === null}
        inert={openIndex === null ? true : undefined}
        aria-label={section?.label}
        className="header-megamenu absolute top-full z-40"
        onKeyDown={onPanelKeyDown}
      >
        <div ref={contentBlockRef} className="header-megamenu__inner">
          {section ? (
            <MarketingMegaMenuPanelContent
              key={section.id}
              section={section}
              leftPx={menuContentShiftPx}
              onNavigate={handlePanelLinkClick}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MarketingMegaMenuPanelContent({
  section,
  leftPx,
  onNavigate,
}: {
  section: MarketingMegaNavSection;
  leftPx: number;
  onNavigate: () => void;
}) {
  const viewAllHref = section.viewAllHref;
  const viewAllLabel =
    section.viewAllLabel ?? (viewAllHref ? `View all ${section.label.toLowerCase()}` : undefined);
  const viewAll =
    viewAllHref && viewAllLabel ? (
      <Link
        href={viewAllHref}
        data-megamenu-link
        className={cn(
          "w-fit rounded-sm font-label text-xs font-semibold uppercase tracking-wide text-brand-900 underline-offset-4 transition-colors hover:underline motion-reduce:transition-none dark:text-on-surface",
          FOCUS_RING,
        )}
        onClick={onNavigate}
      >
        {viewAllLabel}
      </Link>
    ) : null;

  // Column and featured-media panels span the shelf, so they sit in the page gutter rather
  // than under the trigger.
  if (section.columns) {
    return (
      <div
        className={cn(
          "header-megamenu__panel-content mx-auto flex w-full max-w-[var(--container-max,90rem)] flex-col gap-6",
          MARKETING_PAGE_GUTTER_X,
        )}
      >
        <div className="grid grid-cols-3 gap-x-12 gap-y-8">
          {section.columns.map((column) => (
            <div key={column.id} className="flex flex-col gap-4">
              <h3 className="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {column.title}
              </h3>
              <MegaMenuLinkList items={column.items} onNavigate={onNavigate} />
            </div>
          ))}
        </div>
        {viewAll}
      </div>
    );
  }

  if (section.items.some((item) => item.media)) {
    return (
      <div
        className={cn(
          "header-megamenu__panel-content mx-auto flex w-full max-w-[var(--container-max,90rem)] justify-between gap-12",
          MARKETING_PAGE_GUTTER_X,
        )}
      >
        <MegaMenuFeaturedList section={section} onNavigate={onNavigate} viewAll={viewAll} />
      </div>
    );
  }

  return (
    <div
      className="header-megamenu__panel-content flex w-max max-w-full flex-col items-start gap-4"
      style={{ marginLeft: `${leftPx}px` }}
    >
      {section.items.length > 0 ? (
        <MegaMenuLinkList items={section.items} onNavigate={onNavigate} />
      ) : (
        <p className="font-body text-sm text-brand-400 dark:text-on-surface-variant">
          Nothing to show yet.
        </p>
      )}
      {viewAll}
    </div>
  );
}

function MegaMenuLinkList({
  items,
  onNavigate,
  onItemActive,
}: {
  items: readonly MarketingMegaNavItem[];
  onNavigate: () => void;
  onItemActive?: (item: MarketingMegaNavItem) => void;
}) {
  return (
    <ul className="flex w-max max-w-xl flex-col gap-3 self-start">
      {items.map((row) => (
        <li key={`${row.label}-${row.href}`}>
          <Link
            href={row.href}
            data-megamenu-link
            className={PANEL_LINK_CLASS}
            onClick={onNavigate}
            {...(onItemActive
              ? { onMouseEnter: () => onItemActive(row), onFocus: () => onItemActive(row) }
              : {})}
          >
            {row.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Figma `521:7889` (Upcoming): name list with the hovered or focused name's image beside it. */
function MegaMenuFeaturedList({
  section,
  onNavigate,
  viewAll,
}: {
  section: MarketingMegaNavSection;
  onNavigate: () => void;
  viewAll: ReactNode;
}) {
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const featured =
    section.items.find((item) => item.href === activeHref && item.media) ??
    section.items.find((item) => item.media);
  const media = featured?.media;

  return (
    <>
      <div className="flex flex-col items-start gap-4">
        <MegaMenuLinkList
          items={section.items}
          onNavigate={onNavigate}
          onItemActive={(item) => setActiveHref(item.href)}
        />
        {viewAll}
      </div>
      {media ? (
        <figure className="flex w-56 shrink-0 flex-col items-center gap-3 border-l border-nav-border pl-6">
          <div className="relative aspect-[4/5] w-full">
            <MediaImage src={media.src} alt={media.alt} sizes="224px" />
          </div>
          <figcaption className="font-body text-sm text-on-surface">{media.caption}</figcaption>
        </figure>
      ) : null}
    </>
  );
}
