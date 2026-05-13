/** Cloudflare Turnstile server-side verification (shared by API + auth issuer). */
export async function verifyTurnstileResponse(params: {
  secret: string;
  token: string;
  remoteip?: string | undefined;
  fetchFn?: typeof fetch;
}): Promise<boolean> {
  const fetchImpl = params.fetchFn ?? fetch;
  const body = new URLSearchParams();
  body.set("secret", params.secret);
  body.set("response", params.token);
  if (params.remoteip) body.set("remoteip", params.remoteip);
  const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { success?: boolean };
  return Boolean(json.success);
}
