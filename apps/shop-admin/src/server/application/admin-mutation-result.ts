import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";

export type AdminMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "unauthorized" }
  | { ok: false; kind: "forbidden" }
  | { ok: false; kind: "csrf" }
  | { ok: false; kind: "step_up_required"; message: string }
  | { ok: false; kind: "conflict"; message: string; currentVersion?: string }
  /** `issues` lists the rows at fault when the API names them (Featured on home). */
  | { ok: false; kind: "validation"; message: string; issues?: unknown[] }
  /** 422: the request named records that do not exist, so nothing was written. */
  | { ok: false; kind: "unknown_ids"; message: string; missingIds: string[] }
  | { ok: false; kind: "failed"; message: string };

export function mapAdminMutationErrorBody(
  status: number,
  body: unknown,
  fallbackMessage: string,
): Exclude<AdminMutationResult<unknown>, { ok: true }> {
  if (status === 401) return { ok: false, kind: "unauthorized" };
  if (status === 403) {
    const code = readErrorCode(body);
    if (code === SHOP_API_ERROR_CODES.STEP_UP_REQUIRED) {
      return {
        ok: false,
        kind: "step_up_required",
        message: readErrorMessage(body) ?? "Sign in again with step-up to continue.",
      };
    }
    return { ok: false, kind: "forbidden" };
  }
  if (status === 409) {
    const currentVersion = readErrorField(body, "currentVersion");
    return {
      ok: false,
      kind: "conflict",
      message: readErrorMessage(body) ?? "This action conflicts with current state.",
      ...(currentVersion ? { currentVersion } : {}),
    };
  }
  if (status === 422) {
    const missingIds = readStringArray(body, "missingIds");
    if (missingIds.length > 0) {
      return {
        ok: false,
        kind: "unknown_ids",
        message: readErrorMessage(body) ?? fallbackMessage,
        missingIds,
      };
    }
  }
  if (status === 400) {
    const issues = readArray(body, "issues");
    return {
      ok: false,
      kind: "validation",
      message: readErrorMessage(body) ?? fallbackMessage,
      ...(issues ? { issues } : {}),
    };
  }
  return { ok: false, kind: "failed", message: readErrorMessage(body) ?? fallbackMessage };
}

export function readErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as { code?: string };
  return typeof record.code === "string" ? record.code : undefined;
}

/** A string field some error bodies carry beyond `code` and `message`, such as `currentVersion`. */
function readErrorField(body: unknown, field: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(body: unknown, field: string): string[] {
  if (!body || typeof body !== "object") return [];
  const value = (body as Record<string, unknown>)[field];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readArray(body: unknown, field: string): unknown[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[field];
  return Array.isArray(value) ? value : undefined;
}

function readErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as { message?: string };
  const message = record.message?.trim();
  return message?.length ? message : undefined;
}
