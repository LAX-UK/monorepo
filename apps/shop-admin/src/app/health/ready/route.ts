import { NextResponse } from "next/server";
import { getShopAdminContainer } from "../../../server/container";

export async function GET(): Promise<Response> {
  const container = getShopAdminContainer();
  let shopApiStatus: "ok" | "error" = "error";
  try {
    const res = await fetch(`${container.config.shopApiBaseUrl}/health/ready`, {
      signal: AbortSignal.timeout(5_000),
    });
    shopApiStatus = res.ok ? "ok" : "error";
  } catch {
    shopApiStatus = "error";
  }
  const ok = shopApiStatus === "ok";
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      release: container.config.release ?? "unknown",
      dependencies: { shopApi: { status: shopApiStatus } },
    },
    { status: ok ? 200 : 503 },
  );
}
