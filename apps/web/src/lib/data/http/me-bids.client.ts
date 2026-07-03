import { browserFetch } from "@/lib/data/http/hc-browser";

/** GET /api/me/bids/closing-soon (Next.js BFF route). */
export async function fetchClosingSoonBids(): Promise<unknown | null> {
  try {
    const res = await browserFetch("/api/me/bids/closing-soon");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
