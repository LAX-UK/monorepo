export const CLIENT_WORKSPACE_COOKIE = "lax_client_workspace";

/** Buying (collector) vs Selling & Artist workspace — persisted for signed-in clients. */
export type ClientWorkspaceMode = "buying" | "selling";

export function parseClientWorkspaceMode(raw: string | undefined): ClientWorkspaceMode {
  return raw === "selling" ? "selling" : "buying";
}

/** Dashboard page header eyebrow for the active client workspace. */
export function clientWorkspacePageMeta(mode: ClientWorkspaceMode): string {
  return mode === "selling" ? "Selling" : "Buying";
}

/** Read persisted workspace mode from cookies and return the dashboard page header eyebrow. */
export async function readClientWorkspacePageMeta(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return clientWorkspacePageMeta(parseClientWorkspaceMode(jar.get(CLIENT_WORKSPACE_COOKIE)?.value));
}
