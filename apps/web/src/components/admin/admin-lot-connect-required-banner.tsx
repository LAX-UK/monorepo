import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { connectPublishBlockedTitle } from "@/lib/admin/sale-setup/field-copy";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

type Props = {
  sellerLegalEntityId?: string | null;
  /** Raw API / action message (optional, shown in small type for ops). */
  detail?: string | null | undefined;
};

/** Shown when lot publish fails with `connect_required` — ops copy + link to the seller legal entity. */
export function AdminLotConnectRequiredBanner({ sellerLegalEntityId, detail }: Props) {
  return (
    <Alert
      variant="default"
      className="border-outline-variant/40 bg-surface-container-high/60"
      data-testid="admin-lot-connect-required-banner"
    >
      <AlertTitle>{connectPublishBlockedTitle()}</AlertTitle>
      <AlertDescription className="space-y-3 text-pretty">
        <p>
          This lot is assigned to a seller whose payout account is not ready (Stripe Connect payouts
          enabled with no outstanding requirements, and seller approved). Ask the consignor to sign
          in and finish payout setup from their account area, then retry{" "}
          <span className="font-medium">Publish</span>.
        </p>
        {sellerLegalEntityId ? (
          <p>
            <Link
              className="font-medium text-link underline underline-offset-2"
              href={`/admin/legal-entities/${encodeURIComponent(sellerLegalEntityId)}`}
            >
              View seller legal entity (Connect status)
            </Link>
          </p>
        ) : (
          <p className="text-on-surface-variant">
            This lot has no seller legal entity id — fix cataloguing before retrying.
          </p>
        )}
        {detail ? (
          <AdminTechnicalIdDisclosure
            triggerLabel="Show error details"
            items={[{ label: "API detail", value: detail, copyLabel: "Error detail" }]}
          />
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
