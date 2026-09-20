"use client";

import { FOCUS_RING } from "@auction/branding";
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
import { computeMegaMenuContentShift } from "./compute-mega-menu-content-shift.js";
import {
  type MarketingHeaderTone,
  headerMegaNavChevronClass,
  headerMegaNavTriggerClass,
} from "./header-chrome-tone.js";
import { useFinePointerHover } from "./use-fine-pointer-hover.js";
import { useMegaMenuHoverIntent } from "./use-mega-menu-hover-intent.js";

export type MarketingMegaNavItem = { href: string; label: string };

export type MarketingMegaNavSection = {
  id: string;
  label: string;
  items: readonly MarketingMegaNavItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
};

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

  const { scheduleOpenHover, clearAllHover, onRootMouseEnter, onRootMouseLeave } =
    useMegaMenuHoverIntent(setOpenIndex, finePointerHover);

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
    if (openIndex === index && sections[index]?.items.length) {
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

  return (
    <div
      className="header-megamenu__panel-content flex w-max max-w-full flex-col items-start gap-4"
      style={{ marginLeft: `${leftPx}px` }}
    >
      {section.items.length > 0 ? (
        <ul className="flex w-max max-w-xl flex-col gap-3 self-start">
          {section.items.map((row) => (
            <li key={`${section.id}-${row.label}-${row.href}`}>
              <Link
                href={row.href}
                data-megamenu-link
                className={cn(
                  "rounded-sm font-body text-sm font-medium text-brand-900 underline-offset-4 transition-colors hover:underline motion-reduce:transition-none dark:text-on-surface",
                  FOCUS_RING,
                )}
                onClick={onNavigate}
              >
                {row.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-brand-400 dark:text-on-surface-variant">
          Nothing to show yet.
        </p>
      )}
      {viewAllHref && viewAllLabel ? (
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
      ) : null}
    </div>
  );
}
