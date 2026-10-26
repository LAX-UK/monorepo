import { AdminFailedPage } from "@/components/admin-fetch-state";
import {
  ExhibitionEditor,
  PageEditor,
  StoryEditor,
  VenueEditor,
} from "@/components/editorial/editorial-editors.client";
import { EDITORIAL_ENTITIES } from "@/lib/editorial-entities";
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
import type { LinksPayload } from "@/server/domain/editorial-links.vm";
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
  const hasLinks = id !== null && (kind === "exhibitions" || kind === "stories");
  const [detailResult, venuesResult, linksResult] = await Promise.all([
    id ? fetchAdminJson<EditorialDetail>(`editorial/${kind}/${id}`) : null,
    kind === "exhibitions"
      ? fetchAdminJson<{ items: EditorialAdminRow[] }>("editorial/venues")
      : null,
    hasLinks ? fetchAdminJson<LinksPayload>(`editorial/${kind}/${id}/links`) : null,
  ]);
  if (
    detailResult?.status === "unauthorized" ||
    venuesResult?.status === "unauthorized" ||
    linksResult?.status === "unauthorized"
  ) {
    redirect("/login");
  }
  if (detailResult?.status === "not_found") notFound();
  const failed = [detailResult, venuesResult, linksResult].find(
    (result) => result && result.status !== "ok",
  );
  if (failed && failed.status !== "ok") {
    return <AdminFailedPage title={entity.title} status={failed.status} />;
  }

  const detail = detailResult?.status === "ok" ? detailResult.data : null;
  const venues = venuesResult?.status === "ok" ? venuesResult.data.items : [];
  const links = linksResult?.status === "ok" ? linksResult.data : null;
  const artPublicUrl = getShopAdminContainer().config.artPublicUrl ?? null;
  return kind === "exhibitions" ? (
    <ExhibitionEditor
      key={id ?? "new"}
      detail={detail as ExhibitionDetail | null}
      venues={venues}
      links={links}
      artPublicUrl={artPublicUrl}
    />
  ) : kind === "stories" ? (
    <StoryEditor
      key={id ?? "new"}
      detail={detail as StoryDetail | null}
      links={links}
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
  );
}
