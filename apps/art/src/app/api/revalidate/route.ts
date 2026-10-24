import { loadArtEnv } from "@/env.server";
import {
  REVALIDATE_SECRET_HEADER,
  createRevalidateRateLimiter,
  parseRevalidateTags,
  secretMatches,
} from "@/lib/revalidate/revalidate-request";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const limiter = createRevalidateRateLimiter({ limit: 30, windowMs: 60_000 });

function respond(status: number, error?: string) {
  return error
    ? NextResponse.json({ error }, { status, headers: NO_STORE })
    : new NextResponse(null, { status, headers: NO_STORE });
}

/**
 * Called by shop-api after a staff editorial or catalogue write so published changes show immediately
 * instead of when the 120 second cache expires. The route is outside the page middleware
 * (`/api` is excluded from its matcher), so the shared secret is the only gate.
 */
export async function POST(request: NextRequest) {
  const expected = loadArtEnv().ART_REVALIDATE_SECRET;
  if (!expected) return respond(404);

  const caller = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiter.allow(caller)) return respond(429, "rate_limited");

  if (!secretMatches(request.headers.get(REVALIDATE_SECRET_HEADER), expected)) {
    return respond(401, "unauthorized");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, "invalid_body");
  }
  const tags = parseRevalidateTags(body);
  if (!tags) return respond(400, "invalid_tags");

  for (const tag of tags) revalidateTag(tag);
  return respond(204);
}
