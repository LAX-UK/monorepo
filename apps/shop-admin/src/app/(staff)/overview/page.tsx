import { AdminFailedPage } from "@/components/admin-fetch-state";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { loadEnquirySummary } from "@/server/application/load-enquiry-summary";
import { buildAdminNavGroups } from "@/server/domain/admin-nav.vm";
import {
  buildOverviewTiles,
  buildWelcomeSections,
  overviewNeedsAttention,
} from "@/server/domain/overview.vm";
import type { AdminOverviewKpis } from "@auction/shop-contracts";
import { AttentionList, LinkList, PageHeader, type StaffLinkComponent } from "@auction/staff-ui";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Overview" };

const NextLink: StaffLinkComponent = Link;

export default async function OverviewPage() {
  const [kpisResult, sessionResult] = await Promise.all([
    fetchAdminJson<AdminOverviewKpis>("overview/kpis"),
    loadAdminSession(),
  ]);
  if (kpisResult.status === "unauthorized" || sessionResult.status === "unauthorized") {
    redirect("/login");
  }
  if (kpisResult.status !== "ok") {
    return <AdminFailedPage title="Overview" status={kpisResult.status} />;
  }
  if (sessionResult.status !== "ok") {
    return <AdminFailedPage title="Overview" status={sessionResult.status} />;
  }

  const session = sessionResult.data;
  const enquiries = await loadEnquirySummary(session.capabilities);
  const navGroups = buildAdminNavGroups({
    capabilities: session.capabilities,
    features: session.features,
  });
  const tiles = buildOverviewTiles({
    navGroups,
    kpis: kpisResult.data,
    newEnquiryCount: enquiries?.newCount ?? null,
  });
  const sections = buildWelcomeSections(navGroups);
  const nothingWaiting = !overviewNeedsAttention(tiles);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="What needs attention across lax.art and LAX Shop."
      />
      {tiles.length > 0 ? (
        <AttentionList
          Link={NextLink}
          items={tiles.map((tile) => ({
            id: tile.key,
            label: tile.label,
            count: tile.value,
            href: tile.href,
            ...(tile.tone ? { tone: tile.tone } : {}),
            ...(tile.keepWhenZero ? { keepWhenZero: true } : {}),
          }))}
        />
      ) : null}
      {nothingWaiting ? (
        <section aria-labelledby="areas-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2
              id="areas-heading"
              className="font-staff-display text-staff-lg font-semibold text-staff-fg"
            >
              Pick up your work
            </h2>
            <p className="text-staff-sm text-staff-muted">
              Nothing is waiting for you here. Open one of the areas you can use.
            </p>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-2">
            {sections.map((section) => (
              <LinkList
                key={section.title}
                Link={NextLink}
                title={section.title}
                items={section.items.map((item) => ({
                  id: item.href,
                  label: item.label,
                  href: item.href,
                }))}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
