"use client";

import { SALE_ANCHOR_STICKY_CLASS } from "@/lib/marketing/chrome";
import { activeSectionId } from "@/lib/marketing/sale-anchor-active";
import { cn } from "@auction/ui";
import { OverflowTabs, PlainLink } from "@auction/ui/lax";
import { useCallback, useEffect, useState } from "react";

/** Where a section counts as being read: a third of the way down the viewport. */
const READING_LINE = 1 / 3;

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

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * READING_LINE;
      setActiveId(
        activeSectionId(
          sections.map((el) => ({ id: el.id, top: el.getBoundingClientRect().top })),
          line,
        ),
      );
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
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
    <div
      className={cn(
        `${SALE_ANCHOR_STICKY_CLASS} border-b border-lax-line bg-page-bg/90 backdrop-blur-md dark:bg-background/90`,
        className,
      )}
    >
      <div className="mx-auto flex max-w-[var(--container-max,1440px)] px-4 md:px-6 lg:px-10">
        <OverflowTabs
          label="Sale sections"
          Link={PlainLink}
          currentId={activeId}
          tabs={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            href: `#${tab.id}`,
            currentKind: "true",
            onClick: (e) => onClick(e, tab.id),
          }))}
        />
      </div>
    </div>
  );
}
