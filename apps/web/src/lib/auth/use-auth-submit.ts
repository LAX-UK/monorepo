"use client";
import type { AuthErrorCode } from "@/lib/auth/auth-error-code";
import type { SubmitService } from "@/lib/auth/submit-service";
import { useCallback, useState } from "react";

export function useAuthSubmit<TData>(onExecute: SubmitService<TData>) {
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [lastErrorCode, setLastErrorCode] = useState<AuthErrorCode | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (data: TData) => {
      setBannerError(null);
      setLastErrorCode(null);
      setLoading(true);
      const result = await onExecute(data);
      setLoading(false);
      if (!result.ok) {
        setBannerError(result.message);
        setLastErrorCode(result.code);
      }
      return result;
    },
    [onExecute],
  );

  return { run, loading, bannerError, lastErrorCode };
}
