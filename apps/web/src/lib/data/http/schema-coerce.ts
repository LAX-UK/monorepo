import { z } from "zod";

/** Parses unknown API JSON into a typed row (use with `zTransformParse`, not `z.custom`). */
export type RowParser<T> = (value: unknown) => T;

/** Nullable row parser for list envelopes that filter null rows. */
export type NullableRowParser<T> = (value: unknown) => T | null;

/** Use instead of `z.custom(parseFn)` — custom only validates; transform applies the parser output. */
export function zTransformParse<T>(parse: RowParser<T>): z.ZodType<T> {
  return z.unknown().transform(parse) as z.ZodType<T>;
}

/** Nullable variant for list envelopes that filter null rows. */
export function zTransformParseNullable<T>(parse: NullableRowParser<T>): z.ZodType<T | null> {
  return z.unknown().transform(parse) as z.ZodType<T | null>;
}

/** Mirrors `coerceToDate` in parse/coerce.ts — never throws on bad input. */
export const zCoerceDate = z.preprocess(
  (value) => {
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") return new Date(value);
    return new Date(Number.NaN);
  },
  z.custom<Date>((value) => value instanceof Date),
);

/** `null` / `""` / missing → `null`; otherwise `String(value)`. */
export const zNullableStringFromEmpty = z.preprocess((value) => {
  if (value == null || value === "") return null;
  return String(value);
}, z.string().nullable());

/** `null` / `""` / missing → `undefined`; otherwise `String(value)`. */
export const zOptionalStringFromEmpty = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  return String(value);
}, z.string().optional());

/** Non-array → `[]`; array entries coerced with `String`. */
export const zStringArrayFromUnknown = z.preprocess((value) => {
  return Array.isArray(value) ? value.map(String) : [];
}, z.array(z.string()));
