import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SHOP_ADMIN_CSRF_COOKIE, SHOP_ADMIN_SESSION_COOKIE } from "../../../../lib/session-cookie";
import { getShopAdminContainer } from "../../../../server/container";

async function handle(request: Request, pathSegments: string[]): Promise<Response> {
  const container = getShopAdminContainer();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SHOP_ADMIN_SESSION_COOKIE)?.value ?? null;
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
      adminApi: container.adminApi,
      clock: container.clock,
      sessionId,
      bffPath,
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
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (message === "Not found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (message.includes("CSRF") || message.includes("Cross-origin")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return handle(request, path);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return handle(request, path);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return handle(request, path);
}
