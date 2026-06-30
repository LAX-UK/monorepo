import { parseAsInteger, parseAsString } from "nuqs";

/** Shared URL parsers for admin list pages (search + pagination). */
export const adminListNuqsBaseParsers = {
  q: parseAsString.withDefault(""),
  limit: parseAsInteger.withDefault(50),
  offset: parseAsInteger.withDefault(0),
} as const;

/** Shared nuqs options: full RSC navigation so server can re-seed Query cache. */
export const adminListNuqsOptions = {
  history: "push" as const,
  shallow: false as const,
  clearOnDefault: true as const,
};
