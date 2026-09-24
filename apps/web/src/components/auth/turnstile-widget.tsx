"use client";

import type { TurnstileWidgetApi } from "@/lib/auth/hooks/use-turnstile-field";
import { TURNSTILE_LOAD_ERROR_MESSAGE } from "@/lib/auth/turnstile-after-submit";
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
      reset?: (widgetId: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

type Props = {
  siteKey: string | undefined;
  onToken: (token: string) => void;
  onClear?: () => void;
  onError?: () => void;
  onReady?: (api: TurnstileWidgetApi) => void;
};

export function TurnstileWidget({ siteKey, onToken, onClear, onError, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [widgetError, setWidgetError] = useState(false);

  const onTokenCb = useCallback(
    (t: string) => {
      setWidgetError(false);
      onToken(t);
    },
    [onToken],
  );

  const resetWidget = useCallback(() => {
    const id = widgetIdRef.current;
    if (id && window.turnstile?.reset) {
      window.turnstile.reset(id);
    }
  }, []);

  useEffect(() => {
    if (!apiReady || !siteKey || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onTokenCb,
      "expired-callback": () => onClear?.(),
      "error-callback": () => {
        setWidgetError(true);
        onClear?.();
        onError?.();
      },
    });
    onReady?.({ reset: resetWidget });
    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [apiReady, siteKey, onTokenCb, onClear, onError, onReady, resetWidget]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setApiReady(true)}
        onError={() => {
          setWidgetError(true);
          onError?.();
        }}
      />
      <div ref={containerRef} className="flex justify-center" />
      {widgetError ? (
        <output
          className="block text-center font-footer-links text-sm text-error"
          aria-live="polite"
        >
          {TURNSTILE_LOAD_ERROR_MESSAGE}
        </output>
      ) : null}
    </>
  );
}
