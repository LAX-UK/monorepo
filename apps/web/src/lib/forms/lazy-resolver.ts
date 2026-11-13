import type { FieldValues, Resolver } from "react-hook-form";

/** A form resolver whose schema and validation library arrive on first use. */
export type LazyResolver<TFieldValues extends FieldValues> = Resolver<TFieldValues> & {
  /** Start fetching the validation early, for example when a field first takes focus. */
  preload: () => void;
};

/**
 * Wraps a resolver that lives in its own chunk (`() => import("./x.validation").then(...)`), so a
 * public page does not ship Zod in its first scripts. The chunk is fetched on the first check, or
 * earlier through `preload`. A failed fetch is not remembered: the next check fetches it again, and
 * the submit that hit the failure rejects as it would on any resolver error.
 */
export function lazyResolver<TFieldValues extends FieldValues>(
  load: () => Promise<Resolver<TFieldValues>>,
): LazyResolver<TFieldValues> {
  let pending: Promise<Resolver<TFieldValues>> | null = null;
  const resolve = () => {
    pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
  const resolver = (async (values, context, options) =>
    (await resolve())(values, context, options)) as LazyResolver<TFieldValues>;
  resolver.preload = () => {
    resolve().catch(() => {
      // A failed preload is retried by the first check.
    });
  };
  return resolver;
}
