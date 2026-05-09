import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";

/** Timed auctions: online-only scheduled sales on the calendar (best-effort deep link). */
const timedAuctionsHref = calendarSalesHref({
  tab: "upcoming",
  deliveryMode: "online",
});

const investmentGradeMinGbp = 50_000;

function searchHref(sort?: "endingAsc" | "createdDesc"): string {
  if (!sort || sort === "endingAsc") return "/search";
  return `/search?sort=${sort}`;
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
        { href: searchHref("endingAsc"), label: "Ending Soon" },
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
        { href: "/dashboard/submissions/new", label: "Request Valuation" },
        { href: "/sell", label: "Sell Art" },
        { href: "/contact", label: "Sell Prints & Editions" },
        { href: "/contact", label: "Corporate Collections" },
        { href: "/contact", label: "Estate Collections" },
        { href: "/sell", label: "Consignment Guide" },
        { href: "/dashboard/seller", label: "Seller Dashboard" },
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
      href: "/artist/featured",
      label: "Artists",
      items: [{ href: "/artist/featured", label: "Featured artists" }],
    },
  ];
}
