import { VisitorAlertUnsubscribe } from "@/components/alerts/visitor-alert-unsubscribe";
import { getVisitorAlertUnsubscribePreview } from "@/lib/data/http/sale-alerts.server";
import { maskEmail } from "@/lib/format/mask-email";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { ButtonLink, EmptyState } from "@auction/ui/lax";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Unsubscribe from sale alerts",
  "Stop LAX Bid sale alert emails.",
);

export default async function UnsubscribeSaleAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const preview = token ? await getVisitorAlertUnsubscribePreview(token) : null;

  if (!preview) {
    return (
      <EmptyState
        layout="page"
        variant="error"
        className="pt-[var(--header-height)]"
        illustration="askew"
        title="This link doesn't work"
        description="It may be incomplete. Use the unsubscribe link in the latest sale alert email, or contact us and we'll remove you."
        actions={
          <ButtonLink Link={Link} variant="primary" href="/contact">
            Contact us
          </ButtonLink>
        }
      />
    );
  }
  return <VisitorAlertUnsubscribe token={token} maskedEmail={maskEmail(preview.email)} />;
}
