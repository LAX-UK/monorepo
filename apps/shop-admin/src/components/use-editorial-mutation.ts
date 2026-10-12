"use client";

import { editorialMutationErrorMessage } from "@/lib/editorial-mutation-message";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export type EditorialStatus = { tone: "success" | "error"; text: string; stepUp?: boolean } | null;

export function useEditorialMutation() {
  const router = useRouter();
  const [status, setStatus] = useState<EditorialStatus>(null);
  const [pending, setPending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const run = useCallback(
    async <T>(
      action: (idempotencyKey: string) => Promise<AdminMutationResult<T>>,
      copy: { action: string; success?: string; refresh?: boolean },
    ): Promise<T | null> => {
      setPending(true);
      setStatus(null);
      let result: AdminMutationResult<T>;
      try {
        result = await action(idempotencyKey);
      } catch {
        result = { ok: false, kind: "failed", message: "" };
      } finally {
        setPending(false);
      }
      if (!result.ok) {
        setStatus({
          tone: "error",
          text: editorialMutationErrorMessage(result, copy.action),
          stepUp: result.kind === "step_up_required",
        });
        return null;
      }
      setIdempotencyKey(crypto.randomUUID());
      if (copy.success) setStatus({ tone: "success", text: copy.success });
      if (copy.refresh !== false) router.refresh();
      return result.data;
    },
    [idempotencyKey, router],
  );

  return { status, setStatus, pending, run };
}
