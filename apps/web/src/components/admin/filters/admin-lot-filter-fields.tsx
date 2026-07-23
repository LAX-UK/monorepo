"use client";

import { AdminFilterDraftSelect } from "@/components/admin/filters/admin-filter-draft-fields";
import { AdminFilterSheetFields } from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import type { LotFilterDraft } from "@/lib/admin/filters/lot-filter-adapter";
import { LOT_LIST_SORT_KEYS, LOT_LIST_SORT_LABELS } from "@/lib/admin/lots-list-sort";
import type { ArtistProfile, CategoryNode, Sale } from "@auction/types";

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, depth },
    ...flattenCategories(n.children, depth + 1),
  ]);
}

type Props = {
  artists: Pick<ArtistProfile, "id" | "displayName">[];
  sales: Pick<Sale, "id" | "title">[];
  categories: CategoryNode[];
};

export function AdminLotFilterFields({ artists, sales, categories }: Props) {
  const { draft, patch } = useAdminFilterDraftContext<LotFilterDraft>();
  const flat = flattenCategories(categories);

  return (
    <AdminFilterSheetFields>
      {artists.length > 0 ? (
        <AdminFilterDraftSelect
          id="admin-lot-filter-artist"
          label="Artist"
          value={draft.artistId}
          onChange={(artistId) => patch({ artistId })}
          options={[
            { value: "", label: "All artists" },
            ...artists.map((a) => ({ value: a.id, label: a.displayName })),
          ]}
        />
      ) : null}
      {sales.length > 0 ? (
        <AdminFilterDraftSelect
          id="admin-lot-filter-sale"
          label="Sale"
          value={draft.saleId}
          onChange={(saleId) => patch({ saleId })}
          options={[
            { value: "", label: "All sales" },
            ...sales.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />
      ) : null}
      {flat.length > 0 ? (
        <AdminFilterDraftSelect
          id="admin-lot-filter-category"
          label="Category"
          value={draft.categoryId}
          onChange={(categoryId) => patch({ categoryId })}
          options={[
            { value: "", label: "All categories" },
            ...flat.map((c) => ({
              value: c.id,
              label: `${"  ".repeat(c.depth)}${c.name}`,
            })),
          ]}
        />
      ) : null}
      <AdminFilterDraftSelect
        id="admin-lot-filter-sort"
        label="Sort"
        value={draft.sort}
        onChange={(sort) => patch({ sort: sort as LotFilterDraft["sort"] })}
        options={[
          { value: "", label: "Default" },
          ...LOT_LIST_SORT_KEYS.map((value) => ({
            value,
            label: LOT_LIST_SORT_LABELS[value],
          })),
        ]}
      />
    </AdminFilterSheetFields>
  );
}
