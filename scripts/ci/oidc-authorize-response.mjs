/**
 * Interprets a Better Auth `/oauth2/authorize` response for live acceptance probes.
 *
 * A first-time authorization renders the same-origin consent page. Once the
 * subject has already granted the requested scopes, Better Auth skips consent
 * and answers a fetch-metadata request with a JSON redirect envelope or, for
 * navigations, a 3xx redirect carrying the authorization code.
 */
const CONSENT_CODE_PATTERN = /id="consent-code"[^>]+value="([^"]+)"/;

function readRedirectFromJson(body) {
  if (!body || typeof body !== "object") return null;
  if (typeof body.redirectURI === "string") return body.redirectURI;
  if (typeof body.url === "string") return body.url;
  return null;
}

/**
 * @returns {Promise<
 *   | { kind: "consent"; consentCode: string }
 *   | { kind: "redirect"; redirectUri: string }
 *   | null
 * >}
 */
export async function readAuthorizeOutcome(response) {
  if (response.status < 200 || response.status >= 400) return null;

  const location = response.headers.get("location");
  if (location) return { kind: "redirect", redirectUri: location };

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const redirectUri = readRedirectFromJson(await response.json().catch(() => null));
    return redirectUri ? { kind: "redirect", redirectUri } : null;
  }

  const consentCode = (await response.text()).match(CONSENT_CODE_PATTERN)?.[1];
  return consentCode ? { kind: "consent", consentCode } : null;
}

/**
 * Completes authorization for a signed-in subject, granting consent only when
 * the issuer asks for it, and returns the client callback URI carrying the code.
 */
export async function completeAuthorization({
  authBase,
  authorizeResponse,
  cookieHeader,
  fetchImpl = fetch,
  onResponse = () => {},
}) {
  const outcome = await readAuthorizeOutcome(authorizeResponse);
  if (!outcome) {
    throw new Error(
      `OIDC authorize returned neither a consent page nor a redirect (${authorizeResponse.status})`,
    );
  }
  if (outcome.kind === "redirect") return outcome.redirectUri;

  const consent = await fetchImpl(`${authBase}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      origin: authBase,
    },
    body: JSON.stringify({ accept: true, consent_code: outcome.consentCode }),
  });
  onResponse(consent);
  const consentBody = await consent.json().catch(() => null);
  const redirectUri = readRedirectFromJson(consentBody);
  if (!consent.ok || typeof consentBody?.redirectURI !== "string" || !redirectUri) {
    throw new Error(`OIDC consent failed (${consent.status})`);
  }
  return redirectUri;
}
