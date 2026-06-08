"use client";

import { useConnectAppearance } from "@/lib/connect/use-connect-appearance";
import { type StripeConnectInstance, loadConnectAndInitialize } from "@stripe/connect-js";
import { useEffect, useRef, useState } from "react";

type Options = {
  publishableKey: string;
  fetchClientSecret: () => Promise<string>;
};

export function useStripeConnectInstance({ publishableKey, fetchClientSecret }: Options) {
  const appearance = useConnectAppearance();
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const instanceRef = useRef<StripeConnectInstance | null>(null);
  const fetchClientSecretRef = useRef(fetchClientSecret);
  fetchClientSecretRef.current = fetchClientSecret;

  // biome-ignore lint/correctness/useExhaustiveDependencies: appearance applied via instance.update() — do not recreate on theme change
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setConnectInstance(null);
    instanceRef.current = null;

    try {
      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: () => fetchClientSecretRef.current(),
        appearance,
      });
      instanceRef.current = instance;
      if (!cancelled) setConnectInstance(instance);
    } catch (err: unknown) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Could not load Stripe Connect.");
      }
    }

    return () => {
      cancelled = true;
      instanceRef.current = null;
      setConnectInstance(null);
    };
  }, [publishableKey]);

  useEffect(() => {
    instanceRef.current?.update({ appearance });
  }, [appearance]);

  return { connectInstance, error };
}
