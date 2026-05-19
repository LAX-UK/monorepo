import { buildListHref } from "@/lib/admin/admin-list-params";

export type LotPresetId = "all" | "active" | "draft" | "ended";

const BASE = "/admin/lots";

export function lotListPresetHref(
  id: LotPresetId,
  current: Record<string, string | string[] | undefined>,
): string {
  switch (id) {
    case "active":
      return buildListHref(BASE, current, { status: "active", offset: 0, view: "" });
    case "draft":
      return buildListHref(BASE, current, { status: "draft", offset: 0, view: "" });
    case "ended":
      return buildListHref(BASE, current, { status: "ended", offset: 0, view: "" });
    default:
      return buildListHref(BASE, current, { status: "", offset: 0 });
  }
}

export function lotListActivePreset(q: Record<string, string | string[] | undefined>): LotPresetId {
  const status = String(Array.isArray(q.status) ? q.status[0] : (q.status ?? ""));
  if (status === "active") return "active";
  if (status === "draft") return "draft";
  if (status === "ended") return "ended";
  return "all";
}
