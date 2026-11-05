"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { approveHorsCommerce } from "@/server/application/print-fulfilment-actions.server";
import type { AdminEditionRunDetail } from "@auction/shop-contracts";
import { Notice, Section, StaffButton, StatusBadge, formatStaffDate } from "@auction/staff-ui";

/**
 * A hors commerce proof was not made to be sold, so offering one for sale needs a shop admin's
 * approval. Until it is given, no print of the listing can be put on sale.
 */
export function HorsCommerceApprovalCard({
  artworkId,
  horsCommerce,
  canApprove,
}: {
  artworkId: string;
  horsCommerce: NonNullable<AdminEditionRunDetail["horsCommerce"]>;
  /** `hors_commerce.approve`: shop admins only. */
  canApprove: boolean;
}) {
  const action = useAdminAction();
  const approved = horsCommerce.approvedAt !== null;

  return (
    <Section
      title="Approval to sell"
      description="Hors commerce proofs were not made for sale. The page always says so."
      action={
        <StatusBadge tone={approved ? "success" : "warning"}>
          {approved ? "Approved" : "Needs approval"}
        </StatusBadge>
      }
    >
      {approved && horsCommerce.approvedAt ? (
        <p className="text-staff-sm text-staff-fg">
          A shop admin approved selling this proof on {formatStaffDate(horsCommerce.approvedAt)}.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {action.error}
          <Notice
            tone="warning"
            title="This proof cannot be put on sale yet"
            actions={
              canApprove ? (
                <StaffButton
                  size="sm"
                  variant="primary"
                  requires="hors_commerce.approve"
                  loading={action.pending}
                  onClick={() =>
                    action.run(
                      () =>
                        approveHorsCommerce({
                          artworkId,
                          idempotencyKey: action.idempotencyKey,
                        }),
                      "Approved to sell as a hors commerce proof",
                    )
                  }
                >
                  Approve for sale
                </StaffButton>
              ) : undefined
            }
          >
            {canApprove
              ? "Approve it once you have checked the artist agrees to sell this proof."
              : "A shop admin needs to approve it before any print can be offered."}
          </Notice>
        </div>
      )}
    </Section>
  );
}
