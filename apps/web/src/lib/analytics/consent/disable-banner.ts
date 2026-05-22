/**
 * ⚠️ TEMPORARY — PRE-LAUNCH MARKETING TEST TOGGLE — REMOVE BEFORE GO-LIVE ⚠️
 *
 * Added at the marketing team's request because GA4 was not receiving events
 * during pre-launch validation. When `NEXT_PUBLIC_DISABLE_CONSENT_BANNER=true`:
 *   - the cookie banner does not render
 *   - SSR layout synthesises an "all granted" consent snapshot
 *   - browser dataLayer guards short-circuit so events fire from page 1
 *
 * Default is `false` everywhere; production behaviour is unchanged unless the
 * env var is explicitly set to `"true"` (GitHub repo variable).
 *
 * Leaving this enabled in production violates UK GDPR/PECR consent rules.
 * Tear-down checklist before public launch:
 *   1. Set `NEXT_PUBLIC_DISABLE_CONSENT_BANNER=false` (or unset) on prod GitHub vars
 *   2. Re-apply Terraform
 *   3. Delete this module + every callsite + the env var from Terraform/CI
 *   4. Verify the banner renders again in incognito on prod
 */
export function isConsentBannerDisabled(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_CONSENT_BANNER === "true";
}
