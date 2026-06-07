import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { sellDepartmentsAnchorHref } from "@/lib/marketing/sell-departments";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";

/** Timed auctions: online-only scheduled sales on the calendar (best-effort deep link). */
const timedAuctionsHref = calendarSalesHref({
  tab: "upcoming",
  deliveryMode: "online",
});

const investmentGradeMinGbp = 50_000;

function searchHref(sort?: "endingAsc" | "createdDesc", ending?: "24h"): string {
  const params = new URLSearchParams();
  if (sort && sort !== "endingAsc") params.set("sort", sort);
  if (ending) params.set("ending", ending);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
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
        { href: calendarSalesHref({ tab: "live" }), label: "Live Now" },
        { href: calendarSalesHref({ tab: "upcoming" }), label: "Upcoming Auctions" },
        { href: timedAuctionsHref, label: "Timed Auctions" },
        { href: calendarSalesHref({ tab: "results" }), label: "Past Results" },
        { href: "/sales", label: "Auction Calendar" },
        { href: "/dashboard/settings/notifications", label: "Auction Alerts" },
      ],
    },
    {
      id: "buy",
      href: "/search",
      label: "Buy",
      items: [
        { href: "/search", label: "Browse Lots" },
        { href: searchHref("endingAsc", "24h"), label: "Ending Soon" },
        { href: searchHref("createdDesc"), label: "New This Week" },
        { href: calendarSalesHref({ maxPrice: 5_000 }), label: "Under £5,000" },
        { href: calendarSalesHref({ maxPrice: 25_000 }), label: "Under £25,000" },
        {
          href: calendarSalesHref({ minPrice: investmentGradeMinGbp }),
          label: "Investment-Grade Works",
        },
        { href: calendarSalesHref({ tab: "privateSales" }), label: "Private Sales" },
        { href: "/buy", label: "Buying Guide" },
      ],
    },
    {
      id: "sell",
      href: "/sell",
      label: "Sell",
      items: [
        { href: "/sell", label: "Consignment Guide" },
        { href: sellDepartmentsAnchorHref(), label: "What we accept" },
        { href: sellIntakeHref(), label: "Start a submission" },
        { href: "/sell/watches", label: "Watches & clocks" },
        { href: "/sell/motor-cars", label: "Motor cars" },
        { href: "/sell/prints", label: "Prints & editions" },
        { href: "/sell/estate", label: "Estate collections" },
        { href: "/sell/corporate", label: "Corporate collections" },
        { href: "/dashboard/seller", label: "Seller dashboard" },
      ],
    },
    {
      id: "privateSales",
      href: calendarSalesHref({ tab: "privateSales" }),
      label: "Private Sales",
      items: [
        { href: calendarSalesHref({ tab: "privateSales" }), label: "Available Now" },
        { href: "/contact", label: "Make an Offer" },
        { href: "/contact", label: "Private Rooms" },
        { href: "/contact", label: "Corporate Acquisitions" },
        { href: "/contact", label: "Speak to Advisor" },
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
        { href: "/artists/historical", label: "Historical & deceased" },
        { href: "/artists/kind/brands", label: "Brands" },
        { href: "/artists/kind/marques", label: "Marques" },
        { href: sellIntakeHref(), label: "Start a submission" },
      ],
    },
  ];
}
