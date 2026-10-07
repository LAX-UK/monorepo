import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";

export type AdminMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "unauthorized" }
  | { ok: false; kind: "forbidden" }
  | { ok: false; kind: "csrf" }
  | { ok: false; kind: "step_up_required"; message: string }
  | { ok: false; kind: "conflict"; message: string }
  | { ok: false; kind: "validation"; message: string }
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
    return {
      ok: false,
      kind: "conflict",
      message: readErrorMessage(body) ?? "This action conflicts with current state.",
    };
  }
  if (status === 400) {
    return {
      ok: false,
      kind: "validation",
      message: readErrorMessage(body) ?? fallbackMessage,
    };
  }
  return { ok: false, kind: "failed", message: readErrorMessage(body) ?? fallbackMessage };
}

function readErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as { code?: string };
  return typeof record.code === "string" ? record.code : undefined;
}

function readErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as { message?: string };
  const message = record.message?.trim();
  return message?.length ? message : undefined;
}
