import "server-only";

/** Mirrors API kill-switch; web may set either in deployment. */
export function isRequireEmailVerificationServer(): boolean {
  return (
    process.env.REQUIRE_EMAIL_VERIFICATION === "true" ||
    process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === "true"
  );
}
