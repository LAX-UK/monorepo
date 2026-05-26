import {
  type CatalogReadinessItem,
  type CatalogReadinessResult,
  buildLotPublishReadiness,
  buildSalePublishReadiness,
} from "@/lib/admin/catalog-readiness";
import type { Lot, Sale } from "@auction/types";
import { readinessLabel } from "./field-copy";
import type { SaleSetupStepId } from "./steps";

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

export type SetupStepHrefFn = (step: "schedule" | "lots" | "catalog-prep" | "review") => string;

export type BuildSaleSetupReadinessInput = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  connectRequiredByLotId?: ReadonlyMap<string, boolean>;
  /** When set, readiness links point to wizard step instead of detail tabs. */
  setupStepHref?: SetupStepHrefFn;
};

export type SaleSetupGateInput = {
  sale: Sale | null;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  connectRequiredByLotId?: ReadonlyMap<string, boolean>;
};

export function isSaleSetupPublishReady(
  input: Omit<BuildSaleSetupReadinessInput, "setupStepHref">,
): boolean {
  return buildSaleSetupReadiness(input).percent === 100;
}

/** First wizard step staff should fix before publish (resume / deep-link routing). */
export function resolveFirstBlockingSetupStep(input: SaleSetupGateInput): SaleSetupStepId {
  if (!input.sale) return "identity";
  if (input.sale.status !== "draft") return "review";

  const saleId = input.sale.id;
  if (!input.sale.title?.trim()) return "identity";

  const saleReadiness = buildSalePublishReadiness(
    saleId,
    input.sale,
    input.lots.length,
    input.pendingRegistrationCount ?? null,
  );
  if (!saleReadiness.items.find((i) => i.id === "schedule")?.ok) return "schedule";
  if (input.sale.startTime.getTime() <= Date.now()) return "schedule";

  const venueItem = saleReadiness.items.find((i) => i.id === "venue");
  if (input.sale.deliveryMode === "onsite" && venueItem && !venueItem.ok) return "schedule";

  if (input.lots.length === 0) return "lots";

  for (const lot of input.lots) {
    const connectRequired = input.connectRequiredByLotId?.get(lot.id) ?? false;
    const lotReady = buildLotPublishReadiness(lot.id, lot, connectRequired);
    if (lotReady.percent < 100) return "catalog-prep";
  }

  return "review";
}

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
  const items: CatalogReadinessItem[] = saleBase.items
    .filter((item) => !(item.id === "venue" && sale.deliveryMode === "online"))
    .map((item) => {
      const relabeled = relabelItem(item);
      if (!setupStepHref) return relabeled;
      if (item.id === "lots") return { ...relabeled, href: setupStepHref("lots") };
      if (item.id === "venue" || item.id === "schedule") {
        return { ...relabeled, href: setupStepHref("schedule") };
      }
      return relabeled;
    });

  if (sale.status === "draft" && sale.startTime.getTime() <= Date.now()) {
    items.push({
      id: "sale_start_future",
      label: readinessLabel("sale_start_future"),
      ok: false,
      severity: "required",
      href: setupStepHref?.("schedule") ?? `/admin/sales/${saleId}/edit`,
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
