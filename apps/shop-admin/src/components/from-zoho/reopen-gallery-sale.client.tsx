"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { reopenGallerySale } from "@/server/application/admin-register-actions.server";
import type { AdminRegisterDetail } from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  Notice,
  Permitted,
  StaffButton,
  useStaffCan,
} from "@auction/staff-ui";
import { RotateCcw } from "@auction/staff-ui/icons";
import { useState } from "react";

export const REOPEN_CAPABILITY = "artwork_register.reopen_sold";

/**
 * Reopen a sale made in the gallery that Zoho reported by mistake. Administrators only. The
 * artwork goes back to Not offered and nothing is put on sale again by itself; the reason is kept
 * in the artwork's history with the Administrator's name.
 */
function ReopenDialog({
  registerId,
  title,
  onClose,
}: {
  registerId: string;
  title: string;
  onClose: () => void;
}) {
  const action = useAdminAction();
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title="Reopen this sale"
        description={`${title} will no longer be recorded as sold in the gallery. It goes back to Not offered; nothing is put on sale again by itself.`}
        confirmLabel="Reopen sale"
        tone="danger"
        loading={action.pending}
        reason={{
          label: "Why is the sale being reopened?",
          description: "Kept in the artwork's history with your name.",
          maxLength: 500,
          missingMessage: "Say why the sale is being reopened.",
        }}
        onConfirm={async ({ reason }) => {
          const ok = await action.run(
            () => reopenGallerySale({ registerId, reason, idempotencyKey: action.idempotencyKey }),
            "Sale reopened",
            "reopen this sale",
          );
          if (ok) onClose();
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

/**
 * The sold state of a work Zoho reported sold in the gallery, with Reopen for Administrators.
 * Reopen waits, with the reason shown, while Zoho still says Sold.
 */
export function GallerySaleNotice({ detail }: { detail: AdminRegisterDetail }) {
  const [reopening, setReopening] = useState(false);
  const canReopen = useStaffCan(REOPEN_CAPABILITY);
  const sale = detail.gallerySale;
  if (!sale) return null;
  // Why Reopen waits comes from shop-api, in the words it refuses Reopen with.
  const waitReason = sale.reopen === "zoho_still_sold" ? sale.reopenWaitReason : null;
  return (
    <>
      <Notice tone="info" title="Sold in the gallery, per Zoho">
        <div className="flex flex-col gap-3">
          <p>
            Zoho&apos;s Status is the record of this sale, so LAX shows the artwork as sold and
            takes it off sale. No lax.art payment for it can complete while it is recorded as sold
            here; anything still open for it is listed in Needs decision.
          </p>
          {canReopen && waitReason ? <p>{waitReason}</p> : null}
          <Permitted requires={REOPEN_CAPABILITY}>
            <div>
              <StaffButton
                variant="secondary"
                icon={<RotateCcw aria-hidden />}
                onClick={() => setReopening(true)}
                {...(waitReason ? { disabledReason: waitReason } : {})}
              >
                Reopen sale…
              </StaffButton>
            </div>
          </Permitted>
        </div>
      </Notice>
      {reopening ? (
        <ReopenDialog
          registerId={detail.registerId}
          title={detail.title}
          onClose={() => setReopening(false)}
        />
      ) : null}
    </>
  );
}
