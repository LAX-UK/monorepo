import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { BidCoverViewer } from "./bid-cover.adapter";
import { viewerFromRegistrations } from "./cover-viewer";

function statusOf(item: unknown): string {
  if (typeof item !== "object" || item === null) return "";
  const status = (item as { status?: unknown }).status;
  return typeof status === "string" ? status : "";
}

/**
 * Where the signed-in person stands with a sale. It runs in the browser after the page has
 * rendered, so the public page stays the same for everyone; any failure leaves the cover as the
 * anonymous visitor sees it.
 */
export async function fetchCoverViewer(
  saleId: string,
  signal: AbortSignal,
): Promise<BidCoverViewer> {
  try {
    const res = await browserFetch(
      `${browserApiBase()}/sales/${encodeURIComponent(saleId)}/my-registrations`,
      { cache: "no-store", signal },
    );
    if (!res.ok) return "anonymous";
    const body = (await res.json()) as { data?: { items?: unknown[] }; items?: unknown[] };
    const items = body.data?.items ?? body.items ?? [];
    return viewerFromRegistrations(items.map(statusOf));
  } catch {
    return "anonymous";
  }
}
