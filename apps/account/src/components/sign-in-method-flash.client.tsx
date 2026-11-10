"use client";

import { Button } from "@/components/account-button";
import { NOTICE, NoticeTitle } from "@/components/account-ui";
import type {
  SignInMethodFlashTone,
  SignInMethodFlashVm,
} from "@/server/domain/account-sign-in-methods.vm";
import { cn } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { useEffect, useRef } from "react";

const VARIANT = {
  success: "success",
  neutral: "default",
  warning: "warning",
  error: "destructive",
} as const satisfies Record<SignInMethodFlashTone, string>;

type SignInMethodFlashProps = {
  flash: SignInMethodFlashVm;
  /** The Security page's own address, which the notice puts back in the address bar. */
  pagePath: string;
  /** A fresh sign-in that comes back to this page, for the outcome that asks for one. */
  reauthHref: string;
};

/**
 * What happened when the issuer sent the person back from Google or Apple. The notice is drawn on
 * the server from the fixed word in the address; once it is on screen it takes focus, so a screen
 * reader reads it, and the word is taken out of the address so a refresh or a shared link does not
 * show it again. Nothing from the address is ever shown.
 */
export function SignInMethodFlash({ flash, pagePath, reauthHref }: SignInMethodFlashProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    // replaceState, not a navigation: the page is already showing the notice and needs no reload.
    window.history.replaceState(window.history.state, "", pagePath);
  }, [pagePath]);

  const calm = flash.tone === "success" || flash.tone === "neutral";
  return (
    <Alert
      ref={ref}
      variant={VARIANT[flash.tone]}
      role={calm ? "status" : "alert"}
      tabIndex={-1}
      data-sign-in-method-flash={flash.tone}
      // Focus is moved here so a screen reader reads the notice; it is not a control, so it draws no ring.
      className={cn(NOTICE, "outline-none")}
    >
      <NoticeTitle level={3}>{flash.title}</NoticeTitle>
      <AlertDescription>{flash.body}</AlertDescription>
      {flash.reauth ? (
        <Button asChild variant="cta" className="mt-4 min-h-11">
          <a href={reauthHref}>Sign in again</a>
        </Button>
      ) : null}
    </Alert>
  );
}
