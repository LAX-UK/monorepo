import type { CatalogLot } from "./catalog-lot.js";
import { API_BASE, WEB_ORIGIN } from "./config.js";

type ApiLotEstimate = {
  low: string;
  high: string;
  currency: string;
};

type ApiLot = {
  id: string;
  saleId: string;
  title: string;
  images: string[];
  startingPrice: string;
  marketingDetails?: {
    estimate?: ApiLotEstimate;
  };
};

type ApiSaleListRow = {
  sale: { id: string; title: string };
};

type ApiSaleLotsPage = {
  items: ApiLot[];
};

export const MODEL_T_TITLE = "1926/27 Ford Model T Touring Car";

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function lotHref(lot: Pick<ApiLot, "id" | "title">): string {
  return `${WEB_ORIGIN}/lot/${slugifyTitle(lot.title)}/${lot.id}`;
}

export function formatGbp(amount: string, opts?: { decimals?: number }): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: opts?.decimals ?? 0,
    maximumFractionDigits: opts?.decimals ?? 0,
  }).format(value);
}

function formatEstimate(lot: ApiLot): string {
  const estimate = lot.marketingDetails?.estimate;
  if (estimate) {
    return `${formatGbp(estimate.low)} – ${formatGbp(estimate.high)}`;
  }
  return "On request";
}

function formatOpeningBid(startingPrice: string): string {
  const value = Number(startingPrice);
  if (!Number.isFinite(value)) return startingPrice;
  if (value <= 1) return "£1";
  return formatGbp(startingPrice);
}

function isModelTLot(lot: ApiLot): boolean {
  return lot.title.trim().toLowerCase() === MODEL_T_TITLE.toLowerCase();
}

function mapApiLot(lot: ApiLot, saleTitle: string): CatalogLot {
  const image = lot.images[0];
  return {
    title: lot.title,
    category: saleTitle,
    estimate: formatEstimate(lot),
    openingBid: formatOpeningBid(lot.startingPrice),
    href: lotHref(lot),
    ...(image ? { image } : {}),
  };
}

async function fetchSaleLots(saleId: string): Promise<ApiLot[]> {
  const res = await fetch(`${API_BASE}/sales/${saleId}/lots?limit=48&offset=0&sort=lot`);
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: ApiSaleLotsPage };
  return body.data?.items ?? [];
}

export type OnsiteCatalog = {
  lots: CatalogLot[];
  modelTHref: string | null;
};

export async function fetchLinkedSaleCatalog(
  saleId: string,
  saleTitle: string,
): Promise<OnsiteCatalog> {
  const saleLots = await fetchSaleLots(saleId);
  const lots: CatalogLot[] = [];
  let modelTHref: string | null = null;

  for (const lot of saleLots) {
    if (isModelTLot(lot)) {
      modelTHref = lotHref(lot);
      continue;
    }
    lots.push(mapApiLot(lot, saleTitle));
  }

  return { lots, modelTHref };
}

export async function fetchOnsiteCatalog(): Promise<OnsiteCatalog> {
  const res = await fetch(
    `${API_BASE}/sales?deliveryMode=onsite&statuses=scheduled,active&limit=20&offset=0`,
  );
  if (!res.ok) {
    throw new Error(`catalog_failed_${res.status}`);
  }

  const body = (await res.json()) as { data?: ApiSaleListRow[] };
  const sales = body.data ?? [];
  const lots: CatalogLot[] = [];
  let modelTHref: string | null = null;

  for (const row of sales) {
    const saleLots = await fetchSaleLots(row.sale.id);
    for (const lot of saleLots) {
      if (isModelTLot(lot)) {
        modelTHref = lotHref(lot);
        continue;
      }
      lots.push(mapApiLot(lot, row.sale.title));
    }
  }

  return { lots, modelTHref };
}
