import {
  REVALIDATE_SECRET_HEADER,
  createRevalidateRateLimiter,
  parseRevalidateTags,
  secretMatches,
} from "@/lib/cache/revalidate-request";
import { resolveVisitorIp } from "@/lib/http/visitor-ip";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
/** A busy live sale sends one request per accepted bid; well above that, guessing is blunted. */
const limiter = createRevalidateRateLimiter({ limit: 1_200, windowMs: 60_000 });

function respond(status: number, error?: string) {
  return error
    ? NextResponse.json({ error }, { status, headers: NO_STORE })
    : new NextResponse(null, { status, headers: NO_STORE });
}

/**
 * Called by the API and the worker after a committed change to a lot or a sale (a new price, a
 * status, a close time, a withdrawal, a catalogue edit) so the cached public sale and lot reads
 * that show it are dropped at once instead of when their revalidate window ends. The route sits
 * outside the page middleware (`/api` is excluded from its matcher), so the shared secret is the
 * only gate; without `WEB_REVALIDATE_SECRET` the route does not exist.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.WEB_REVALIDATE_SECRET?.trim();
  if (!expected) return respond(404);

  if (!limiter.allow(resolveVisitorIp(request.headers))) {
    return respond(429, "rate_limited");
  }
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
