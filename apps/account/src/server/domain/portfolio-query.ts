import {
  type HoldingsFilter,
  LAX_BUSINESS_KEYS,
  LAX_PORTFOLIO_ITEM_STATUSES,
  LAX_PRODUCT_IDS,
  type LaxBusinessKey,
  type LaxPortfolioItemStatus,
  type LaxProductId,
  MONEY_SECTION_KEYS,
  type MoneyFilter,
  type MoneySectionKey,
} from "@auction/lax-ecosystem";

export type PortfolioSearchParams = Record<string, string | string[] | undefined>;

/** The first value of a repeated parameter; an empty value counts as absent. */
function single(params: PortfolioSearchParams, name: string): string | undefined {
  const raw = params[name];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value : undefined;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function currencyCode(value: string | undefined): string | undefined {
  return value && /^[A-Z]{3}$/.test(value) ? value : undefined;
}

/**
 * Reads the holdings filters from the URL. Anything unrecognised is ignored rather than
 * rejected, so a stale or hand-edited link still opens the list.
 */
export function parseHoldingsQuery(params: PortfolioSearchParams): HoldingsFilter {
  const status = oneOf<LaxPortfolioItemStatus>(
    single(params, "status"),
    LAX_PORTFOLIO_ITEM_STATUSES,
  );
  const product = oneOf<LaxProductId>(single(params, "product"), LAX_PRODUCT_IDS);
  const artist = single(params, "artist")?.slice(0, 200);
  const yearText = single(params, "year");
  const year = yearText && /^\d{4}$/.test(yearText) ? Number(yearText) : undefined;
  const currency = currencyCode(single(params, "currency"));
  const search = single(params, "q")?.slice(0, 100);
  return {
    ...(search ? { search } : {}),
    ...(status ? { statuses: [status] } : {}),
    ...(product ? { products: [product] } : {}),
    ...(artist ? { artist } : {}),
    ...(year !== undefined ? { year } : {}),
    ...(currency ? { currency } : {}),
  };
}

export function parseMoneyQuery(params: PortfolioSearchParams): MoneyFilter {
  const business = oneOf<LaxBusinessKey>(single(params, "business"), LAX_BUSINESS_KEYS);
  const section = oneOf<MoneySectionKey>(single(params, "section"), MONEY_SECTION_KEYS);
  const currency = currencyCode(single(params, "currency"));
  return {
    ...(business ? { business } : {}),
    ...(section ? { section } : {}),
    ...(currency ? { currency } : {}),
  };
}

/** True when any filter or search narrows the list. */
export function hasActiveFilter(filter: HoldingsFilter | MoneyFilter): boolean {
  return Object.keys(filter).length > 0;
}
