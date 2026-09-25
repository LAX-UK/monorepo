export type OAuthProvider = "apple" | "google";

export function parseOAuthProvider(value: string | string[] | undefined): OAuthProvider | null {
  const candidate = typeof value === "string" ? value : value?.[0];
  return candidate === "google" || candidate === "apple" ? candidate : null;
}
