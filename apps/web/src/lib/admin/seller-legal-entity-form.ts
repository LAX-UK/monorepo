import type { AdminLegalEntityPickerRow } from "@/lib/data/http/admin.server";

/** Wires legal-entity picker selection to an id field + optional display-name mirror field. */
export function applySellerLegalEntitySelection(
  fieldOnChange: (value: string) => void,
  setDisplayName: (name: string) => void,
  id: string | null,
  row?: AdminLegalEntityPickerRow,
): void {
  fieldOnChange(id ?? "");
  if (row) {
    setDisplayName(row.displayName);
  } else if (!id) {
    setDisplayName("");
  }
}
