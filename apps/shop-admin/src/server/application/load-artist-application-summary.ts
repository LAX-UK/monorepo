import { fetchAdminJson } from "./load-admin-data";

/**
 * New artist applications, for the count beside the nav entry. Only asked for staff who can
 * review them; a failure yields null so a missing count never stops a page rendering.
 */
export async function loadArtistApplicationSummary(
  capabilities: readonly string[],
): Promise<{ newCount: number } | null> {
  if (!capabilities.includes("artist_application.review")) return null;
  const result = await fetchAdminJson<{ newCount: number }>("artist-applications/summary");
  return result.status === "ok" ? result.data : null;
}
