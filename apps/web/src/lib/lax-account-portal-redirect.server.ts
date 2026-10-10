import { redirect } from "next/navigation";

const IDENTITY_SECTIONS = new Set(["profile", "account", "security", "sessions"]);

/** When `LAX_ACCOUNT_ORIGIN` is set, Bid identity settings live on the account portal. */
export function redirectIdentitySettingsToLaxAccount(section: string): void {
  const origin = process.env.LAX_ACCOUNT_ORIGIN?.trim().replace(/\/+$/, "");
  if (!origin || !IDENTITY_SECTIONS.has(section)) return;
  redirect(`${origin}/account?from=bid&section=${encodeURIComponent(section)}`);
}

export function laxAccountPortalOrigin(): string | null {
  const origin = process.env.LAX_ACCOUNT_ORIGIN?.trim().replace(/\/+$/, "");
  return origin && origin.length > 0 ? origin : null;
}
