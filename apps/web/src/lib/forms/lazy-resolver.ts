import type { FieldErrors, FieldValues, Resolver, ResolverResult } from "react-hook-form";

/** A form resolver whose schema and validation library arrive on first use. */
export type LazyResolver<TFieldValues extends FieldValues> = Resolver<TFieldValues> & {
  /** Start fetching the validation early, for example when a field first takes focus. */
  preload: () => void;
};

/**
 * Where a failed load is reported in the form's errors. Not `root`: react-hook-form drops
 * `errors.root` before it decides whether a submit is valid, so a root error would let the submit
 * through with empty values. Any other key keeps the submit from running and resets the button.
 */
export const LAZY_RESOLVER_ERROR = "lazyResolver" as const;

export type LazyResolverOptions = {
  /** What the form shows when its check cannot be fetched: the form's own submit-failure copy. */
  failureMessage: string;
};

/**
 * Wraps a resolver that lives in its own chunk (`() => import("./x.validation").then(...)`), so a
 * public page does not ship Zod in its first scripts. The chunk is fetched on the first check, or
 * earlier through `preload`.
 *
 * A failed fetch never leaves the form stuck: the check resolves as invalid with
 * `failureMessage` under `LAZY_RESOLVER_ERROR` (read it with `lazyResolverFailure`), so the submit
 * ends, the button resets and the form can show its notice. The failure is not remembered: the next
 * check (the next submit) fetches the chunk again.
 */
export function lazyResolver<TFieldValues extends FieldValues>(
  load: () => Promise<Resolver<TFieldValues>>,
  { failureMessage }: LazyResolverOptions,
): LazyResolver<TFieldValues> {
  let pending: Promise<Resolver<TFieldValues>> | null = null;
  const resolve = () => {
    pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
  const resolver = (async (values, context, options) => {
    let check: Resolver<TFieldValues>;
    try {
      check = await resolve();
    } catch {
      return {
        values: {},
        errors: { [LAZY_RESOLVER_ERROR]: { type: "load", message: failureMessage } },
      } as unknown as ResolverResult<TFieldValues>;
    }
    return check(values, context, options);
  }) as LazyResolver<TFieldValues>;
  resolver.preload = () => {
    resolve().catch(() => {
      // A failed preload is retried by the first check.
    });
  };
  return resolver;
}

/** The message a `lazyResolver` left when its check could not be fetched, or null. */
export function lazyResolverFailure<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
): string | null {
  const error = (errors as Record<string, { message?: unknown } | undefined>)[LAZY_RESOLVER_ERROR];
  return typeof error?.message === "string" ? error.message : null;
}
