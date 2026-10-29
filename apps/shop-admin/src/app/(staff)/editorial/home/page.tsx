import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { EditorialPlacementsTab } from "@/components/editorial-placements-tab.client";
import { ViewOnlyMarker } from "@/components/view-only-marker.client";
import type { EditorialAdminRow } from "@/lib/editorial-entity-forms";
import type { AdminPlacementRow } from "@/lib/editorial-placements";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/staff-ui";
import { redirect } from "next/navigation";

type RowList = { items: EditorialAdminRow[] };

export const metadata = { title: "lax.art home" };

export default async function HomePlacementsPage() {
  const [pages, venues, exhibitions, stories, placements] = await Promise.all([
    fetchAdminJson<RowList>("editorial/pages"),
    fetchAdminJson<RowList>("editorial/venues"),
    fetchAdminJson<RowList>("editorial/exhibitions"),
    fetchAdminJson<RowList>("editorial/stories"),
    fetchAdminJson<{ items: AdminPlacementRow[] }>("editorial/placements"),
  ]);
  const results = [pages, venues, exhibitions, stories, placements];
  if (results.some((result) => result.status === "unauthorized")) redirect("/login");
  if (
    pages.status !== "ok" ||
    venues.status !== "ok" ||
    exhibitions.status !== "ok" ||
    stories.status !== "ok" ||
    placements.status !== "ok"
  ) {
    const status = results.some((result) => result.status === "forbidden")
      ? "forbidden"
      : results.some((result) => result.status === "not_found")
        ? "not_found"
        : "failed";
    return <AdminFailedPage title="lax.art home" status={status} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: "Editorial", href: "/editorial" }}
            current="lax.art home"
          />
        }
        title="lax.art home"
        status={<ViewOnlyMarker editRequires="editorial.write" />}
        description="What lax.art features on its home and hub pages, slot by slot. Each slot is saved on its own and replaces everything in it; rows show in the order listed."
      />
      <EditorialPlacementsTab
        placements={placements.data.items}
        refLists={{
          exhibition: exhibitions.data.items,
          story: stories.data.items,
          page: pages.data.items,
          venue: venues.data.items,
        }}
      />
    </div>
  );
}
