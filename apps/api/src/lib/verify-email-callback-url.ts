/** Absolute verify-email callback URL on the public web origin (never the auth issuer). */
export function buildVerifyEmailCallbackUrl(
  webOrigin: string,
  options: {
    email: string;
    persona?: string;
    inviteToken?: string;
  },
): string {
  const base = webOrigin.replace(/\/$/, "");
  const params = new URLSearchParams({ email: options.email });
  if (options.persona === "individual" || options.persona === "organisation") {
    params.set("persona", options.persona);
  }
  if (options.inviteToken) {
    params.set("invite", options.inviteToken);
  }
  return `${base}/verify-email?${params.toString()}`;
}
