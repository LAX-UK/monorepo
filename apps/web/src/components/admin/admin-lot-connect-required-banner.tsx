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
      <AlertTitle>Stripe Connect required before scheduling</AlertTitle>
      <AlertDescription className="space-y-3 text-pretty">
        <p>
          This lot is assigned to an <span className="font-medium">individual</span> seller whose
          Stripe Connect account is not ready (charges and payouts must both be enabled). Ask the
          consignor to sign in and finish Connect onboarding from their account area, then retry{" "}
          <span className="font-medium">Publish</span>.
        </p>
        {sellerLegalEntityId ? (
          <p>
            <Link
              className="font-medium text-primary underline underline-offset-2"
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
          <p className="border-t border-outline-variant/20 pt-2 font-mono text-xs text-on-surface-variant">
            {detail}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
