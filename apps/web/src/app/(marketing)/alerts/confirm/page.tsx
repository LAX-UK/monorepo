import { ConfirmAlertLink } from "@/components/alerts/alert-link-client";
import { readAlertLink } from "@/lib/data/http/alerts.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { ALERT_LINK_COPY } from "@auction/marketing-ui";
import { EmptyState } from "@auction/ui/lax";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Confirm sale alerts",
  "Confirm your LAX Bid sale alerts.",
);

/**
 * Opening the link only reads it: nothing is confirmed until the button is pressed, so a mail
 * scanner that follows the link cannot switch alerts on for an address nobody chose.
 */
export default async function ConfirmSaleAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const preview = token ? await readAlertLink("confirm", token) : { state: "invalid" as const };
  if (!preview) {
    const copy = ALERT_LINK_COPY.bid.confirm;
    return (
      <EmptyState
        layout="page"
        variant="error"
        className="pt-[var(--header-height)]"
        illustration="askew"
        title={copy.failedTitle}
        description="Open the link in your email again in a moment."
      />
    );
  }
  return <ConfirmAlertLink token={token} link={preview} />;
}
