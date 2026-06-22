"use client";

import { MarketingUnderlineTabs } from "@/components/marketing/marketing-underline-tabs";
import { SALE_ANCHOR_STICKY_CLASS } from "@/lib/marketing/chrome";
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
    <MarketingUnderlineTabs
      variant="anchor"
      ariaLabel="Sale sections"
      className={cn(
        `${SALE_ANCHOR_STICKY_CLASS} border-b border-outline-variant/30 bg-page-bg/90 backdrop-blur-md dark:bg-background/90`,
        className,
      )}
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        href: `#${tab.id}`,
        active: tab.id === activeId,
        onClick: (e) => onClick(e, tab.id),
      }))}
    />
  );
}
