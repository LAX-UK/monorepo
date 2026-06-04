"use client";

import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { useCallback, useEffect, useState } from "react";

export type SaleAnchorTab = {
  /** Target section id (without the leading #). */
  id: string;
  label: string;
};

type Props = {
  tabs: readonly SaleAnchorTab[];
  className?: string;
};

/** Sticky in-page jump tabs for the sale page with scroll-spy highlighting. */
export function SaleAnchorTabs({ tabs, className }: Props) {
  const [activeId, setActiveId] = useState<string>(tabs[0]?.id ?? "");

  useEffect(() => {
    const sections = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el != null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [tabs]);

  const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    setActiveId(id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }, []);

  return (
    <nav
      aria-label="Sale sections"
      className={cn(
        "sticky top-[var(--header-height)] z-[var(--z-sticky,30)] border-b border-outline-variant/30 bg-page-bg/90 backdrop-blur-md dark:bg-background/90",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[var(--container-max,1440px)] gap-1 overflow-x-auto px-8 [scrollbar-width:none] md:px-10 lg:px-14">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              onClick={(e) => onClick(e, tab.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 font-label text-[0.7rem] font-semibold uppercase tracking-wider transition-colors motion-reduce:transition-none",
                FOCUS_RING,
                active
                  ? "border-primary text-on-surface"
                  : "border-transparent text-on-surface-variant hover:text-on-surface",
              )}
            >
              {tab.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
