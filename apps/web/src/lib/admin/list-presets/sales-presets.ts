import { buildListHref } from "@/lib/admin/admin-list-params";

export type SalePresetId = "all" | "upcoming" | "live" | "closed" | "settled";

const BASE = "/admin/sales";

export function saleListPresetHref(
  id: SalePresetId,
  current: Record<string, string | string[] | undefined>,
): string {
  switch (id) {
    case "upcoming":
      return buildListHref(BASE, current, {
        lifecycle: "upcoming",
        status: "",
        offset: 0,
      });
    case "live":
      return buildListHref(BASE, current, {
        lifecycle: "live",
        status: "",
        offset: 0,
      });
    case "closed":
      return buildListHref(BASE, current, {
        lifecycle: "closed",
        status: "",
        offset: 0,
      });
    case "settled":
      return buildListHref(BASE, current, {
        lifecycle: "settled",
        status: "",
        offset: 0,
      });
    default:
      return buildListHref(BASE, current, {
        lifecycle: "",
        status: "",
        offset: 0,
      });
  }
}

export function saleListActivePreset(
  q: Record<string, string | string[] | undefined>,
): SalePresetId {
  const lifeRaw = String(Array.isArray(q.lifecycle) ? q.lifecycle[0] : (q.lifecycle ?? ""));
  const lifecycle = lifeRaw.trim().toLowerCase();
  if (lifecycle === "upcoming") return "upcoming";
  if (lifecycle === "live") return "live";
  if (lifecycle === "closed") return "closed";
  if (lifecycle === "settled") return "settled";

  const status = String(Array.isArray(q.status) ? q.status[0] : (q.status ?? ""));
  if (status === "active") return "live";
  if (status === "scheduled") return "upcoming";
  if (status === "ended") return "closed";
  return "all";
}
