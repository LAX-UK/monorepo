import { buildListHref } from "@/lib/admin/admin-list-params";

export type SalePresetId = "all" | "live" | "draft" | "ended";

const BASE = "/admin/sales";

export function saleListPresetHref(
  id: SalePresetId,
  current: Record<string, string | string[] | undefined>,
): string {
  switch (id) {
    case "live":
      return buildListHref(BASE, current, { status: "active", offset: 0, q: "" });
    case "draft":
      return buildListHref(BASE, current, { status: "draft", offset: 0 });
    case "ended":
      return buildListHref(BASE, current, { status: "ended", offset: 0 });
    default:
      return buildListHref(BASE, current, { status: "", offset: 0 });
  }
}

export function saleListActivePreset(
  q: Record<string, string | string[] | undefined>,
): SalePresetId {
  const status = String(Array.isArray(q.status) ? q.status[0] : (q.status ?? ""));
  if (status === "active") return "live";
  if (status === "draft") return "draft";
  if (status === "ended") return "ended";
  return "all";
}
