import type { PaletteItem, PaletteSource } from "@/components/layout/palette/types";
import { dataRequestHref } from "@/lib/admin/data-requests/data-requests-search";
import { kindParts, requestStatus } from "@/lib/admin/data-requests/data-requests.vm";
import { paletteJsonFetch } from "@/lib/data/http/palette-search.client";
import {
  type DataRequestList,
  dataRequestReferenceSchema,
} from "@auction/identity-contracts/data-requests";

const LIMIT = 5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * What the palette searches Data requests for: a whole reference (DR-0012, DL-7F3C1A) or a full
 * email address, never part of either, the same rule as the list. People without the permission
 * get no result, because the API refuses them.
 */
export function dataRequestsPaletteQuery(raw: string): string | null {
  const query = raw.trim();
  if (EMAIL.test(query)) return query;
  const reference = query.toUpperCase();
  return dataRequestReferenceSchema.safeParse(reference).success ? reference : null;
}

export const dataRequestsPaletteSource: PaletteSource = {
  id: "data-requests",
  heading: "Data requests",
  enabled: true,
  async search(query) {
    const q = dataRequestsPaletteQuery(query);
    if (!q) return [];
    const qs = new URLSearchParams({ view: "all", q });
    const body = await paletteJsonFetch<{ data: DataRequestList }>("/admin/data-requests", qs);
    if (!body) return [];
    return body.data.items.slice(0, LIMIT).map(
      (request): PaletteItem => ({
        id: `data-request-${request.reference}`,
        href: dataRequestHref(request.reference, null),
        label: request.reference,
        hint: `${request.personLabel} · ${kindParts(request).primary} · ${requestStatus(request).label}`,
        kind: "record",
      }),
    );
  },
};
