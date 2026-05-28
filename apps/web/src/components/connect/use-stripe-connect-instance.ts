"use client";

import { useConnectAppearance } from "@/lib/connect/use-connect-appearance";
import { type StripeConnectInstance, loadConnectAndInitialize } from "@stripe/connect-js";
import { useEffect, useState } from "react";

type Options = {
  publishableKey: string;
  fetchClientSecret: () => Promise<string>;
};

export function useStripeConnectInstance({ publishableKey, fetchClientSecret }: Options) {
  const appearance = useConnectAppearance();
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: StripeConnectInstance | null = null;
    setError(null);
    setConnectInstance(null);

    try {
      instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret,
        appearance,
      });
      if (!cancelled) setConnectInstance(instance);
    } catch (err: unknown) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Could not load Stripe Connect.");
      }
    }

    return () => {
      cancelled = true;
      // Stripe Connect JS does not expose explicit teardown; drop the reference on unmount.
      instance = null;
      setConnectInstance(null);
    };
  }, [publishableKey, fetchClientSecret, appearance]);

  return { connectInstance, error };
}
