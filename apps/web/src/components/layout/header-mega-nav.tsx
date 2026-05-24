"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { megaMenuSectionActive } from "@/components/layout/header-nav-config";
import { MEGA_NAV_LABEL_CLASSES } from "@/components/marketing/nav-label";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MEGAMENU_PANEL_ID = "site-header-megamenu";
const HOVER_OPEN_MS = 80;
const HOVER_CLOSE_MS = 160;

type HeaderMegaNavProps = {
  sections: MegaMenuSection[];
  pathname: string;
  searchParams: Pick<URLSearchParams, "get"> | null;
  onOpenChange?: (open: boolean) => void;
  logo: ReactNode;
  trailing: ReactNode;
};

export function HeaderMegaNav({
  sections,
  pathname,
  searchParams,
  onOpenChange,
  logo,
  trailing,
}: HeaderMegaNavProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  /** Extra horizontal offset so mega menu links sit under the active nav trigger (px). */
  const [menuContentShiftPx, setMenuContentShiftPx] = useState(0);
  const openHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const contentBlockRef = useRef<HTMLDivElement | null>(null);
  const focusFirstOnOpenRef = useRef(false);

  const clearOpenHover = useCallback(() => {
    if (openHoverTimeoutRef.current) {
      clearTimeout(openHoverTimeoutRef.current);
      openHoverTimeoutRef.current = null;
    }
  }, []);

  const clearCloseHover = useCallback(() => {
    if (closeHoverTimeoutRef.current) {
      clearTimeout(closeHoverTimeoutRef.current);
      closeHoverTimeoutRef.current = null;
    }
  }, []);

  const scheduleOpenHover = useCallback(
    (index: number) => {
      clearCloseHover();
      clearOpenHover();
      openHoverTimeoutRef.current = setTimeout(() => {
        setOpenIndex(index);
        openHoverTimeoutRef.current = null;
      }, HOVER_OPEN_MS);
    },
    [clearCloseHover, clearOpenHover],
  );

  const scheduleCloseHover = useCallback(() => {
    clearOpenHover();
    clearCloseHover();
    closeHoverTimeoutRef.current = setTimeout(() => {
      setOpenIndex(null);
      closeHoverTimeoutRef.current = null;
    }, HOVER_CLOSE_MS);
  }, [clearCloseHover, clearOpenHover]);

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
    let left = Math.round(triggerRect.left - panelRect.left);
    left = Math.max(0, left);
    const block = contentBlockRef.current;
    if (block) {
      const panelRoot =
        block.querySelector<HTMLElement>(".header-megamenu__panel-content") ?? block;
      const ul = panelRoot.querySelector("ul");
      const w = ul?.offsetWidth && ul.offsetWidth > 0 ? ul.offsetWidth : panelRoot.offsetWidth;
      const maxLeft = Math.max(0, Math.floor(panelRect.width - w - 16));
      left = Math.min(left, maxLeft);
    }
    setMenuContentShiftPx(left);
  }, [openIndex]);

  const searchKey = searchParams == null ? "" : searchParams.toString();
  useEffect(() => {
    void pathname;
    void searchKey;
    clearOpenHover();
    clearCloseHover();
    setOpenIndex(null);
    setMenuContentShiftPx(0);
  }, [pathname, searchKey, clearOpenHover, clearCloseHover]);

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
    return () => {
      clearOpenHover();
      clearCloseHover();
    };
  }, [clearOpenHover, clearCloseHover]);

  useEffect(() => {
    if (openIndex === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      setOpenIndex(null);
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const idx = openIndex;
        setOpenIndex(null);
        if (idx !== null) triggerRefs.current[idx]?.focus();
      }
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
    clearOpenHover();
    clearCloseHover();
    setOpenIndex(null);
  }, [clearCloseHover, clearOpenHover]);

  const openFromKeyboard = (index: number) => {
    clearOpenHover();
    clearCloseHover();
    focusFirstOnOpenRef.current = true;
    setOpenIndex(index);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (openIndex === index && sections[index]?.items.length) {
        const first = panelRef.current?.querySelector<HTMLAnchorElement>("a[data-megamenu-link]");
        first?.focus();
        return;
      }
      openFromKeyboard(index);
    }
  };

  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const root = panelRef.current;
    if (!root) return;
    const links = [...root.querySelectorAll<HTMLAnchorElement>("a[data-megamenu-link]")];
    if (links.length === 0) return;
    const active = document.activeElement;
    const i = links.indexOf(active as HTMLAnchorElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "ArrowDown" ? Math.min(i + 1, links.length - 1) : Math.max(i - 1, 0);
    links[next]?.focus();
  };

  const section = openIndex !== null ? sections[openIndex] : null;

  return (
    <div
      ref={rootRef}
      className="relative w-full"
      onMouseEnter={() => {
        clearCloseHover();
      }}
      onMouseLeave={() => {
        scheduleCloseHover();
      }}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex shrink-0 items-center gap-9">
          {logo}

          <nav className="hidden items-center gap-9 lg:flex" aria-label="Primary">
            {sections.map((item, index) => {
              const active = megaMenuSectionActive(pathname, item, searchParams);
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
                    className={cn(
                      `group h-auto gap-1 rounded-none border-b-2 border-transparent px-0 pb-1 ${MEGA_NAV_LABEL_CLASSES} hover:bg-transparent motion-reduce:transition-none`,
                      active || open
                        ? "text-brand-900 dark:text-on-surface"
                        : "text-nav-text hover:text-brand-900 dark:hover:text-on-surface",
                      open
                        ? "border-brand-900 dark:border-on-surface"
                        : "border-transparent hover:border-brand-900/40 dark:hover:border-on-surface/40",
                    )}
                    aria-current={active ? "page" : undefined}
                    aria-haspopup="true"
                    aria-expanded={open}
                    aria-controls={open ? MEGAMENU_PANEL_ID : undefined}
                    onMouseEnter={() => {
                      scheduleOpenHover(index);
                    }}
                    onClick={() => {
                      clearOpenHover();
                      clearCloseHover();
                      setOpenIndex((cur) => (cur === index ? null : index));
                    }}
                    onKeyDown={(e) => onTriggerKeyDown(e, index)}
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      className={cn(
                        "text-base! text-brand-900 transition-[transform,color] duration-200 motion-reduce:transition-none dark:text-on-surface",
                        open ? "rotate-180" : "rotate-0",
                      )}
                      aria-hidden
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
        id={MEGAMENU_PANEL_ID}
        data-open={openIndex !== null ? "true" : "false"}
        aria-hidden={openIndex === null}
        inert={openIndex === null ? true : undefined}
        aria-label={section?.label}
        className="header-megamenu absolute top-full z-40 bg-surface"
        onKeyDown={onPanelKeyDown}
      >
        <div ref={contentBlockRef} className="header-megamenu__inner">
          {section ? (
            <HeaderMegaMenuPanelContent
              section={section}
              leftPx={menuContentShiftPx}
              onNavigate={closeMenu}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function HeaderMegaMenuPanelContent({
  section,
  leftPx,
  onNavigate,
}: {
  section: MegaMenuSection;
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
                className="font-body text-sm font-medium text-brand-900 underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand motion-reduce:transition-none dark:text-on-surface"
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
          className="w-fit font-label text-xs font-semibold uppercase tracking-wide text-brand-900 underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand motion-reduce:transition-none dark:text-on-surface"
          onClick={onNavigate}
        >
          {viewAllLabel}
        </Link>
      ) : null}
    </div>
  );
}
