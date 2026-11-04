import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { PRIVATE_SALES_PATH } from "@/lib/marketing/private-sales";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { sellDepartmentsAnchorHref } from "@/lib/marketing/sell-departments";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";

/** Where a visitor without an account signs up for new-sale emails: the alerts band on home. */
export const VISITOR_ALERTS_HREF = "/#alerts";

function endingSoonHref(): string {
  return "/search?ending=24h";
}

/**
 * Marketing primary mega menu — single source of truth for labels and routes.
 * Item hrefs without dedicated pages point to the closest honest destination.
 */
export function getMarketingMegaMenuSections(): MegaMenuSection[] {
  return [
    {
      id: "auctions",
      href: "/sales",
      label: "Auctions",
      items: [
        { href: calendarSalesHref({ tab: "live" }), label: "Live now", requires: "liveSales" },
        { href: endingSoonHref(), label: "Ending soon", requires: "endingSoon" },
        { href: calendarSalesHref({ tab: "upcoming" }), label: "Upcoming auctions" },
        { href: "/sales", label: "Auction calendar" },
        { href: VISITOR_ALERTS_HREF, label: "Auction alerts" },
      ],
    },
    {
      id: "results",
      href: "/results",
      label: "Results",
      // A plain link in the desktop bar; the phone drawer lists the two ways in.
      linkHref: "/results",
      items: [
        { href: "/results", label: "Sale results" },
        { href: "/results?view=lots", label: "Sold lots" },
      ],
    },
    {
      id: "artists",
      href: "/artists",
      label: "Artists",
      items: [
        { href: "/artists", label: "Browse all artists" },
        { href: "/artists/featured", label: "Featured artists" },
        { href: "/artists/living", label: "Living artists" },
        { href: "/artists/historical", label: "Historical and deceased" },
        { href: "/artists/kind/brands", label: "Brands" },
        { href: "/artists/kind/marques", label: "Marques" },
        { href: sellIntakeHref(), label: "Start a submission" },
      ],
    },
    {
      id: "sell",
      href: "/sell",
      label: "Sell",
      items: [
        { href: "/sell", label: "Consignment guide" },
        { href: sellDepartmentsAnchorHref(), label: "What we accept" },
        { href: sellIntakeHref(), label: "Start a submission" },
        { href: "/sell/watches", label: "Watches & clocks" },
        { href: "/sell/motor-cars", label: "Motor cars" },
        { href: "/sell/prints", label: "Prints & editions" },
        { href: "/sell/estate", label: "Estate collections" },
        { href: "/sell/corporate", label: "Corporate collections" },
        { href: PRIVATE_SALES_PATH, label: "Private sales" },
        { href: "/selling", label: "Selling" },
      ],
    },
  ];
}
