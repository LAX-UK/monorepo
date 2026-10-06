import { SHOP_ADMIN_SESSION_COOKIE } from "@/lib/session-cookie";
import { cookies } from "next/headers";
import { getShopAdminContainer } from "../container";

export type AdminFetchResult<T> =
  | { status: "ok"; data: T }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "failed" };

function encodeAdminResourcePath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function forwardAdminGet(path: string): Promise<{ status: number; body: ArrayBuffer }> {
  const container = getShopAdminContainer();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SHOP_ADMIN_SESSION_COOKIE)?.value ?? null;
  if (!sessionId) {
    return { status: 401, body: new ArrayBuffer(0) };
  }
  const bffPath = `/api/admin/${encodeAdminResourcePath(path.replace(/^\//, ""))}`;
  const result = await container.forwardAdminRequest({
    config: container.config,
    sessions: container.sessions,
    adminApi: container.adminApi,
    clock: container.clock,
    sessionId,
    bffPath,
    method: "GET",
    origin: null,
    csrfHeader: null,
    csrfCookie: null,
    body: undefined,
    forwardHeaders: { accept: "application/json" },
  });
  return { status: result.status, body: result.body };
}

export async function fetchAdminJson<T>(path: string): Promise<AdminFetchResult<T>> {
  try {
    const { status, body } = await forwardAdminGet(path);
    if (status === 401) return { status: "unauthorized" };
    if (status === 403) return { status: "forbidden" };
    if (status === 404) return { status: "not_found" };
    if (status < 200 || status >= 300) return { status: "failed" };
    const text = new TextDecoder().decode(body);
    if (!text.trim()) return { status: "failed" };
    return { status: "ok", data: JSON.parse(text) as T };
  } catch {
    return { status: "failed" };
  }
}

export type AdminSessionPayload = {
  subject: string;
  role: string;
  capabilities: string[];
  features: {
    payouts: boolean;
    thirdPartySales: boolean;
    originalSales: boolean;
    merchandise: boolean;
  };
};

export async function loadAdminSession(): Promise<AdminFetchResult<AdminSessionPayload>> {
  return fetchAdminJson<AdminSessionPayload>("session");
}
