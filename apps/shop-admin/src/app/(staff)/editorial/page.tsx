import { AdminFetchState } from "@/components/admin-fetch-state";
import { EditorialWorkspace } from "@/components/editorial-workspace.client";
import type { EditorialAdminRow } from "@/lib/editorial-entity-forms";
import type { AdminPlacementRow } from "@/lib/editorial-placements";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type RowList = { items: EditorialAdminRow[] };

export const metadata = { title: "Editorial" };

export default async function ShopAdminEditorialPage() {
  const [pages, venues, exhibitions, stories, placements] = await Promise.all([
    fetchAdminJson<RowList>("editorial/pages"),
    fetchAdminJson<RowList>("editorial/venues"),
    fetchAdminJson<RowList>("editorial/exhibitions"),
    fetchAdminJson<RowList>("editorial/stories"),
    fetchAdminJson<{ items: AdminPlacementRow[] }>("editorial/placements"),
  ]);
  const statuses = [pages, venues, exhibitions, stories, placements].map((result) => result.status);
  if (statuses.includes("unauthorized")) redirect("/login");

  const header = (
    <PageHeader
      title="Editorial"
      description="Venues, exhibitions, stories, fixed pages and home placements for lax.art."
    />
  );

  if (
    pages.status !== "ok" ||
    venues.status !== "ok" ||
    exhibitions.status !== "ok" ||
    stories.status !== "ok" ||
    placements.status !== "ok"
  ) {
    const status = statuses.includes("forbidden")
      ? "forbidden"
      : statuses.includes("not_found")
        ? "not_found"
        : "failed";
    return (
      <div className="space-y-8">
        {header}
        <AdminFetchState status={status} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}
      <EditorialWorkspace
        pages={pages.data.items}
        venues={venues.data.items}
        exhibitions={exhibitions.data.items}
        stories={stories.data.items}
        placements={placements.data.items}
        artPublicUrl={getShopAdminContainer().config.artPublicUrl ?? null}
      />
    </div>
  );
}
