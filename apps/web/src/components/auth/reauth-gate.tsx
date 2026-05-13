"use client";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-code";
import { Button } from "@auction/ui/components/button";
import { useCallback, useRef, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

/**
 * Intercepts 403 `recent_auth_required` by showing a password confirmation dialog,
 * calling `POST /auth/reauth`, then invoking `onAuthenticated`.
 * Wrap any sensitive action that may return 403 in `useReauthGate`.
 */
export function useReauthGate() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  const prompt = useCallback(
    (): Promise<void> =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setError(null);
        setOpen(true);
      }),
    [],
  );

  const submit = useCallback(async (password: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/auth/reauth`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const code = typeof body.code === "string" ? body.code : undefined;
        const msg =
          code === "invalid_credentials"
            ? AUTH_ERROR_MESSAGES.invalid_credentials
            : AUTH_ERROR_MESSAGES.unknown;
        setError(msg);
        return;
      }
      setOpen(false);
      resolveRef.current?.();
    } catch {
      setError(AUTH_ERROR_MESSAGES.unknown);
    } finally {
      setBusy(false);
    }
  }, []);

  return { open, setOpen, busy, error, prompt, submit };
}

export function ReauthDialog({
  open,
  onClose,
  onSubmit,
  busy,
  error,
  title = "Confirm your password",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  busy: boolean;
  error: string | null;
  title?: string;
}) {
  const [pw, setPw] = useState("");

  if (!open) return null;

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="reauth-dialog-title"
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-black/50 p-0 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-outline-variant/20 bg-surface p-6 shadow-xl">
        <h2 id="reauth-dialog-title" className="mb-4 font-headline text-base font-semibold">
          {title}
        </h2>
        <p className="mb-4 font-body text-sm text-on-surface-variant">
          For your security, enter your current password to continue.
        </p>
        {error ? (
          <p
            role="alert"
            className="mb-3 rounded-md border border-error/30 bg-error-container/10 px-3 py-2 font-body text-sm text-error"
          >
            {error}
          </p>
        ) : null}
        <label htmlFor="reauth-password" className="sr-only">
          Password
        </label>
        <input
          id="reauth-password"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="current-password"
          disabled={busy}
          aria-describedby={error ? "reauth-error" : undefined}
          className="mb-4 w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-primary"
          onKeyDown={(e) => {
            if (e.key === "Enter" && pw.trim()) onSubmit(pw.trim());
          }}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !pw.trim()}
            onClick={() => onSubmit(pw.trim())}
          >
            {busy ? "Checking…" : "Confirm"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
