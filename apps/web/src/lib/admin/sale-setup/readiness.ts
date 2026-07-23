import {
  type CatalogReadinessItem,
  type CatalogReadinessResult,
  buildLotPublishReadiness,
  buildSalePublishReadiness,
  lotFitsSaleWindowForPublish,
} from "@/lib/admin/catalog-readiness";
import {
  type ConnectRequiredByLotId,
  lotConnectRequired,
} from "@/lib/admin/connect-readiness-shared";
import type { Lot, Sale } from "@auction/types";
import { isStartInFutureForPublish } from "@auction/validators";
import { readinessLabel } from "./field-copy";
import type { SaleSetupStepId } from "./sale-setup-step-ids";

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
  connectRequiredByLotId?: ConnectRequiredByLotId;
  /** When set, readiness links point to wizard step instead of detail tabs. */
  setupStepHref?: SetupStepHrefFn;
};

export type SaleSetupGateInput = {
  sale: Sale | null;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  connectRequiredByLotId?: ConnectRequiredByLotId;
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
  if (!isStartInFutureForPublish(input.sale.startTime)) return "schedule";

  const venueItem = saleReadiness.items.find((i) => i.id === "venue");
  if (input.sale.deliveryMode === "onsite" && venueItem && !venueItem.ok) return "schedule";

  if (input.lots.length === 0) return "lots";

  for (const lot of input.lots) {
    if (!lotFitsSaleWindowForPublish(lot, input.sale)) {
      return "lots";
    }
  }

  for (const lot of input.lots) {
    const connectRequired = lotConnectRequired(input.connectRequiredByLotId, lot.id);
    const lotReady = buildLotPublishReadiness(lot.id, lot, {
      connectRequired,
      sale: input.sale,
    });
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
      if (item.id === "venue" || item.id === "schedule" || item.id === "sale_start_future") {
        return { ...relabeled, href: setupStepHref("schedule") };
      }
      return relabeled;
    });

  for (const lot of lots) {
    if (!lotFitsSaleWindowForPublish(lot, sale)) {
      const lotTitle = lot.title.trim() || "Untitled lot";
      items.push({
        id: `lot:${lot.id}:sale_window`,
        label: `${lotTitle}: ${readinessLabel("sale_window")}`,
        ok: false,
        severity: "required",
        href: setupStepHref?.("lots") ?? `/admin/lots/${lot.id}/edit`,
      });
    }

    const connectRequired = lotConnectRequired(connectRequiredByLotId, lot.id);
    const lotReady = buildLotPublishReadiness(lot.id, lot, {
      connectRequired,
      sale,
    });
    const lotTitle = lot.title.trim() || "Untitled lot";
    for (const lotItem of lotReady.items) {
      if (lotItem.ok) continue;
      if (lotItem.id === "sale") continue;
      items.push({
        id: `lot:${lot.id}:${lotItem.id}`,
        label: lotItem.id === "seller" ? lotItem.label : readinessLabel(lotItem.id, { lotTitle }),
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
  connectRequiredByLotId?: ConnectRequiredByLotId,
  sale?: Pick<Sale, "id" | "deliveryMode" | "startTime" | "endTime"> | null,
): { ready: number; total: number } {
  if (lots.length === 0) return { ready: 0, total: 0 };
  let ready = 0;
  for (const lot of lots) {
    const connectRequired = lotConnectRequired(connectRequiredByLotId, lot.id);
    const r = buildLotPublishReadiness(lot.id, lot, {
      connectRequired,
      ...(sale ? { sale } : {}),
    });
    if (r.percent === 100) ready++;
  }
  return { ready, total: lots.length };
}
