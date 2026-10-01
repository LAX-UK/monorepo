import { NextResponse } from "next/server";
import {
  SHOP_IDENTITY_FETCH_TIMEOUT_MS,
  shopIdentityServerUrl,
} from "../../../lib/shop-identity.server";

type ShopIdentityHealth = {
  status?: unknown;
  release?: unknown;
};

export async function GET() {
  try {
    // Use shop-identity readiness (database), not /api/health/deps (OIDC probe), so App
    // Platform rollouts do not fail while auth is restarting in the same deployment.
    const response = await fetch(shopIdentityServerUrl("/health/ready"), {
      cache: "no-store",
      signal: AbortSignal.timeout(SHOP_IDENTITY_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`shop_identity_health_${response.status}`);
    const dependency = (await response.json()) as ShopIdentityHealth;
    if (dependency.status !== "ok") throw new Error("shop_identity_unready");

    const commerceProbe = await fetch(shopIdentityServerUrl("/commerce/basket"), {
      cache: "no-store",
      signal: AbortSignal.timeout(SHOP_IDENTITY_FETCH_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!commerceProbe.ok) throw new Error(`shop_commerce_basket_${commerceProbe.status}`);

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
