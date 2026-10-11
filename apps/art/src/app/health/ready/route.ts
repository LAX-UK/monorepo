import { artCatalogueApiServerUrl } from "@/lib/art-catalogue.server";
import { ART_IDENTITY_FETCH_TIMEOUT_MS, artIdentityServerUrl } from "@/lib/art-identity.server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const identityResponse = await fetch(artIdentityServerUrl("/health/ready"), {
      cache: "no-store",
      signal: AbortSignal.timeout(ART_IDENTITY_FETCH_TIMEOUT_MS),
    });
    if (!identityResponse.ok) throw new Error(`art_identity_health_${identityResponse.status}`);
    const identityBody = (await identityResponse.json()) as { status?: unknown; release?: unknown };
    if (identityBody.status !== "ok") throw new Error("art_identity_unready");

    const commerceProbe = await fetch(artIdentityServerUrl("/commerce/basket"), {
      cache: "no-store",
      signal: AbortSignal.timeout(ART_IDENTITY_FETCH_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!commerceProbe.ok) throw new Error(`art_commerce_basket_${commerceProbe.status}`);

    const apiProbe = await fetch(artCatalogueApiServerUrl("/health/ready"), {
      cache: "no-store",
      signal: AbortSignal.timeout(ART_IDENTITY_FETCH_TIMEOUT_MS),
    });
    if (!apiProbe.ok) throw new Error(`shop_api_health_${apiProbe.status}`);
    const apiBody = (await apiProbe.json()) as { status?: unknown; release?: unknown };
    if (apiBody.status !== "ok") throw new Error("shop_api_unready");

    return NextResponse.json({
      service: "art",
      status: "ok",
      release: process.env.SENTRY_RELEASE ?? "unknown",
      dependencies: {
        artIdentity: {
          status: identityBody.status,
          release: typeof identityBody.release === "string" ? identityBody.release : "unknown",
        },
        shopApi: {
          status: apiBody.status,
          release: typeof apiBody.release === "string" ? apiBody.release : "unknown",
        },
      },
    });
  } catch {
    return NextResponse.json(
      {
        service: "art",
        status: "unavailable",
        release: process.env.SENTRY_RELEASE ?? "unknown",
      },
      { status: 503 },
    );
  }
}
