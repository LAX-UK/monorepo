"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { useFormStatus } from "react-dom";

type Props = {
  formId: string;
};

export function XeroDisconnectSubmit({ formId }: Props) {
  const { pending } = useFormStatus();

  return (
    <ConfirmFormSubmit
      formId={formId}
      variant="secondary"
      className="min-h-11 text-error"
      disabled={pending}
      confirmTitle="Disconnect Xero?"
      confirmBody="Hosted invoices and sync will stop until you reconnect."
      confirmLabel="Disconnect"
      tone="danger"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </ConfirmFormSubmit>
  );
}
