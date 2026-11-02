import { VisitorAlertUnsubscribeForm } from "@/components/alerts/visitor-alert-unsubscribe-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { getVisitorAlertUnsubscribePreview } from "@/lib/data/http/sale-alerts.server";
import { maskEmail } from "@/lib/format/mask-email";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { ButtonLink, Notice } from "@auction/ui/lax";
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

  return (
    <AuthLayout title="Unsubscribe from sale alerts" description="Stop emails about new sales.">
      {preview ? (
        <VisitorAlertUnsubscribeForm token={token} maskedEmail={maskEmail(preview.email)} />
      ) : (
        <div className="flex flex-col gap-6">
          <Notice tone="danger" alert title="This link doesn't work">
            It may be incomplete. Use the unsubscribe link in the latest sale alert email, or
            contact us and we&apos;ll remove you.
          </Notice>
          <ButtonLink Link={Link} variant="primary" href="/contact">
            Contact us
          </ButtonLink>
        </div>
      )}
    </AuthLayout>
  );
}
