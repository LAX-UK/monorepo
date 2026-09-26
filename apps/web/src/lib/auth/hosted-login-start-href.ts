import { isSafeNextPath } from "@/lib/auth/post-auth-destination";

export type HostedLoginStartIntent = "signup" | "reauth" | "sell";

export type BuildHostedLoginStartHrefOptions = {
  next?: string | null;
  intent?: HostedLoginStartIntent | null;
  invite?: string | null;
  /** Force account picker / login prompt (maps to switch=1 when not reauth). */
  forceLoginPrompt?: boolean;
};

/** Client-safe BFF entry URL that starts OIDC without an intermediate /login skeleton. */
export function buildHostedLoginStartHref(options: BuildHostedLoginStartHrefOptions = {}): string {
  const params = new URLSearchParams();
  const next = options.next && isSafeNextPath(options.next) ? options.next : "/dashboard";
  params.set("next", next);
  const intent = options.intent?.trim();
  if (intent === "signup" || intent === "reauth" || intent === "sell") {
    params.set("intent", intent);
  }
  const invite = options.invite?.trim();
  if (invite && invite.length >= 16) {
    params.set("invite", invite);
  }
  if (options.forceLoginPrompt && intent !== "reauth") {
    params.set("switch", "1");
  }
  return `/api/auth/login?${params.toString()}`;
}
