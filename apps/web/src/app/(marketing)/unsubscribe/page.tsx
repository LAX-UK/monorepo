import { AuthLayout } from "@/components/auth/auth-layout";
import { UnsubscribeForm } from "@/components/auth/unsubscribe-form";
import { getUnsubscribePreview } from "@/lib/data/http/email-unsubscribe.server";
import { maskEmail } from "@/lib/format/mask-email";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { ButtonLink, Notice } from "@auction/ui/lax";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Unsubscribe",
  "Update your LAX Bid email preferences.",
);

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const preview = token ? await getUnsubscribePreview(token) : null;

  return (
    <div>
      <AuthLayout
        title="Confirm unsubscribe"
        description="Choose whether to update this email preference."
      >
        {!token || !preview ? (
          <div className="flex flex-col gap-6">
            <Notice tone="danger" alert title="This link no longer works">
              This unsubscribe link is invalid or expired. Sign in to manage your notification
              preferences.
            </Notice>
            <ButtonLink Link={Link} variant="primary" href="/settings#alerts" prefetch>
              Manage preferences
            </ButtonLink>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <Notice tone="info" title="What will change">
              {preview.scope === "global"
                ? `You will stop receiving all non-essential email at ${maskEmail(preview.email)}.`
                : `You will stop receiving ${labelForNotification(preview.notificationType)} email at ${maskEmail(preview.email)}.`}
            </Notice>
            <UnsubscribeForm token={token} />
          </div>
        )}
      </AuthLayout>
    </div>
  );
}

function labelForNotification(type: string | null): string {
  switch (type) {
    case "outbid":
      return "outbid";
    case "lot_won":
      return "auction won";
    case "lot_ended_seller":
      return "seller lot ended";
    default:
      return "this type of";
  }
}
