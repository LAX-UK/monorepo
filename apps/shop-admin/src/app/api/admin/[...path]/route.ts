import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SHOP_ADMIN_CSRF_COOKIE, shopAdminSessionCookie } from "../../../../lib/session-cookie";
import { getShopAdminContainer } from "../../../../server/container";
import { classifyAdminReadFailure } from "../../../../server/domain/admin-read-failure";

async function handle(request: Request, pathSegments: string[]): Promise<Response> {
  const container = getShopAdminContainer();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(shopAdminSessionCookie(container.config))?.value ?? null;
  const csrfCookie = cookieStore.get(SHOP_ADMIN_CSRF_COOKIE)?.value ?? null;
  const bffPath = `/api/admin/${pathSegments.join("/")}`;
  const forwardHeaders: Record<string, string> = {};
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) forwardHeaders["idempotency-key"] = idempotencyKey;
  const contentType = request.headers.get("content-type");
  if (contentType) forwardHeaders["content-type"] = contentType;

  try {
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();
    const result = await container.forwardAdminRequest({
      config: container.config,
      sessions: container.sessions,
      renewal: container.sessionRenewal,
      adminApi: container.adminApi,
      clock: container.clock,
      sessionId,
      bffPath,
      search: new URL(request.url).search,
      method: request.method,
      origin: request.headers.get("origin"),
      csrfHeader: request.headers.get("x-csrf-token"),
      csrfCookie,
      body,
      forwardHeaders,
    });
    return new NextResponse(result.body, {
      status: result.status,
      headers: result.headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    const failure = classifyAdminReadFailure(error);
    if (failure.kind === "unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (message === "Not found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (message.includes("CSRF") || message.includes("Cross-origin")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    // The detail can name hosts, paths or upstream responses; it goes to the log, not the browser.
    console.error("[shop-admin.bff] admin request failed", {
      method: request.method,
      path: bffPath,
      ...failure.log,
    });
    return NextResponse.json({ error: "request_failed" }, { status: 400 });
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return handle(request, path);
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
