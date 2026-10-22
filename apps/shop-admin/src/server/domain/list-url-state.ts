export type RawSearchParams = Record<string, string | string[] | undefined>;

/** The first value of a query parameter, trimmed; blank counts as absent. */
export function singleParam(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

/** The value if it is one of `allowed`, so a hand-edited URL cannot smuggle in anything else. */
export function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

/** A calendar day as `YYYY-MM-DD`, or undefined for anything else. */
export function calendarDayParam(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/** `path` with the non-empty `params` as its query string. */
export function listHref(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
