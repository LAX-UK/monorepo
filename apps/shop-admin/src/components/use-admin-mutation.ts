"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

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
    async (action: () => Promise<AdminMutationResult<unknown>>, successMessage: string) => {
      setPending(true);
      setMessage(null);
      setStepUpRequired(false);
      const result = await action();
      setPending(false);
      if (!result.ok) {
        setStepUpRequired(result.kind === "step_up_required");
        setMessage(adminMutationErrorMessage(result));
        return false;
      }
      setIdempotencyKey(crypto.randomUUID());
      setMessage(successMessage);
      router.refresh();
      return true;
    },
    [router],
  );

  return {
    message,
    setMessage,
    stepUpRequired,
    stepUpHref,
    pending,
    idempotencyKey,
    run,
  };
}
