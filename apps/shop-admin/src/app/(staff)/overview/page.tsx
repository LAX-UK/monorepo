import { AdminFailedPage } from "@/components/admin-fetch-state";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { loadEnquirySummary } from "@/server/application/load-enquiry-summary";
import { buildAdminNavGroups } from "@/server/domain/admin-nav.vm";
import { buildOverviewTiles, buildWelcomeSections } from "@/server/domain/overview.vm";
import type { AdminOverviewKpis } from "@auction/shop-contracts";
import { KpiTile, PageHeader } from "@auction/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Overview" };

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

  return (
    <div>
      <PageHeader
        title="Overview"
        description="What needs attention across lax.art and LAX Shop."
      />
      {tiles.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.key}>
              <Link
                href={tile.href}
                className="block h-full rounded-shell-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <KpiTile variant="dashboard" clickable label={tile.label} value={tile.value} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section aria-labelledby="welcome-heading" className="max-w-2xl">
          <h2 id="welcome-heading" className="font-headline text-lg font-semibold">
            Welcome to LAX Admin
          </h2>
          <p className="mt-1 text-on-surface-variant">
            Nothing is waiting for you here. Pick up your work from the areas you can open.
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {sections.map((section) => (
              <nav key={section.title} aria-label={section.title}>
                <h3 className="text-sm font-semibold text-on-surface-variant">{section.title}</h3>
                <ul className="mt-2 space-y-1">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="underline underline-offset-4">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
