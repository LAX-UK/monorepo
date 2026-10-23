"use client";

import { NoticeTitle } from "@/components/account-ui";
import {
  browserLocalStorage,
  dismissCompleteAccountPrompt,
  isCompleteAccountPromptDismissed,
} from "@/lib/complete-account-dismissal";
import { MarketingCloseIcon, MarketingInfoIcon } from "@auction/marketing-ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
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
    <Alert variant="inverse" role="note" className="rounded-lg py-4 pr-12">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss"
        className="absolute top-1 right-1 text-cta-on hover:bg-cta-on/10 hover:text-cta-on focus-visible:ring-cta-on"
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
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 focus-visible:outline-current"
        >
          Complete account
        </a>
      </div>
    </Alert>
  );
}
