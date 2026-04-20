"use client";

import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import { useCallback, useState } from "react";

export function useAuthSubmit<TData>(onExecute: (data: TData) => Promise<AuthSubmitResult>) {
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (data: TData) => {
      setBannerError(null);
      setLoading(true);
      const result = await onExecute(data);
      setLoading(false);
      if (!result.ok) {
        setBannerError(result.message);
      }
      return result;
    },
    [onExecute],
  );

  return { run, loading, bannerError };
}
