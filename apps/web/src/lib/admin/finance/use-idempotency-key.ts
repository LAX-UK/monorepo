"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * One idempotency key per form instance, made after mount so server and client markup match.
 * `rotate` issues a fresh key for the next, different request (for example when a dialog opens).
 */
export function useIdempotencyKey(): { key: string; rotate: () => void } {
  const [key, setKey] = useState("");
  const rotate = useCallback(() => setKey(crypto.randomUUID()), []);
  useEffect(() => {
    setKey(crypto.randomUUID());
  }, []);
  return { key, rotate };
}
