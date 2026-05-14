import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import { gtmNoscriptSrc } from "@/lib/analytics/providers/gtm";

type Props = {
  /** When true, visitor has opted into analytics; still requires prod + GTM id. */
  analyticsGranted: boolean;
};

/**
 * GTM `<noscript>` iframe — only when analytics consent is already on the cookie
 * (SSR) and analytics is enabled for this deployment.
 */
export function GtmNoscript({ analyticsGranted }: Props) {
  if (!analyticsGranted || !isAnalyticsEnabled()) return null;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  if (!gtmId) return null;

  return (
    <noscript>
      <iframe
        title="Google Tag Manager"
        src={gtmNoscriptSrc(gtmId)}
        height={0}
        width={0}
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
