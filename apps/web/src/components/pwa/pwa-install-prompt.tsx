"use client";

import { Button } from "@auction/ui/components/button";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "lax-pwa-install-dismissed";
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  return Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS;
}

function dismiss(): void {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

/** Chromium install CTA after meaningful engagement (dashboard visit). */
export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!deferredPrompt || isDismissed()) return;
    if (pathname.startsWith("/dashboard")) {
      setVisible(true);
    }
  }, [pathname, deferredPrompt]);

  const onInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setBusy(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setVisible(false);
      setDeferredPrompt(null);
    } finally {
      setBusy(false);
    }
  }, [deferredPrompt]);

  const onDismiss = useCallback(() => {
    dismiss();
    setVisible(false);
  }, []);

  if (!visible || !deferredPrompt) return null;

  return (
    <div
      // biome-ignore lint/a11y/useSemanticElements: non-modal install CTA; native dialog showModal is heavier
      role="dialog"
      aria-label="Install LAX app"
      className="fixed inset-x-4 bottom-[calc(var(--bottom-chrome-total,0px)+1rem)] z-[var(--z-banner,50)] mx-auto max-w-md rounded-lg border border-outline bg-surface-container-low p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-sm font-medium text-on-surface">Install LAX</p>
          <p className="mt-1 font-body text-xs text-on-surface-variant">
            Add LAX to your home screen for faster access and outbid alerts.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="shrink-0 text-on-surface-variant"
          aria-label="Dismiss install prompt"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void onInstall()}>
          {busy ? "Installing…" : "Install"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
