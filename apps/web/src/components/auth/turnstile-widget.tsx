"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

type Props = {
  siteKey: string | undefined;
  onToken: (token: string) => void;
  onClear?: () => void;
};

export function TurnstileWidget({ siteKey, onToken, onClear }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [apiReady, setApiReady] = useState(false);

  const onTokenCb = useCallback(
    (t: string) => {
      onToken(t);
    },
    [onToken],
  );

  useEffect(() => {
    if (!apiReady || !siteKey || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onTokenCb,
      "expired-callback": () => onClear?.(),
      "error-callback": () => onClear?.(),
    });
    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [apiReady, siteKey, onTokenCb, onClear]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        onLoad={() => setApiReady(true)}
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}
