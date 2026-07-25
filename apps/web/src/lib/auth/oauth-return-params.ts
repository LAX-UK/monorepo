import {
  appendMarketingParamsToPath,
  appendMarketingPassthroughParams,
} from "@auction/validators/marketing-attribution";

export type OAuthProvider = "apple" | "google";

export function parseOAuthProvider(value: string | string[] | undefined): OAuthProvider | null {
  const candidate = typeof value === "string" ? value : value?.[0];
  return candidate === "google" || candidate === "apple" ? candidate : null;
}

export function buildOAuthCallbackUrl(input: {
  webOrigin: string;
  next: string;
  provider: OAuthProvider;
  source: URLSearchParams;
}): string {
  const params = new URLSearchParams({
    next: input.next,
    oauth_provider: input.provider,
  });
  appendMarketingPassthroughParams(params, input.source);
  return `${input.webOrigin.replace(/\/$/, "")}/auth/social-callback?${params.toString()}`;
}

/** Preserve marketing passthrough values and a validated provider completion marker. */
export function withOAuthReturnParams(
  destination: string,
  source: Record<string, string | string[] | undefined>,
): string {
  const withMarketing = appendMarketingParamsToPath(destination, source);
  const provider = parseOAuthProvider(source.oauth_provider);
  if (!provider) return withMarketing;

  const url = new URL(withMarketing, "https://lax.invalid");
  url.searchParams.set("oauth_provider", provider);
  return `${url.pathname}${url.search}${url.hash}`;
}
