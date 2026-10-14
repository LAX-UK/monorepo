import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

type Props = {
  saleId: string;
  atgTabHref?: string;
};

/** Shown on sale setup and lot edit while the sale is live on ATG. */
export function AtgEditAlert({ saleId, atgTabHref = `/admin/sales/${saleId}/atg` }: Props) {
  return (
    <Alert variant="warning" className="mb-6">
      <AlertTitle>Selling on ATG</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Catalogue changes in LAX re-sync to ATG within a few minutes. Images on ATG are
          append-only — removing an image here does not remove it on ATG.
        </p>
        <p>
          ATG has no unpublish. Only <strong>Close</strong> ends the auction, and close is
          permanent.
        </p>
        <p>
          <Link
            href={atgTabHref}
            className="font-medium text-link underline-offset-4 hover:underline"
          >
            Open the ATG tab
          </Link>{" "}
          for status and results.
        </p>
      </AlertDescription>
    </Alert>
  );
}
