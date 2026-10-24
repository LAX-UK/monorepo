import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import type { ShopInterestReadResult } from "@/lib/shop-fetch-result";
import { parseArtworkInterestStatus } from "@auction/shop-contracts";

function logInterestReadFailure(input: {
  slug: string;
  status: number;
  body: string;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.warn(
    "[shop] artwork interest read failed (server-side, not visible in browser Network)",
    {
      slug: input.slug,
      status: input.status,
      body: input.body.slice(0, 400),
    },
  );
}

export async function fetchArtworkInterestStatus(slug: string): Promise<ShopInterestReadResult> {
  try {
    const response = await shopCommerceRequest(
      `/commerce/artworks/${encodeURIComponent(slug)}/interest?intent=notify_me`,
      { headers: { accept: "application/json" } },
    );
    const bodyText = await response.text();

    if (response.status === 401) return { status: "unauthorized" };
    if (response.status === 404) return { status: "not_found" };
    if (response.status === 503 || response.status === 502 || response.status === 504) {
      logInterestReadFailure({ slug, status: response.status, body: bodyText });
      return { status: "commerce_unavailable" };
    }
    if (!response.ok) {
      logInterestReadFailure({ slug, status: response.status, body: bodyText });
      return { status: "failed" };
    }

    let json: unknown;
    try {
      json = JSON.parse(bodyText) as unknown;
    } catch {
      logInterestReadFailure({ slug, status: response.status, body: bodyText });
      return { status: "failed" };
    }

    const body = parseArtworkInterestStatus(json);
    return { status: "ok", data: { subscribed: body.subscribed } };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[shop] artwork interest read threw (server-side)", {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { status: "failed" };
  }
}
