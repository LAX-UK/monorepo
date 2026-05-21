import { buildConsentInitSnippet } from "@/lib/analytics/consent-init-snippet";
import type { ConsentSnapshot } from "@/lib/analytics/consent/cookie";
import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";

type Props = {
  snapshot: ConsentSnapshot | null;
  nonce: string;
};

/** Synchronous Consent Mode bootstrap in `<head>` — before GTM loads. */
export function ConsentInit({ snapshot, nonce }: Props) {
  if (!isAnalyticsEnabled()) return null;

  return (
    <script
      suppressHydrationWarning
      {...(nonce ? { nonce } : {})}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted inline consent bootstrap
      dangerouslySetInnerHTML={{ __html: buildConsentInitSnippet(snapshot) }}
    />
  );
}
