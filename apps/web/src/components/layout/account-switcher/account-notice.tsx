"use client";

import { ACCOUNT_NOTICE_COOKIE } from "@/lib/navigation/account-notice";
import { Button } from "@auction/ui/components/button";
import { ArrowLeftRight, X } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  message: string;
};

/**
 * A one-time line saying Bid changed the account for the person ("Switched to Northbank Gallery
 * to show this."). It clears its cookie as soon as it is shown, so it never repeats.
 */
export function AccountNotice({ message }: Props) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    document.cookie = `${ACCOUNT_NOTICE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }, []);

  if (!open) return null;
  return (
    <div
      aria-live="polite"
      data-testid="account-notice"
      className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low py-2.5 pr-2 pl-4"
    >
      <ArrowLeftRight
        className="mt-0.5 size-4 shrink-0 text-on-surface-variant"
        strokeWidth={1.75}
        aria-hidden
      />
      <p className="min-w-0 flex-1 py-px font-body text-sm text-on-surface">{message}</p>
      <Button
        variant="ghost"
        size="link"
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="-my-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
      >
        <X className="size-4" strokeWidth={1.75} aria-hidden />
      </Button>
    </div>
  );
}
