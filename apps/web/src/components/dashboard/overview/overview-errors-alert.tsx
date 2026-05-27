import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import { DASHBOARD_ROUTES, dashboardLoginUrl } from "@/lib/dashboard/dashboard-copy";
import type { DashboardOverviewErrors } from "@/lib/data/view-models/dashboard-overview.vm";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const SLICE_LINKS: Partial<Record<keyof DashboardOverviewErrors, { href: string; label: string }>> =
  {
    active: { href: "/search", label: "Browse live auctions" },
    portfolio: { href: DASHBOARD_ROUTES.portfolio, label: "Open collection" },
    watchlist: { href: DASHBOARD_ROUTES.watchlist, label: "Open watchlist" },
    artistFollow: { href: DASHBOARD_ROUTES.artistFollow, label: "Open followed artists" },
    bids: { href: DASHBOARD_ROUTES.bids, label: "Open bids" },
    submissions: { href: DASHBOARD_ROUTES.submissions, label: "Open submissions" },
    notifications: { href: DASHBOARD_ROUTES.notifications, label: "Open notifications" },
    session: { href: dashboardLoginUrl(DASHBOARD_ROUTES.overview), label: "Sign in again" },
  };

type OverviewErrorsAlertProps = {
  errors: DashboardOverviewErrors;
};

export function OverviewErrorsAlert({ errors }: OverviewErrorsAlertProps) {
  const entries = (
    [
      ["session", errors.session],
      ["active", errors.active],
      ["portfolio", errors.portfolio],
      ["watchlist", errors.watchlist],
      ["artistFollow", errors.artistFollow],
      ["bids", errors.bids],
      ["submissions", errors.submissions],
      ["notifications", errors.notifications],
    ] as const
  ).filter(([, message]) => Boolean(message));

  if (entries.length === 0) return null;

  return (
    <DashboardErrorAlert
      title="Some sections could not load"
      message="Your dashboard is partially available. Retry the affected sections below."
    >
      <ul className="mt-2 space-y-3 font-body text-sm">
        {entries.map(([key, message]) => {
          const link = SLICE_LINKS[key];
          return (
            <li
              key={key}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-on-surface">{message}</span>
              {link ? (
                <Button variant="secondaryOutline" size="sm" asChild className="shrink-0">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </DashboardErrorAlert>
  );
}
