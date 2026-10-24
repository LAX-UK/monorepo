"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminResetTwoFactorResultAction } from "@/lib/actions/admin";
import { Can } from "@/lib/auth/capabilities";
import { USER_MODERATION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import { StaffButton } from "@auction/staff-ui";
import { ADMIN_TWO_FACTOR_RESET_REASON_MIN } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const RESET_PHRASE = "RESET";

export type UserTwoFactorResetActionProps = {
  userId: string;
  fullWidthButton?: boolean;
};

/**
 * For a customer who lost both their authenticator app and their backup codes, after support has
 * checked who they are. It asks for a written reason, which goes into the audit log, and the
 * customer is emailed that support did it.
 */
export function UserTwoFactorResetAction({
  userId,
  fullWidthButton,
}: UserTwoFactorResetActionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Can requirement={USER_MODERATION_ACCESS}>
      <StaffButton
        variant="danger-secondary"
        size="sm"
        className={fullWidthButton ? "w-full sm:w-auto" : undefined}
        loading={pending}
        onClick={() => setConfirmOpen(true)}
      >
        Reset two-step verification
      </StaffButton>
      <TypedConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reset two-step verification?"
        description="Only do this after you have checked who the customer is."
        changeSummary={[
          "Their authenticator app and backup codes stop working.",
          "They are signed out on every device.",
          "They can sign in with their password, then set up two-step verification again.",
          "We email them that LAX support reset it.",
        ]}
        actionLabel="Reset two-step verification"
        confirmationPhrase={RESET_PHRASE}
        severity="danger"
        reason={{
          label: "Reason for the reset",
          minLength: ADMIN_TWO_FACTOR_RESET_REASON_MIN,
        }}
        onConfirm={(reason) => {
          startTransition(() => {
            void (async () => {
              const r = await adminResetTwoFactorResultAction(userId, { reason });
              if (r.ok) {
                notify.success("Two-step verification reset");
                router.refresh();
                return;
              }
              notify.error(r.error);
            })();
          });
        }}
      />
    </Can>
  );
}
