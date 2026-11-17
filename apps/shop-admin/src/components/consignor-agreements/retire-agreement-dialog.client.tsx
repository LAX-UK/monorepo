"use client";

import { retireConsignorAgreement } from "@/server/application/admin-consignor-agreement-actions.server";
import { placesSentence } from "@/server/domain/consignor-agreement.vm";
import type { AdminConsignorAgreement } from "@auction/shop-contracts";
import { ConfirmActionDialog } from "@auction/staff-ui";
import { useAgreementWrite } from "./use-agreement-write.client";

/**
 * Retire an agreement: it ends early and covers nothing from now on. Asks first, since a work of
 * this consignor's can then no longer be offered under it. Nothing is deleted: the agreement
 * stays on the page as retired, with its file.
 */
export function RetireAgreementDialog({
  partyId,
  consignorName,
  agreement,
  onClose,
}: {
  partyId: string;
  consignorName: string;
  agreement: AdminConsignorAgreement;
  onClose: () => void;
}) {
  const write = useAgreementWrite();
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title="Retire this agreement?"
        description={`From now on it no longer covers ${placesSentence(agreement.places)} for ${consignorName}. It stays on this page as retired, with its signed file.`}
        confirmLabel="Retire agreement"
        tone="danger"
        loading={write.pending}
        onConfirm={async () => {
          const ok = await write.run(
            () =>
              retireConsignorAgreement({
                partyId,
                agreementId: agreement.agreementId,
                expectedVersion: agreement.version,
                idempotencyKey: write.idempotencyKey,
              }),
            `Agreement with ${consignorName} retired`,
            "retire this agreement",
          );
          if (ok) onClose();
        }}
      >
        {write.error}
      </ConfirmActionDialog>
      {write.stepUpDialog}
    </>
  );
}
