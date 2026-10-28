import { guestAccountRedirect } from "@/lib/account/account-guest-gate";
import { loadArtViewerState } from "@/lib/art-viewer-state.server";
import { ART_REQUEST_PATH_HEADER } from "@/lib/request-path-header";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Signed-out visitors are redirected here, before any account page starts to stream, so the
 * response is a real redirect for browsers and crawlers alike. Each page still handles the
 * remaining cases (disabled account, identity outage) itself.
 */
export default async function ArtAccountLayout({ children }: { children: ReactNode }) {
  const [viewer, requestHeaders] = await Promise.all([loadArtViewerState(), headers()]);
  const to = guestAccountRedirect(viewer, requestHeaders.get(ART_REQUEST_PATH_HEADER));
  if (to) redirect(to);
  return children;
}
