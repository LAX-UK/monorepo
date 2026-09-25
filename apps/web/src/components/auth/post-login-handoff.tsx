"use client";

import { HostedLoginSync } from "@/components/analytics/hosted-login-sync";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const EFFECTS_WAIT_MS = 400;

export function PostLoginHandoff({
  destination,
  entryIntent,
}: {
  destination: string;
  entryIntent?: string | null;
}) {
  const router = useRouter();
  const navigated = useRef(false);

  const navigate = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(destination);
  }, [destination, router]);

  useEffect(() => {
    const timer = window.setTimeout(navigate, EFFECTS_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return <HostedLoginSync entryIntent={entryIntent ?? null} onEffectsReady={navigate} />;
}
