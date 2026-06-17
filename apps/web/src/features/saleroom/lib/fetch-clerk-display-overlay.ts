import { parseSessionDisplayOverlay } from "@/features/saleroom/lib/display-overlay-state";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { SaleroomDisplayOverlay } from "@auction/types";

export type ClerkDisplayOverlayFetcher = (saleId: string) => Promise<SaleroomDisplayOverlay | null>;

export const fetchClerkDisplayOverlay: ClerkDisplayOverlayFetcher = async (saleId) => {
  const res = await browserFetch(
    `${browserApiBase()}/admin/sales/${encodeURIComponent(saleId)}/saleroom/session`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { session?: { displayOverlay?: unknown } | null } };
  return parseSessionDisplayOverlay(body.data?.session?.displayOverlay);
};
