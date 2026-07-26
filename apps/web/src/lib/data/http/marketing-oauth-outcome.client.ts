import type { OAuthProvider } from "@/lib/auth/oauth-return-params";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

export type OAuthOutcome = {
  event: "ignored" | "login" | "signup";
  method: OAuthProvider;
};

export async function resolveOAuthOutcome(provider: OAuthProvider): Promise<OAuthOutcome> {
  const response = await browserFetch(`${browserApiBase()}/marketing/oauth-outcome`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  if (!response.ok) throw new Error(`oauth_outcome_http_${response.status}`);
  const body = (await response.json()) as { data?: OAuthOutcome };
  if (
    !body.data ||
    (body.data.event !== "ignored" &&
      body.data.event !== "login" &&
      body.data.event !== "signup") ||
    (body.data.method !== "google" && body.data.method !== "apple")
  ) {
    throw new Error("oauth_outcome_invalid_response");
  }
  return body.data;
}
