import { buildListHref } from "@/lib/admin/admin-list-params";
import { adminLotListPath } from "@/lib/admin/catalog-routes";

export type LotLensId = "all" | "live" | "draft" | "ending" | "attention";

const BASE = adminLotListPath();

export function lotLensHref(
  lens: LotLensId,
  current: Record<string, string | string[] | undefined>,
): string {
  const clear = {
    lens: "",
    status: "",
    withdrawal: "",
    needsPhotos: "",
    sort: "",
    offset: 0,
  };
  switch (lens) {
    case "live":
      return buildListHref(BASE, current, { ...clear, lens: "live", status: "active" });
    case "draft":
      return buildListHref(BASE, current, { ...clear, lens: "draft", status: "draft" });
    case "ending":
      return buildListHref(BASE, current, {
        ...clear,
        lens: "ending",
        status: "active",
        sort: "endingAsc",
      });
    case "attention":
      return buildListHref(BASE, current, {
        ...clear,
        lens: "attention",
        status: "draft",
        needsPhotos: "1",
        withdrawal: "",
      });
    default:
      return buildListHref(BASE, current, clear);
  }
}

export function lotActiveLensId(sp: Record<string, string | string[] | undefined>): LotLensId {
  const lens = String(Array.isArray(sp.lens) ? sp.lens[0] : (sp.lens ?? ""));
  if (lens === "live" || lens === "draft" || lens === "ending" || lens === "attention") {
    return lens;
  }
  const withdrawal = String(
    Array.isArray(sp.withdrawal) ? sp.withdrawal[0] : (sp.withdrawal ?? ""),
  );
  if (withdrawal === "pending") return "attention";
  if (String(sp.needsPhotos ?? "") === "1") return "attention";
  const status = String(Array.isArray(sp.status) ? sp.status[0] : (sp.status ?? ""));
  if (status === "active") return "live";
  if (status === "draft") return "draft";
  if (status === "ended") return "all";
  return "all";
}

export function lotLensItems(
  sp: Record<string, string | string[] | undefined>,
  badges?: { attention?: number },
) {
  return [
    { id: "all", label: "All", href: lotLensHref("all", sp) },
    { id: "live", label: "Live", href: lotLensHref("live", sp) },
    { id: "draft", label: "Draft", href: lotLensHref("draft", sp) },
    { id: "ending", label: "Ending soon", href: lotLensHref("ending", sp) },
    {
      id: "attention",
      label: "Needs attention",
      href: lotLensHref("attention", sp),
      ...(badges?.attention != null && badges.attention > 0 ? { badge: badges.attention } : {}),
    },
  ] as const;
}
