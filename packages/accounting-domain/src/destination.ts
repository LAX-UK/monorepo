import { PRODUCTS, type Product } from "./document.js";
import { type Result, ok, refuse } from "./result.js";
import type { TargetMode } from "./source-switch.js";

/**
 * Where a provider adapter would send a product's documents. `none` is a rehearsal: it holds no
 * client and reaches no organisation at all. `unconfigured` means it cannot say (no organisation
 * set up for the product's legal entity); the reason is the adapter's own code.
 */
export type Destination =
  | { readonly kind: "none" }
  | { readonly kind: "organisation"; readonly organisationId: string }
  | { readonly kind: "unconfigured"; readonly reason: string };

/** Asked before any call is made for a document, so the caller can check where it would land. */
export interface DestinationPort {
  destinationFor(product: Product): Destination;
}

/** The modes that send to a provider organisation. `dry_run` never does. */
export const WRITING_MODES = ["test_org", "live"] as const;
export type WritingMode = (typeof WRITING_MODES)[number];

/**
 * The one provider organisation each writing mode may send each product's documents to. It is
 * configured on its own, apart from the adapter's settings, so a mode is bound to an organisation
 * id rather than to a label: a `test_org` document can only ever reach the organisation named
 * here for `test_org`. A product missing for a mode has nowhere to go in that mode.
 */
export type DestinationBinding = Readonly<
  Partial<Record<WritingMode, Readonly<Partial<Record<Product, string>>>>>
>;

export type DestinationCode =
  | "rehearsal_reaches_organisation"
  | "destination_not_bound"
  | "destination_unresolved"
  | "destination_mismatch";

/**
 * May a document for `product`, aimed at `mode`, go where the adapter says it would? A rehearsal
 * must reach no organisation at all. A writing mode must resolve to exactly the organisation bound
 * for that mode and product; anything else (nothing bound, an adapter that cannot say, a rehearsal
 * adapter, another organisation) is refused before any call is made.
 */
export function checkDestination(
  mode: TargetMode,
  product: Product,
  destination: Destination,
  binding: DestinationBinding,
): Result<null, DestinationCode> {
  if (mode === "dry_run") {
    return destination.kind === "none"
      ? ok(null)
      : refuse(
          "rehearsal_reaches_organisation",
          `${product} in dry_run: the adapter would reach a provider organisation`,
        );
  }
  const bound = binding[mode]?.[product];
  if (bound === undefined) {
    return refuse("destination_not_bound", `${product} in ${mode}: no organisation is bound`);
  }
  if (destination.kind === "unconfigured") {
    return refuse("destination_unresolved", `${product} in ${mode}: ${destination.reason}`);
  }
  if (destination.kind === "none") {
    return refuse("destination_unresolved", `${product} in ${mode}: the adapter reaches nothing`);
  }
  if (destination.organisationId !== bound) {
    return refuse(
      "destination_mismatch",
      `${product} in ${mode}: the adapter would send to organisation ${destination.organisationId}, bound is ${bound}`,
    );
  }
  return ok(null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read a binding of unknown shape (JSON from the environment). Only writing modes and known
 * products are accepted, every id is a non-empty string, and no organisation may be bound to both
 * `test_org` and `live`: the real books can never be named as a rehearsal target. Nothing is
 * bound when the input is absent.
 */
export function parseDestinationBinding(input: unknown): Result<DestinationBinding, "bad_binding"> {
  const bad = (why: string) => refuse("bad_binding", why);
  if (input === undefined) return ok({});
  if (!isRecord(input)) return bad("the binding is not an object");
  const out: Partial<Record<WritingMode, Partial<Record<Product, string>>>> = {};
  for (const [mode, products] of Object.entries(input)) {
    if (!(WRITING_MODES as readonly string[]).includes(mode)) {
      return bad(`${mode} is not a mode that sends to an organisation`);
    }
    if (!isRecord(products)) return bad(`${mode}: not an object`);
    const ids: Partial<Record<Product, string>> = {};
    for (const [product, id] of Object.entries(products)) {
      if (!(PRODUCTS as readonly string[]).includes(product)) {
        return bad(`${mode}: unknown product ${product}`);
      }
      if (typeof id !== "string" || id.trim() === "" || id.trim() !== id) {
        return bad(`${mode}.${product}: not an organisation id`);
      }
      ids[product as Product] = id;
    }
    out[mode as WritingMode] = ids;
  }
  const rehearsal = new Set(Object.values(out.test_org ?? {}));
  if (Object.values(out.live ?? {}).some((id) => rehearsal.has(id))) {
    return bad("an organisation is bound to both test_org and live");
  }
  return ok(out);
}
