import type { Result } from "neverthrow";

/** HTTP-facing catalog route outcomes (presentation applied in application layer). */
export type CatalogRouteOk<T> = { kind: "ok"; data: T; status?: number };
export type CatalogRouteNoContent = { kind: "no_content" };
export type CatalogRouteErr = { kind: "err"; error: Error };

export type CatalogRouteOutcome<T> = CatalogRouteOk<T> | CatalogRouteNoContent | CatalogRouteErr;

export function catalogRouteFromResult<T>(
  result: Result<T, Error>,
  status?: number,
): CatalogRouteOutcome<T> {
  if (result.isErr()) return { kind: "err", error: result.error };
  if (status !== undefined) return { kind: "ok", data: result.value, status };
  return { kind: "ok", data: result.value };
}

export function catalogRouteCatchLotError<T>(
  fn: () => Promise<T>,
): Promise<CatalogRouteOutcome<T> | { kind: "lot_error"; error: Error }> {
  return fn()
    .then((data): CatalogRouteOutcome<T> => ({ kind: "ok", data }))
    .catch((e: unknown) => {
      if (e instanceof Error) return { kind: "lot_error", error: e };
      throw e;
    });
}
