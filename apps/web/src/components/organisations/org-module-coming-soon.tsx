import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import { Button } from "@auction/ui/components/button";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";

/** Shown on production when the organisation module is not yet available. */
export function OrgModuleComingSoon() {
  const copy = DASHBOARD_EMPTY.orgModuleComingSoon;
  return (
    <div className="mx-auto max-w-5xl">
      <DashboardEmptyState
        variant="hero"
        illustration="plinth"
        title={
          <span className="flex flex-col items-center gap-3">
            <StatusBadge tone="neutral">Coming soon</StatusBadge>
            {copy.title}
          </span>
        }
        description={copy.description}
        action={
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild variant="cta" size="default">
              <Link href="/contact">Contact us</Link>
            </Button>
            <Button asChild variant="ghost" size="default">
              <a href={`mailto:${SITE_SUPPORT_EMAIL}`}>{SITE_SUPPORT_EMAIL}</a>
            </Button>
          </div>
        }
      />
    </div>
  );
}
