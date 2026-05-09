"use client";
import type { SubmitService } from "@/lib/auth/submit-service";
import { useCallback, useState } from "react";

export function useAuthSubmit<TData>(onExecute: SubmitService<TData>) {
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
