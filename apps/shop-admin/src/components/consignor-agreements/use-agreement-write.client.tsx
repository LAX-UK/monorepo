"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { Notice, StaffButton } from "@auction/staff-ui";
import { RotateCw } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * A write to a consignor's agreements, or to an artwork's consignor, from a dialog. On top of
 * `useAdminAction` (toast, refresh, "Confirm it's you" for a sign-in that is not recent), it reads
 * what the API refused:
 * - a stale version (someone changed the record meanwhile) gets a notice with Reload, which
 *   fetches it as it is now;
 * - each field the API names in a 400 (`issues`) is for the dialog to show beside the field.
 */
export function useAgreementWrite({
  staleTitle = "Someone else changed this agreement",
}: {
  /** The notice's title when the API says the record changed since the page read it. */
  staleTitle?: string;
} = {}) {
  const action = useAdminAction();
  const router = useRouter();
  const [stale, setStale] = useState(false);
  const [issues, setIssues] = useState<readonly unknown[] | undefined>(undefined);

  const run = useCallback(
    async <T,>(
      write: () => Promise<AdminMutationResult<T>>,
      successMessage: string,
      stepUpAction: string,
    ) => {
      let refusedStale = false;
      let named: readonly unknown[] | undefined;
      const ok = await action.run(
        async () => {
          const result = await write();
          if (!result.ok && result.kind === "conflict")
            refusedStale = Boolean(result.currentVersion);
          if (!result.ok && result.kind === "validation") named = result.issues;
          return result;
        },
        successMessage,
        stepUpAction,
      );
      setStale(refusedStale);
      setIssues(named);
      return ok;
    },
    [action.run],
  );

  const error = stale ? (
    <Notice
      tone="warning"
      alert
      title={staleTitle}
      actions={
        <StaffButton
          size="sm"
          variant="secondary"
          icon={<RotateCw aria-hidden />}
          onClick={() => {
            setStale(false);
            router.refresh();
          }}
        >
          Reload
        </StaffButton>
      }
    >
      Reload to see their change, then try again.
    </Notice>
  ) : issues?.length ? null : (
    action.error
  );

  return {
    run,
    /** The fields the API named in a 400, as `[{ field, message }]`. */
    issues,
    pending: action.pending,
    idempotencyKey: action.idempotencyKey,
    error,
    stepUpDialog: action.stepUpDialog,
  };
}
