import { createAuctionAuthClient, resolveAuthBaseUrl } from "@auction/auth/client";

const baseURL = resolveAuthBaseUrl({
  authUrl: process.env.NEXT_PUBLIC_AUTH_URL,
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
});

/** Canonical Better Auth issuer origin (same logic as the browser auth client). */
export function getAuthIssuerBaseUrl(): string {
  return baseURL;
}

/** Points at the canonical auth issuer; Better Auth uses `/api/auth` routes on that host. */
export const authClient = createAuctionAuthClient({ baseURL });
