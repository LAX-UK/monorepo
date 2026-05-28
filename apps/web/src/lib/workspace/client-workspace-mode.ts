export const CLIENT_WORKSPACE_COOKIE = "lax_client_workspace";

/** Buying (collector) vs Selling & Artist workspace — persisted for signed-in clients. */
export type ClientWorkspaceMode = "buying" | "selling";

export function parseClientWorkspaceMode(raw: string | undefined): ClientWorkspaceMode {
  return raw === "selling" ? "selling" : "buying";
}

/**
 * Dashboard meta conventions:
 * - List pages → `clientWorkspacePageMeta()` → Buying / Selling
 * - Overview → `clientWorkspaceOverviewMeta()` → Collector home / Seller home
 * - Settings / invitations / orgs → domain-specific meta (unchanged)
 */

/** Dashboard page header eyebrow for task list pages in the active client workspace. */
export function clientWorkspacePageMeta(mode: ClientWorkspaceMode): string {
  return mode === "selling" ? "Selling" : "Buying";
}

/** Overview home eyebrow — welcoming, mode-aware label (not Buying/Selling). */
export function clientWorkspaceOverviewMeta(mode: ClientWorkspaceMode): string {
  return mode === "selling" ? "Seller home" : "Collector home";
}

/** Read persisted workspace mode from cookies and return the list-page header eyebrow. */
export async function readClientWorkspacePageMeta(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return clientWorkspacePageMeta(parseClientWorkspaceMode(jar.get(CLIENT_WORKSPACE_COOKIE)?.value));
}

/** Read persisted workspace mode from cookies and return the overview home eyebrow. */
export async function readClientWorkspaceOverviewMeta(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return clientWorkspaceOverviewMeta(
    parseClientWorkspaceMode(jar.get(CLIENT_WORKSPACE_COOKIE)?.value),
  );
}
