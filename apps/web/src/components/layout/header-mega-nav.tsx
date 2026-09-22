"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { megaMenuSectionActive } from "@/components/layout/header-nav-config";
import { fetchLiveStreamsStatus } from "@/lib/data/http/live-streams.client";
import type { SiteHeaderTone } from "@/lib/layout/header-chrome-tone";
import { MarketingHeaderMegaNav } from "@auction/marketing-ui";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const MEGAMENU_PANEL_ID = "site-header-megamenu";

type HeaderMegaNavProps = {
  sections: MegaMenuSection[];
  pathname: string;
  searchParams: Pick<URLSearchParams, "get"> | null;
  onOpenChange?: (open: boolean) => void;
  logo: ReactNode;
  trailing: ReactNode;
  headerTone?: SiteHeaderTone;
};

export function HeaderMegaNav({
  sections,
  pathname,
  searchParams,
  onOpenChange,
  logo,
  trailing,
  headerTone = "on-light",
}: HeaderMegaNavProps) {
  const [liveStreamActive, setLiveStreamActive] = useState(false);

  useEffect(() => {
    const checkStreams = async () => {
      const data = await fetchLiveStreamsStatus();
      setLiveStreamActive(data.active);
    };
    void checkStreams();

    const interval = setInterval(() => {
      void checkStreams();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const searchKey = searchParams == null ? "" : searchParams.toString();
  const resetKey = `${pathname}:${searchKey}`;

  return (
    <MarketingHeaderMegaNav
      sections={sections}
      isSectionActive={(section) => megaMenuSectionActive(pathname, section, searchParams)}
      resetKey={resetKey}
      logo={logo}
      trailing={trailing}
      headerTone={headerTone}
      panelId={MEGAMENU_PANEL_ID}
      {...(onOpenChange ? { onOpenChange } : {})}
      renderTriggerBadge={(section) =>
        section.id === "auctions" && liveStreamActive ? (
          <span className="relative ml-1.5 flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live-red opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live-red" />
          </span>
        ) : null
      }
    />
  );
}
