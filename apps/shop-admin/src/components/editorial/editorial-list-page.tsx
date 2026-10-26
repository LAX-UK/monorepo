import { AdminFailedPage } from "@/components/admin-fetch-state";
import { EditorialList } from "@/components/editorial/editorial-list.client";
import { EDITORIAL_ENTITIES } from "@/lib/editorial-entities";
import type { EditorialEntityKind } from "@/lib/editorial-entity-forms";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import {
  type EditorialListApiRow,
  type EditorialListState,
  editorialListPage,
  toEditorialListRow,
} from "@/server/domain/editorial-list.vm";
import { redirect } from "next/navigation";

/**
 * A list of one editorial entity. The API returns every row, so search, the kind filter, the
 * view, the sort and the page all run here over the full set; the URL carries them so a list
 * can be shared.
 */
export async function EditorialListPage({
  kind,
  state,
}: {
  kind: EditorialEntityKind;
  state: EditorialListState;
}) {
  const entity = EDITORIAL_ENTITIES[kind];
  const result = await fetchAdminJson<{ items: EditorialListApiRow[] }>(`editorial/${kind}`);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title={entity.title} status={result.status} />;
  }

  const rows =
    result.status === "ok" ? result.data.items.map((r) => toEditorialListRow(kind, r)) : [];
  const page = editorialListPage(kind, rows, state);

  return (
    <EditorialList
      kind={kind}
      entity={entity}
      state={state}
      page={page}
      totalRows={rows.length}
      initialOpened={rows.find((row) => row.id === state.open) ?? null}
      artPublicUrl={getShopAdminContainer().config.artPublicUrl ?? null}
      loadFailed={result.status === "failed"}
    />
  );
}
