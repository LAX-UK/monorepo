import { z } from "zod";

/** Mirrors `toDate` in parse.ts — never throws on bad input. */
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
