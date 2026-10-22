import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import {
  ExhibitionEditor,
  PageEditor,
  StoryEditor,
  VenueEditor,
} from "@/components/editorial/editorial-editors.client";
import { EDITORIAL_ENTITIES, editorialListHref } from "@/lib/editorial-entities";
import type {
  EditorialAdminRow,
  EditorialEntityKind,
  ExhibitionDetail,
  PageDetail,
  StoryDetail,
  VenueDetail,
} from "@/lib/editorial-entity-forms";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import { PageHeader } from "@auction/ui";
import { notFound, redirect } from "next/navigation";

type EditorialDetail = ExhibitionDetail | PageDetail | StoryDetail | VenueDetail;

/**
 * The editor route for one item, or for a new draft when `id` is null. Exhibitions also load the
 * venue list for their venue picker.
 */
export async function EditorialEditorPage({
  kind,
  id,
}: {
  kind: EditorialEntityKind;
  id: string | null;
}) {
  const entity = EDITORIAL_ENTITIES[kind];
  const [detailResult, venuesResult] = await Promise.all([
    id ? fetchAdminJson<EditorialDetail>(`editorial/${kind}/${id}`) : null,
    kind === "exhibitions"
      ? fetchAdminJson<{ items: EditorialAdminRow[] }>("editorial/venues")
      : null,
  ]);
  if (detailResult?.status === "unauthorized" || venuesResult?.status === "unauthorized") {
    redirect("/login");
  }
  if (detailResult?.status === "not_found") notFound();
  const failed = [detailResult, venuesResult].find((result) => result && result.status !== "ok");
  if (failed && failed.status !== "ok") {
    return <AdminFailedPage title={entity.title} status={failed.status} />;
  }

  const detail = detailResult?.status === "ok" ? detailResult.data : null;
  const venues = venuesResult?.status === "ok" ? venuesResult.data.items : [];
  const artPublicUrl = getShopAdminContainer().config.artPublicUrl ?? null;
  const title = detail?.label ?? entity.newLabel;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: entity.title, href: editorialListHref(kind) }}
            current={title}
          />
        }
        title={title}
        description={detail ? `/${detail.slug}` : "Saved as a draft until you publish it."}
      />
      {kind === "exhibitions" ? (
        <ExhibitionEditor
          key={id ?? "new"}
          detail={detail as ExhibitionDetail | null}
          venues={venues}
          artPublicUrl={artPublicUrl}
        />
      ) : kind === "stories" ? (
        <StoryEditor
          key={id ?? "new"}
          detail={detail as StoryDetail | null}
          artPublicUrl={artPublicUrl}
        />
      ) : kind === "venues" ? (
        <VenueEditor
          key={id ?? "new"}
          detail={detail as VenueDetail | null}
          artPublicUrl={artPublicUrl}
        />
      ) : (
        <PageEditor
          key={id ?? "new"}
          detail={detail as PageDetail | null}
          artPublicUrl={artPublicUrl}
        />
      )}
    </div>
  );
}
