import { venueOneLiner } from "@/components/admin/sale-detail/sale-detail-helpers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { adminSaleListPath } from "@/lib/admin/catalog-routes";
import type { Sale } from "@auction/types";

export type SaleLensId = "all" | "upcoming" | "live" | "closed" | "settled" | "setup";

const BASE = adminSaleListPath();

export function saleNeedsSetup(sale: Sale, lotCount: number): boolean {
  if (sale.status !== "draft") return false;
  if (lotCount === 0) return true;
  if (!sale.startTime || !sale.endTime) return true;
  if (sale.deliveryMode === "onsite" && !venueOneLiner(sale)) return true;
  return false;
}

export function saleLensHref(
  lens: SaleLensId,
  current: Record<string, string | string[] | undefined>,
): string {
  const clear = {
    lens: "",
    lifecycle: "",
    status: "",
    offset: 0,
  };
  switch (lens) {
    case "upcoming":
      return buildListHref(BASE, current, { ...clear, lens: "upcoming", lifecycle: "upcoming" });
    case "live":
      return buildListHref(BASE, current, { ...clear, lens: "live", lifecycle: "live" });
    case "closed":
      return buildListHref(BASE, current, { ...clear, lens: "closed", lifecycle: "closed" });
    case "settled":
      return buildListHref(BASE, current, { ...clear, lens: "settled", lifecycle: "settled" });
    case "setup":
      return buildListHref(BASE, current, {
        ...clear,
        lens: "setup",
        lifecycle: "",
        status: "draft",
      });
    default:
      return buildListHref(BASE, current, clear);
  }
}

export function saleActiveLensId(sp: Record<string, string | string[] | undefined>): SaleLensId {
  const lens = String(Array.isArray(sp.lens) ? sp.lens[0] : (sp.lens ?? ""));
  if (
    lens === "upcoming" ||
    lens === "live" ||
    lens === "closed" ||
    lens === "settled" ||
    lens === "setup"
  ) {
    return lens;
  }
  const lifeRaw = String(Array.isArray(sp.lifecycle) ? sp.lifecycle[0] : (sp.lifecycle ?? ""));
  const lifecycle = lifeRaw.trim().toLowerCase();
  if (lifecycle === "upcoming") return "upcoming";
  if (lifecycle === "live") return "live";
  if (lifecycle === "closed") return "closed";
  if (lifecycle === "settled") return "settled";
  return "all";
}

export function saleLensItems(sp: Record<string, string | string[] | undefined>) {
  return [
    { id: "all", label: "All", href: saleLensHref("all", sp) },
    { id: "upcoming", label: "Upcoming", href: saleLensHref("upcoming", sp) },
    { id: "live", label: "Live", href: saleLensHref("live", sp) },
    { id: "closed", label: "Closed", href: saleLensHref("closed", sp) },
    { id: "settled", label: "Settled", href: saleLensHref("settled", sp) },
    { id: "setup", label: "Needs setup", href: saleLensHref("setup", sp) },
  ] as const;
}
