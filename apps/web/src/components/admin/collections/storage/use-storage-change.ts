"use client";

import type { StorageActionResult } from "@/lib/actions/admin/admin-collection-storage";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import type { StaffStorageSettings } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

/** A change the API refused, as the tab shows it. */
export type StorageFailure = {
  message: string;
  code: string | undefined;
  /** The fields at fault, by the name the API gave them. */
  issues: { field: string; message: string }[];
};

export type StorageRun =
  | { ok: true; settings: StaffStorageSettings }
  | { ok: false; failure: StorageFailure | null };

const issuesOf = (value: unknown): StorageFailure["issues"] =>
  Array.isArray(value)
    ? value.filter(
        (issue): issue is { field: string; message: string } =>
          typeof issue?.field === "string" && typeof issue?.message === "string",
      )
    : [];

/**
 * One change to the storage terms or the switch. A second press while the first is in flight
 * does nothing, so a change is never sent twice. A stale sign-in sends the person to sign in again
 * (`failure: null`); any other refusal comes back with its sentence and the fields at fault.
 */
export function useStorageChange() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async (send: () => Promise<StorageActionResult>): Promise<StorageRun> => {
      if (inFlight.current) return { ok: false, failure: null };
      inFlight.current = true;
      setBusy(true);
      try {
        const result = await send();
        if (result.ok) {
          router.refresh();
          return result.data ? { ok: true, settings: result.data } : { ok: false, failure: null };
        }
        if (handleStaffStepUp(result)) return { ok: false, failure: null };
        return {
          ok: false,
          failure: {
            message: result.error,
            code: result.errorCode,
            issues: issuesOf(result.meta?.issues),
          },
        };
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [router],
  );

  return { busy, run };
}
