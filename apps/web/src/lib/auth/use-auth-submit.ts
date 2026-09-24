"use client";
import { type AuthErrorCode, authSubmitFailure } from "@/lib/auth/auth-error-code";
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
      try {
        const result = await onExecute(data);
        if (!result.ok) {
          setBannerError(result.message);
          setLastErrorCode(result.code);
        }
        return result;
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        const result = authSubmitFailure("unknown");
        setBannerError(result.message);
        setLastErrorCode(result.code);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [onExecute],
  );

  return { run, loading, bannerError, lastErrorCode };
}
