"use client";

import { AdminMutationFeedback } from "@/components/admin-mutation-feedback";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { revokeStaffRole } from "@/server/application/admin-people-actions.server";
import { staffRoleLabel } from "@/server/domain/staff-role-label.vm";
import { Button, ConfirmDialog } from "@auction/ui";
import { useState } from "react";

export function RevokeStaffRoleAction({
  identitySubjectId,
  role,
}: {
  identitySubjectId: string;
  role: string;
}) {
  const { pending, idempotencyKey, message, stepUpRequired, stepUpHref, run } = useAdminMutation();
  const [confirming, setConfirming] = useState(false);
  const subject = identitySubjectId.slice(0, 12);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        Revoke
      </Button>
      <AdminMutationFeedback
        message={message}
        stepUpRequired={stepUpRequired}
        stepUpHref={stepUpHref}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Revoke role for ${subject}`}
        body={`${subject} loses the ${staffRoleLabel(role)} role and can no longer use LAX Admin. You can grant the role again later.`}
        confirmLabel="Revoke role"
        loading={pending}
        onConfirm={async () => {
          await run(
            () => revokeStaffRole({ identitySubjectId, idempotencyKey }),
            "Staff role revoked",
          );
          setConfirming(false);
        }}
      />
    </div>
  );
}
