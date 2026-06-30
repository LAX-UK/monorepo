import { buildListHref } from "@/lib/admin/admin-list-params";

export type SearchParams = Record<string, string | string[] | undefined>;

export function omitParamsHref(
  basePath: string,
  sp: SearchParams,
  omit: readonly string[],
): string {
  const patch: Record<string, string | null> = { offset: "0" };
  for (const key of omit) {
    patch[key] = null;
  }
  return buildListHref(basePath, sp, patch);
}
