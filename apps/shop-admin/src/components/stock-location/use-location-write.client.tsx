"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { Notice, StaffButton } from "@auction/staff-ui";
import { RotateCw } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/** Why the API refused a list write with 409: a stale version, or a name in use. */
export type LocationRefusal = "stale" | "name_taken";

/**
 * A write to the list of locations from a dialog. On top of `useAdminAction` (toast, refresh,
 * "Confirm it's you" for a sign-in that is not recent), it reads what the API refused:
 * - a stale version gets a notice with Reload, which fetches the location as it is now so the
 *   person can save again;
 * - a taken name, and each field the API names in a 400 (`issues`), are for the dialog to show
 *   beside the field and in its summary.
 */
export function useLocationWrite() {
  const action = useAdminAction();
  const router = useRouter();
  const [refusal, setRefusal] = useState<LocationRefusal | null>(null);
  const [issues, setIssues] = useState<readonly unknown[] | undefined>(undefined);

  const run = useCallback(
    async <T,>(
      write: () => Promise<AdminMutationResult<T>>,
      successMessage: string,
      stepUpAction: string,
    ) => {
      let refused: LocationRefusal | null = null;
      let named: readonly unknown[] | undefined;
      const ok = await action.run(
        async () => {
          const result = await write();
          if (!result.ok && result.kind === "conflict") {
            refused = result.currentVersion ? "stale" : "name_taken";
          }
          if (!result.ok && result.kind === "validation") named = result.issues;
          return result;
        },
        successMessage,
        stepUpAction,
      );
      setRefusal(refused);
      setIssues(named);
      return ok;
    },
    [action.run],
  );

  const error =
    refusal === "stale" ? (
      <Notice
        tone="warning"
        alert
        title="Someone else changed this location"
        actions={
          <StaffButton
            size="sm"
            variant="secondary"
            icon={<RotateCw aria-hidden />}
            onClick={() => {
              setRefusal(null);
              router.refresh();
            }}
          >
            Reload
          </StaffButton>
        }
      >
        Reload to see their change, then try again.
      </Notice>
    ) : refusal === "name_taken" || issues?.length ? null : (
      action.error
    );

  return {
    run,
    refusal,
    /** The fields the API named in a 400, as `[{ field, message }]`. */
    issues,
    pending: action.pending,
    idempotencyKey: action.idempotencyKey,
    error,
    stepUpDialog: action.stepUpDialog,
  };
}
