import { PRODUCTS, type Product } from "./document.js";
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

export type SwitchCode = "two_live_sources" | "bad_mode" | "missing_product";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Refuse a configuration that has two live invoice sources for the same product. */
export function validateProductSwitch(
  product: Product,
  config: unknown,
): Result<LiveSource, SwitchCode> {
  if (!isRecord(config)) return refuse("missing_product", `${product}: no switch configured`);
  for (const source of SOURCES) {
    if (!MODES.includes(config[source] as Mode)) {
      return refuse("bad_mode", `${product}: unknown mode for ${source}`);
    }
  }
  const live = SOURCES.filter((s) => config[s] === "live");
  if (live.length > 1) {
    return refuse("two_live_sources", `${product}: ${live.join(" and ")} are both live`);
  }
  return ok(live[0] ?? "none");
}

/**
 * Read a configuration of unknown shape. Every product in `PRODUCTS` must be present and valid,
 * so a product can never be skipped; a missing one is a refusal, never a throw. The first refusal wins.
 */
export function parseSwitchConfig(config: unknown): Result<SwitchConfig, SwitchCode> {
  const out: Partial<Record<Product, ProductSwitch>> = {};
  for (const product of PRODUCTS) {
    const entry = isRecord(config) ? config[product] : undefined;
    const result = validateProductSwitch(product, entry);
    if (!result.ok) return result;
    const e = entry as Record<Source, Mode>;
    out[product] = { xero: e.xero, books: e.books };
  }
  return ok(out as SwitchConfig);
}

/** Validate every product and give the one live source of each. */
export function validateSwitchConfig(
  config: unknown,
): Result<Readonly<Record<Product, LiveSource>>, SwitchCode> {
  const parsed = parseSwitchConfig(config);
  if (!parsed.ok) return parsed;
  const live: Partial<Record<Product, LiveSource>> = {};
  for (const product of PRODUCTS) {
    const result = validateProductSwitch(product, parsed.value[product]);
    if (!result.ok) return result;
    live[product] = result.value;
  }
  return ok(live as Record<Product, LiveSource>);
}

/** Should a document for this product go to this source for real (not dry-run, not test org)? */
export function sendsForReal(product: ProductSwitch, source: Source): boolean {
  return product[source] === "live";
}

/** The modes a document can be aimed at; `off` aims nothing. */
export type TargetMode = Exclude<Mode, "off">;

/**
 * The provider and mode a document was created for, fixed when it is created and never changed:
 * a later switch flip never re-aims an existing document, and no other provider or mode may take it.
 */
export interface DocumentTarget {
  readonly provider: Source;
  readonly mode: TargetMode;
}

/**
 * Where a new document for a product is aimed, from the switch as it stands at creation: the live
 * source if there is one, otherwise the only provider that is not `off`. With nothing to aim at
 * (both `off`) or no way to choose (both in rehearsal) the document has no target, and is never
 * handed to anyone. A live document is therefore never aimed at a rehearsal.
 */
export function documentTarget(product: ProductSwitch): DocumentTarget | null {
  const live = SOURCES.find((s) => product[s] === "live");
  if (live) return { provider: live, mode: "live" };
  const active = SOURCES.filter((s) => product[s] !== "off");
  const only = active.length === 1 ? active[0] : undefined;
  if (only === undefined) return null;
  return { provider: only, mode: product[only] as TargetMode };
}

/**
 * The mode in which Books takes a product's new documents, or null when the switch aims them
 * elsewhere (Xero live, both off, or both rehearsing). This is the one rule that says whether the
 * Books projector projects a product and whether the Books sender works for it, so the two never
 * disagree. With Xero `live`, Books takes nothing, whatever its own mode says: a Bid rehearsal
 * needs Xero away from `live` in the switch (see the README, "Rehearsing Books").
 */
export function booksTargetMode(product: ProductSwitch): TargetMode | null {
  const target = documentTarget(product);
  return target?.provider === "books" ? target.mode : null;
}

/**
 * May `provider` take a document aimed at `target`, given the product's switch now? Only the
 * provider and mode the document was created for, and only while that provider is still in that
 * mode: a Books claim in `test_org` can never take a document aimed at Xero live, and a flip of
 * the switch never moves a document to a different provider or mode.
 */
export function mayClaim(
  target: DocumentTarget | null,
  product: ProductSwitch,
  provider: Source,
): boolean {
  return target !== null && target.provider === provider && product[provider] === target.mode;
}
