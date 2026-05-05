export const CLIENT_WORKSPACE_COOKIE = "lax_client_workspace";

/** Buying (collector) vs Selling & Artist workspace — persisted for signed-in clients. */
export type ClientWorkspaceMode = "buying" | "selling";

export function parseClientWorkspaceMode(raw: string | undefined): ClientWorkspaceMode {
  return raw === "selling" ? "selling" : "buying";
}
