/** Client-side mirror of server env (optional `NEXT_PUBLIC_*`). */
export function isRequireEmailVerificationClient(): boolean {
  return process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === "true";
}
