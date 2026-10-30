import { Notice, StaffButtonLink } from "@auction/staff-ui";
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
        <StaffButtonLink size="sm" variant="secondary" href={atgTabHref} Link={Link}>
          Open ATG tab
        </StaffButtonLink>
      }
    >
      Changes here sync to ATG within a few minutes. Photos are only added on ATG, never removed,
      and ATG has no unpublish: closing the auction there is permanent.
    </Notice>
  );
}
