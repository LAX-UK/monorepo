import { NextResponse } from "next/server";
import { shopIdentityUrl } from "../../../lib/shop-identity.server";

type ShopIdentityHealth = {
  status?: unknown;
  release?: unknown;
};

export async function GET() {
  try {
    const response = await fetch(shopIdentityUrl("/api/health/deps"), {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(`shop_identity_health_${response.status}`);
    const dependency = (await response.json()) as ShopIdentityHealth;
    if (dependency.status !== "ok") throw new Error("shop_identity_unready");

    return NextResponse.json({
      service: "shop",
      status: "ok",
      release: process.env.SENTRY_RELEASE ?? "unknown",
      dependencies: {
        shopIdentity: {
          status: dependency.status,
          release: typeof dependency.release === "string" ? dependency.release : "unknown",
        },
      },
    });
  } catch {
    return NextResponse.json(
      {
        service: "shop",
        status: "unavailable",
        release: process.env.SENTRY_RELEASE ?? "unknown",
      },
      { status: 503 },
    );
  }
}
