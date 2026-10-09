import { randomUUID } from "node:crypto";
import { SHOP_ADMIN_CSRF_COOKIE, SHOP_ADMIN_SESSION_COOKIE } from "@/lib/session-cookie";
import { isIdentityRejected } from "@auction/identity-rp";
import { cookies, headers } from "next/headers";
import { getShopAdminContainer } from "../container";
import { type AdminMutationResult, mapAdminMutationErrorBody } from "./admin-mutation-result";

async function resolveMutationOrigin(): Promise<string | null> {
  const headerStore = await headers();
  return headerStore.get("origin")?.trim() ?? null;
}

export type ForwardAdminMutationInput = {
  bffPath: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: ArrayBuffer;
  idempotencyKey?: string;
  forwardHeaders?: Record<string, string>;
};

async function readJsonBody(body: ArrayBuffer): Promise<unknown> {
  const text = new TextDecoder().decode(body);
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function forwardAdminMutation<T = unknown>(
  input: ForwardAdminMutationInput,
): Promise<AdminMutationResult<T>> {
  const container = getShopAdminContainer();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SHOP_ADMIN_SESSION_COOKIE)?.value ?? null;
  const csrfCookie = cookieStore.get(SHOP_ADMIN_CSRF_COOKIE)?.value ?? null;
  if (!sessionId || !csrfCookie) {
    return { ok: false, kind: "unauthorized" };
  }

  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();
  const forwardHeaders: Record<string, string> = {
    accept: "application/json",
    "idempotency-key": idempotencyKey,
    ...input.forwardHeaders,
  };

  try {
    const headerStore = await headers();
    const origin = await resolveMutationOrigin();
    const csrfHeader = headerStore.get("x-csrf-token")?.trim() ?? null;
    const fromServerAction = Boolean(headerStore.get("next-action"));
    const result = await container.forwardAdminRequest({
      config: container.config,
      sessions: container.sessions,
      adminApi: container.adminApi,
      clock: container.clock,
      sessionId,
      bffPath: input.bffPath.startsWith("/api/admin/")
        ? input.bffPath
        : `/api/admin/${input.bffPath.replace(/^\//, "")}`,
      method: input.method,
      origin,
      csrfHeader,
      csrfCookie,
      fromServerAction,
      body: input.body,
      forwardHeaders,
    });

    if (result.status >= 200 && result.status < 300) {
      if (result.status === 204 || result.body.byteLength === 0) {
        return { ok: true, data: undefined as T };
      }
      const json = await readJsonBody(result.body);
      return { ok: true, data: json as T };
    }

    const json = await readJsonBody(result.body);
    if (result.status === 403 && !readErrorCode(json)) {
      return { ok: false, kind: "csrf" };
    }
    return mapAdminMutationErrorBody(result.status, json, "Admin action failed.");
  } catch (error) {
    if (isIdentityRejected(error)) {
      return {
        ok: false,
        kind: "step_up_required",
        message: "Sign in again with step-up to continue.",
      };
    }
    const message = error instanceof Error ? error.message : "Admin action failed.";
    if (message.includes("CSRF") || message.includes("Cross-origin")) {
      return { ok: false, kind: "csrf" };
    }
    if (message === "Unauthorized") {
      return { ok: false, kind: "unauthorized" };
    }
    return { ok: false, kind: "failed", message };
  }
}

function readErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as { code?: string };
  return typeof record.code === "string" ? record.code : undefined;
}

export async function forwardAdminJsonMutation<T = unknown>(input: {
  bffPath: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  jsonBody?: unknown;
  idempotencyKey?: string;
}): Promise<AdminMutationResult<T>> {
  const base = {
    bffPath: input.bffPath,
    method: input.method,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  };
  if (input.jsonBody === undefined) {
    return forwardAdminMutation(base);
  }
  return forwardAdminMutation({
    ...base,
    body: new TextEncoder().encode(JSON.stringify(input.jsonBody)).buffer,
    forwardHeaders: { "content-type": "application/json" },
  });
}
