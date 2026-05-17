export function readApiError(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

/** Reads structured `missing_capability` metadata from API 403 bodies. */
export function readApiMissingCapabilityMeta(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  if (b.code !== "missing_capability") return undefined;
  return {
    code: b.code,
    required: b.required,
    actor: b.actor,
  };
}

/** Reads `{ code: string }` from JSON error bodies (e.g. lot publish `connect_required`). */
export function readApiErrorCode(body: unknown): string | undefined {
  if (
    body &&
    typeof body === "object" &&
    "code" in body &&
    typeof (body as { code: unknown }).code === "string"
  ) {
    return (body as { code: string }).code;
  }
  return undefined;
}

export type JsonFetchOpts = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  okRedirect: string;
  errRedirect: string;
  revalidatePaths?: string[];
};
