import { useCallback, useRef } from "react";

export function useIdempotencyKey() {
  const keyRef = useRef<string | null>(null);

  const ensure = useCallback((): string => {
    if (!keyRef.current) {
      keyRef.current = crypto.randomUUID();
    }
    return keyRef.current;
  }, []);

  const clear = useCallback(() => {
    keyRef.current = null;
  }, []);

  return { ensure, clear };
}
