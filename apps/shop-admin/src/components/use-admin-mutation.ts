"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { toast } from "@auction/staff-ui";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

/**
 * Runs a server action for a form. A success is a passing toast and a data refresh; a failure stays
 * in `message` so the form can show it inline until the next attempt.
 */
export function useAdminMutation() {
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);
  const [stepUpRequired, setStepUpRequired] = useState(false);
  const [pending, setPending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const stepUpHref = useMemo(
    () => `/api/auth/login?returnTo=${encodeURIComponent(pathname || "/")}`,
    [pathname],
  );

  const run = useCallback(
    async <T = unknown>(
      action: () => Promise<AdminMutationResult<T>>,
      /** A message, or one made from what the server answered (a refund that took a frame too). */
      successMessage: string | ((data: T) => string),
    ) => {
      setPending(true);
      setMessage(null);
      setStepUpRequired(false);
      let result: AdminMutationResult<T>;
      try {
        result = await action();
      } catch {
        result = { ok: false, kind: "failed", message: "Action failed. Try again." };
      } finally {
        setPending(false);
      }
      if (!result.ok) {
        setStepUpRequired(result.kind === "step_up_required");
        setMessage(adminMutationErrorMessage(result));
        return false;
      }
      setIdempotencyKey(crypto.randomUUID());
      toast.success(
        typeof successMessage === "function" ? successMessage(result.data) : successMessage,
      );
      router.refresh();
      return true;
    },
    [router],
  );

  return {
    message,
    stepUpRequired,
    stepUpHref,
    pending,
    idempotencyKey,
    run,
  };
}

export type AdminMutation = ReturnType<typeof useAdminMutation>;
