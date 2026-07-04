"use client";

import { AUTH_FOOTER_LINK_ROW } from "@/lib/auth/auth-link-classes";
import { confirmUnsubscribe } from "@/lib/data/http/email-unsubscribe.client";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useState, useTransition } from "react";

export function UnsubscribeForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <output
          className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface"
          aria-live="polite"
        >
          Your email preference has been updated.
        </output>
        <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
          <Link href="/dashboard/settings/notifications" prefetch>
            Manage all preferences
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="font-footer-links text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="cta"
        size="xl"
        className="font-headline shadow-none"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(() => {
            void (async () => {
              const result = await confirmUnsubscribe(token);
              if (result.ok) {
                setDone(true);
                return;
              }
              setError(result.error);
            })();
          });
        }}
      >
        {pending ? "Updating…" : "Confirm unsubscribe"}
      </Button>
      <Link href="/login" className={`text-center ${AUTH_FOOTER_LINK_ROW}`}>
        Sign in to manage preferences instead
      </Link>
    </div>
  );
}
