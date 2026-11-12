import type { Product } from "./document.js";
import { type Result, ok, refuse } from "./result.js";

export const SOURCES = ["xero", "books"] as const;
export type Source = (typeof SOURCES)[number];
/** "none" is the state where no provider is live for the product. */
export type LiveSource = Source | "none";

/** off: untouched. dry_run: build and log, send nothing. test_org: send to the provider's test organisation. live: real books. */
export const MODES = ["off", "dry_run", "test_org", "live"] as const;
export type Mode = (typeof MODES)[number];

export type ProductSwitch = Readonly<Record<Source, Mode>>;
export type SwitchConfig = Readonly<Record<Product, ProductSwitch>>;

export type SwitchCode = "two_live_sources" | "bad_mode";

/** The one live source for a product, or "none". Throws if two are live: validate first. */
export function liveSourceOf(product: ProductSwitch): LiveSource {
  const live = SOURCES.filter((s) => product[s] === "live");
  if (live.length > 1) throw new Error("two live sources");
  return live[0] ?? "none";
}

/** Refuse a configuration that has two live invoice sources for the same product. */
export function validateProductSwitch(
  product: Product,
  config: ProductSwitch,
): Result<LiveSource, SwitchCode> {
  for (const source of SOURCES) {
    if (!MODES.includes(config[source])) {
      return refuse("bad_mode", `${product}: unknown mode for ${source}`);
    }
  }
  const live = SOURCES.filter((s) => config[s] === "live");
  if (live.length > 1) {
    return refuse("two_live_sources", `${product}: ${live.join(" and ")} are both live`);
  }
  return ok(live[0] ?? "none");
}

/** Validate every product; the first refusal wins. */
export function validateSwitchConfig(
  config: SwitchConfig,
  products: readonly Product[],
): Result<Readonly<Record<Product, LiveSource>>, SwitchCode> {
  const live: Partial<Record<Product, LiveSource>> = {};
  for (const product of products) {
    const result = validateProductSwitch(product, config[product]);
    if (!result.ok) return { ok: false, refusal: result.refusal };
    live[product] = result.value;
  }
  return ok(live as Record<Product, LiveSource>);
}

/** Should a document for this product go to this source for real (not dry-run, not test org)? */
export function sendsForReal(product: ProductSwitch, source: Source): boolean {
  return product[source] === "live";
}
