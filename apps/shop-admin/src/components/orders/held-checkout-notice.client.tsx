"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import { retryCheckoutCleanup } from "@/server/application/admin-operations-actions.server";
import { Notice, StaffButton } from "@auction/staff-ui";
import { RotateCw } from "@auction/staff-ui/icons";

/**
 * Shown on an order the checkout sweep could not settle and took out of the sweep. Its prints
 * stay reserved until someone looks at the payment in Stripe; putting it back lets the next
 * sweep try again, which asks Stripe and then applies, closes or expires it. If it still cannot
 * be settled it is held out again and ops are told once more.
 */
export function HeldCheckoutNotice({ orderId }: { orderId: string }) {
  const mutation = useAdminMutation();
  return (
    <Notice
      tone="warning"
      title="This order was taken out of the checkout clean-up"
      actions={
        <StaffButton
          size="sm"
          variant="secondary"
          requires="order.write"
          icon={<RotateCw aria-hidden />}
          loading={mutation.pending}
          onClick={() =>
            mutation.run(
              () => retryCheckoutCleanup({ orderId, idempotencyKey: mutation.idempotencyKey }),
              "Order put back in the clean-up",
            )
          }
        >
          Retry clean-up
        </StaffButton>
      }
    >
      The clean-up could not settle it, so its prints are still reserved. Check the payment in
      Stripe, then retry: the next clean-up ends the order or applies its payment.
      {mutation.message ? (
        <span role="alert" className="mt-1 block text-staff-danger">
          {mutation.message}
        </span>
      ) : null}
    </Notice>
  );
}
