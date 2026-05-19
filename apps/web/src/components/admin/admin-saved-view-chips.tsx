import { FilterChipRow } from "@/components/admin/filter-chip-row";

export type AdminSavedView = {
  id: string;
  label: string;
  href: string;
};

type Props = {
  label?: string;
  views: readonly AdminSavedView[];
  activeId: string;
};

/** URL-only saved views (preset filter chips) for admin list pages. */
export function AdminSavedViewChips({ label = "Views", views, activeId }: Props) {
  return (
    <FilterChipRow
      label={label}
      chips={views.map((v) => ({
        id: v.id,
        label: v.label,
        href: v.href,
        active: v.id === activeId,
      }))}
    />
  );
}
