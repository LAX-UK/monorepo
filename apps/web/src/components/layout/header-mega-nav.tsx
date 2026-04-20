"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { navItemActive } from "@/components/layout/header-nav-config";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const MEGAMENU_PANEL_ID = "site-header-megamenu";
const HOVER_OPEN_MS = 80;
const HOVER_CLOSE_MS = 160;

type HeaderMegaNavProps = {
  sections: MegaMenuSection[];
  pathname: string;
  logo: ReactNode;
  trailing: ReactNode;
};

export function HeaderMegaNav({ sections, pathname, logo, trailing }: HeaderMegaNavProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => {
    void pathname;
    clearOpenHover();
    clearCloseHover();
    setOpenIndex(null);
  }, [pathname, clearOpenHover, clearCloseHover]);

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

  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
      <div className="flex items-center justify-between gap-4">
        {logo}

        <nav className="hidden items-center justify-center gap-9 lg:flex" aria-label="Primary">
          {sections.map((item, index) => {
            const active = navItemActive(pathname, item.href);
            const open = openIndex === index;
            return (
              <div key={item.href} className="flex flex-col items-center">
                <button
                  type="button"
                  ref={(el) => {
                    triggerRefs.current[index] = el;
                  }}
                  className={cn(
                    "group flex items-center gap-1 border-b-2 border-transparent pb-1 font-label text-sm font-medium uppercase leading-[21px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold motion-reduce:transition-none",
                    active || open ? "text-brand-900" : "text-nav-text hover:text-brand-900",
                    active || open
                      ? "border-brand-900"
                      : "border-transparent hover:border-brand-900/40",
                  )}
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
                  <MaterialIcon
                    name="expand_more"
                    className={cn(
                      "text-base! transition-transform motion-reduce:transition-none",
                      open ? "rotate-180" : "rotate-0",
                    )}
                    aria-hidden
                  />
                </button>
              </div>
            );
          })}
        </nav>

        {trailing}
      </div>

      {section ? (
        <section
          ref={panelRef}
          id={MEGAMENU_PANEL_ID}
          aria-label={section.label}
          className="absolute -mt-px left-0 right-0 top-full z-40 border-t border-nav-border bg-surface px-0 py-8 shadow-sm motion-reduce:shadow-none motion-reduce:transition-none"
          onKeyDown={onPanelKeyDown}
        >
          <div className="px-6 md:px-10">
            <HeaderMegaMenuPanelContent section={section} onNavigate={closeMenu} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HeaderMegaMenuPanelContent({
  section,
  onNavigate,
}: {
  section: MegaMenuSection;
  onNavigate: () => void;
}) {
  const viewAll = section.viewAllHref ?? section.href;
  const viewAllLabel =
    section.href === "/" ? "View all upcoming auctions" : `View all ${section.label.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-4">
      {section.items.length > 0 ? (
        <ul className="flex max-w-xl flex-col gap-3">
          {section.items.map((row) => (
            <li key={row.href}>
              <Link
                href={row.href}
                data-megamenu-link
                className="font-body text-sm font-medium text-brand-900 underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold motion-reduce:transition-none dark:text-on-surface"
                onClick={onNavigate}
              >
                {row.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-brand-400">Nothing to show yet.</p>
      )}
      <Link
        href={viewAll}
        data-megamenu-link
        className="w-fit font-label text-xs font-semibold uppercase tracking-wide text-brand-900 underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold motion-reduce:transition-none dark:text-on-surface"
        onClick={onNavigate}
      >
        {viewAllLabel}
      </Link>
    </div>
  );
}
