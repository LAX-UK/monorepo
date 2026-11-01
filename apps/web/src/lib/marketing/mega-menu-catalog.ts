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

/** Private sales are arranged with a specialist, not browsed on the calendar. */
const PRIVATE_SALE_ENQUIRY_HREF = "/contact?intent=private-sale";

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
        { href: calendarSalesHref({ tab: "live" }), label: "Live now" },
        { href: calendarSalesHref({ tab: "upcoming" }), label: "Upcoming auctions" },
        { href: timedAuctionsHref, label: "Timed auctions" },
        { href: "/results", label: "Past results" },
        { href: "/sales", label: "Auction calendar" },
        { href: "/settings#alerts", label: "Auction alerts" },
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
      id: "buy",
      href: "/search",
      label: "Buy",
      items: [
        { href: "/search", label: "Browse lots" },
        { href: searchHref("endingAsc", "24h"), label: "Ending soon" },
        { href: searchHref("createdDesc"), label: "New this week" },
        { href: calendarSalesHref({ maxPrice: 5_000 }), label: "Under £5,000" },
        { href: calendarSalesHref({ maxPrice: 25_000 }), label: "Under £25,000" },
        {
          href: calendarSalesHref({ minPrice: investmentGradeMinGbp }),
          label: "Investment-grade works",
        },
        { href: PRIVATE_SALE_ENQUIRY_HREF, label: "Private sales" },
        { href: "/buy", label: "Buying guide" },
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
        { href: "/selling", label: "Seller dashboard" },
      ],
    },
    {
      id: "privateSales",
      href: PRIVATE_SALE_ENQUIRY_HREF,
      label: "Private sales",
      items: [
        { href: PRIVATE_SALE_ENQUIRY_HREF, label: "Available now" },
        { href: "/contact", label: "Make an offer" },
        { href: "/contact", label: "Private rooms" },
        { href: "/contact", label: "Corporate acquisitions" },
        { href: "/contact", label: "Speak to an advisor" },
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
