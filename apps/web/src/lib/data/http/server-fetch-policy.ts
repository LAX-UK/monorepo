import "server-only";

/** Opt-in server fetch cache policy for anonymous catalogue reads. */
export type ServerFetchPolicy =
  | { kind: "no-store" }
  | { kind: "revalidate"; seconds: number; tags?: string[] };

export const NO_STORE_FETCH_POLICY: ServerFetchPolicy = { kind: "no-store" };

export function revalidateFetchPolicy(seconds: number, tags?: string[]): ServerFetchPolicy {
  return tags?.length ? { kind: "revalidate", seconds, tags } : { kind: "revalidate", seconds };
}

export function fetchInitFromPolicy(
  policy: ServerFetchPolicy,
): Pick<RequestInit, "cache" | "next"> {
  if (policy.kind === "no-store") {
    return { cache: "no-store" };
  }
  return {
    next: {
      revalidate: policy.seconds,
      ...(policy.tags?.length ? { tags: policy.tags } : {}),
    },
  };
}

export function mergeFetchInitWithPolicy(
  policy: ServerFetchPolicy,
  init?: RequestInit,
): RequestInit {
  const fromPolicy = fetchInitFromPolicy(policy);
  if (!init) return fromPolicy;
  const { cache: _cache, next: _next, ...rest } = init;
  return { ...rest, ...fromPolicy };
}
