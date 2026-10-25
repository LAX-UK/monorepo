import { Notice, StaffButton } from "@auction/staff-ui";
import Link from "next/link";

type Props = {
  saleId: string;
  atgTabHref?: string;
};

/** Shown on sale setup and lot edit while the sale is live on ATG. */
export function AtgEditAlert({ saleId, atgTabHref = `/admin/sales/${saleId}/atg` }: Props) {
  return (
    <Notice
      tone="warning"
      title="This sale sells on ATG"
      actions={
        <StaffButton asChild size="sm" variant="secondary">
          <Link href={atgTabHref}>Open ATG tab</Link>
        </StaffButton>
      }
    >
      Changes here sync to ATG within a few minutes. Photos are only added on ATG, never removed,
      and ATG has no unpublish: closing the auction there is permanent.
    </Notice>
  );
}
