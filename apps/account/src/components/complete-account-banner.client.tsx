"use client";

import { Button } from "@/components/account-button";
import { NoticeTitle } from "@/components/account-ui";
import {
  browserLocalStorage,
  dismissCompleteAccountPrompt,
  isCompleteAccountPromptDismissed,
} from "@/lib/complete-account-dismissal";
import { MarketingCloseIcon, MarketingInfoIcon } from "@auction/marketing-ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { useEffect, useState } from "react";

/**
 * "You're almost ready" prompt (Figma 930:14088). It renders after hydration, once storage
 * is read, so it uses `note` rather than the default `alert` role to avoid an interruption.
 */
export function CompleteAccountBanner({ gapsKey, href }: { gapsKey: string; href: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isCompleteAccountPromptDismissed(browserLocalStorage(), gapsKey));
  }, [gapsKey]);

  if (!visible) return null;

  return (
    <Alert
      variant="default"
      role="note"
      className="rounded-2xl border-border-hairline bg-surface py-4 pr-12 sm:pl-6"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss"
        className="absolute top-1 right-1"
        onClick={() => {
          dismissCompleteAccountPrompt(browserLocalStorage(), gapsKey);
          setVisible(false);
        }}
      >
        <MarketingCloseIcon />
      </Button>
      <MarketingInfoIcon />
      <div>
        <NoticeTitle>You're almost ready</NoticeTitle>
        <AlertDescription>Add a few more details to complete your account.</AlertDescription>
        <a
          href={href}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-on-surface underline underline-offset-4"
        >
          Complete account
        </a>
      </div>
    </Alert>
  );
}
