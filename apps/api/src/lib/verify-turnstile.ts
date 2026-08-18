export async function verifyTurnstileResponse(params: {
  secret: string;
  token: string;
  remoteip?: string | undefined;
  fetchFn?: typeof fetch;
}): Promise<boolean> {
  const body = new URLSearchParams({
    secret: params.secret,
    response: params.token,
  });
  if (params.remoteip) body.set("remoteip", params.remoteip);
  const response = await (params.fetchFn ?? fetch)(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
