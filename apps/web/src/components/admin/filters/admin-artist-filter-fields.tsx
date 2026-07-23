"use client";

import type { ArtistCategoryFilterOption } from "@/components/admin/artist-filter-form";
import {
  AdminFilterDraftInput,
  AdminFilterDraftSelect,
  AdminFilterToggleGroup,
  AdminFilterToggleRow,
} from "@/components/admin/filters/admin-filter-draft-fields";
import {
  AdminFilterSection,
  AdminFilterSheetFields,
} from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import type { ArtistFilterDraft } from "@/lib/admin/filters/artist-filter-adapter";
import { creatorKindConfigList } from "@auction/types";

const KIND_FILTER_OPTIONS = [
  { value: "", label: "Any" },
  ...creatorKindConfigList.map((c) => ({ value: c.kind, label: c.label })),
];

type Props = {
  categoryOptions?: readonly ArtistCategoryFilterOption[];
};

export function AdminArtistFilterFields({ categoryOptions = [] }: Props) {
  const { draft, patch } = useAdminFilterDraftContext<ArtistFilterDraft>();

  return (
    <AdminFilterSheetFields>
      <AdminFilterDraftInput
        id="catalog-artists-search"
        label="Search"
        value={draft.q}
        onChange={(q) => patch({ q })}
        placeholder="Name or slug…"
      />
      <AdminFilterDraftInput
        id="catalog-artists-country"
        label="Country (ISO code)"
        value={draft.country}
        onChange={(country) => patch({ country })}
        placeholder="e.g. FR"
        type="text"
        className="uppercase"
      />
      <AdminFilterDraftSelect
        id="catalog-artists-status"
        label="Status"
        value={draft.status}
        onChange={(status) => patch({ status })}
        options={[
          { value: "", label: "Any" },
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "merged_into", label: "Merged" },
        ]}
      />
      <AdminFilterDraftSelect
        id="catalog-artists-kind"
        label="Kind"
        value={draft.kind}
        onChange={(kind) => patch({ kind })}
        options={KIND_FILTER_OPTIONS}
      />
      <AdminFilterDraftSelect
        id="catalog-artists-linked"
        label="Linked account"
        value={draft.linked}
        onChange={(linked) => patch({ linked })}
        options={[
          { value: "any", label: "Any" },
          { value: "yes", label: "Has owner account" },
          { value: "no", label: "No owner account" },
        ]}
      />
      {categoryOptions.length > 0 ? (
        <AdminFilterDraftSelect
          id="catalog-artists-category"
          label="Department"
          value={draft.categoryId}
          onChange={(categoryId) => patch({ categoryId })}
          options={[{ value: "", label: "Any" }, ...categoryOptions]}
        />
      ) : null}
      <AdminFilterDraftSelect
        id="catalog-artists-sort"
        label="Sort"
        value={draft.sort}
        onChange={(sort) => patch({ sort })}
        options={[
          { value: "name_asc", label: "Name A–Z" },
          { value: "popular", label: "Most lots" },
          { value: "recent", label: "Recently updated" },
        ]}
      />
      <AdminFilterSection label="Flags">
        <AdminFilterToggleGroup>
          <AdminFilterToggleRow
            id="catalog-artists-featured"
            label="Featured"
            checked={draft.featured}
            onCheckedChange={(featured) => patch({ featured })}
          />
          <AdminFilterToggleRow
            id="catalog-artists-verified"
            label="Verified"
            checked={draft.verified}
            onCheckedChange={(verified) => patch({ verified })}
          />
          <AdminFilterToggleRow
            id="catalog-artists-archived"
            label="Include archived"
            checked={draft.includeArchived}
            onCheckedChange={(includeArchived) => patch({ includeArchived })}
          />
        </AdminFilterToggleGroup>
      </AdminFilterSection>
    </AdminFilterSheetFields>
  );
}
