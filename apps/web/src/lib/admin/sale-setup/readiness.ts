import {
  type CatalogReadinessItem,
  type CatalogReadinessResult,
  buildLotPublishReadiness,
  buildSalePublishReadiness,
} from "@/lib/admin/catalog-readiness";
import type { Lot, Sale } from "@auction/types";
import { readinessLabel } from "./field-copy";

function pct(complete: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((complete / total) * 100);
}

function relabelItem(
  item: CatalogReadinessItem,
  context?: { lotTitle?: string },
): CatalogReadinessItem {
  return {
    ...item,
    label: readinessLabel(item.id, context),
  };
}

export type BuildSaleSetupReadinessInput = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  connectRequiredByLotId?: ReadonlyMap<string, boolean>;
  /** When set, readiness links point to wizard step instead of detail tabs. */
  setupStepHref?: (step: "lots" | "catalog-prep" | "review") => string;
};

export function buildSaleSetupReadiness(
  input: BuildSaleSetupReadinessInput,
): CatalogReadinessResult {
  const {
    saleId,
    sale,
    lots,
    pendingRegistrationCount = null,
    connectRequiredByLotId,
    setupStepHref,
  } = input;

  const saleBase = buildSalePublishReadiness(saleId, sale, lots.length, pendingRegistrationCount);
  const items: CatalogReadinessItem[] = saleBase.items.map((item) => {
    const relabeled = relabelItem(item);
    if (!setupStepHref) return relabeled;
    if (item.id === "lots") return { ...relabeled, href: setupStepHref("lots") };
    if (item.id === "venue" || item.id === "schedule") {
      return { ...relabeled, href: setupStepHref("review") };
    }
    return relabeled;
  });

  if (sale.status === "draft" && sale.startTime.getTime() <= Date.now()) {
    items.push({
      id: "sale_start_future",
      label: readinessLabel("sale_start_future"),
      ok: false,
      severity: "required",
      href: setupStepHref?.("review") ?? `/admin/sales/${saleId}/edit`,
    });
  }

  for (const lot of lots) {
    const connectRequired = connectRequiredByLotId?.get(lot.id) ?? false;
    const lotReady = buildLotPublishReadiness(lot.id, lot, connectRequired);
    const lotTitle = lot.title.trim() || "Untitled lot";
    for (const lotItem of lotReady.items) {
      if (lotItem.ok) continue;
      if (lotItem.id === "sale") continue;
      items.push({
        id: `lot:${lot.id}:${lotItem.id}`,
        label: readinessLabel(lotItem.id, { lotTitle }),
        ok: false,
        severity: lotItem.severity,
        href: setupStepHref?.("catalog-prep") ?? lotItem.href ?? `/admin/lots/${lot.id}`,
      });
    }
  }

  const completeCount = items.filter((i) => i.ok).length;
  const firstFailing = items.find((i) => !i.ok);

  return {
    items,
    completeCount,
    totalCount: items.length,
    percent: pct(completeCount, items.length),
    ...(firstFailing ? { firstFailing } : {}),
  };
}

export function countLotsCatalogReady(
  lots: Lot[],
  connectRequiredByLotId?: ReadonlyMap<string, boolean>,
): { ready: number; total: number } {
  if (lots.length === 0) return { ready: 0, total: 0 };
  let ready = 0;
  for (const lot of lots) {
    const connectRequired = connectRequiredByLotId?.get(lot.id) ?? false;
    const r = buildLotPublishReadiness(lot.id, lot, connectRequired);
    if (r.percent === 100) ready++;
  }
  return { ready, total: lots.length };
}
