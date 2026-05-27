"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { adminRejectSaleRegistrationAction } from "@/lib/actions/admin";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";

type Props = {
  saleId: string;
  registrationId: string;
  reasonFieldId: string;
};

export function SaleRegistrationRejectButton({ saleId, registrationId, reasonFieldId }: Props) {
  const formId = `reject-registration-${registrationId}`;

  return (
    <form
      id={formId}
      action={adminRejectSaleRegistrationAction}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <Label htmlFor={reasonFieldId} className="sr-only">
        Rejection reason (optional)
      </Label>
      <Textarea
        id={reasonFieldId}
        name="reason"
        placeholder="Optional reason"
        className="mb-1 min-h-16 w-48 font-body text-xs"
      />
      <ConfirmFormSubmit
        formId={formId}
        size="sm"
        variant="outline"
        className="min-h-9"
        confirmTitle="Reject registration?"
        confirmBody="The bidder will not be able to register for this sale unless they submit again."
        confirmLabel="Reject"
        tone="danger"
      >
        Reject
      </ConfirmFormSubmit>
    </form>
  );
}
