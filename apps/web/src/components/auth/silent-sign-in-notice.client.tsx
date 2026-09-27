"use client";

import { trackSilentSignInResult } from "@/lib/analytics/events";
import { BID_SILENT_NOTICE_COOKIE } from "@/lib/auth/silent-sign-in/config";
import { useAppSession } from "@/lib/auth/use-app-session";
import { useLogout } from "@/lib/auth/use-logout";
import { maskAccountEmail } from "@auction/lax-ecosystem";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { useCallback, useEffect, useRef, useState } from "react";

function consumeNoticeCookie(cookieName: string): boolean {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=1(?:;|$)`));
  if (!match) return false;
  document.cookie = `${cookieName}=; Max-Age=0; path=/`;
  return true;
}

/** One-shot modal after a silent cross-product sign-in success on Bid. */
export function SilentSignInNotice() {
  const { user } = useAppSession();
  const { logout, pending: logoutPending } = useLogout();
  const [open, setOpen] = useState(false);
  const pendingNotice = useRef(false);
  const signedInTracked = useRef(false);

  useEffect(() => {
    if (consumeNoticeCookie(BID_SILENT_NOTICE_COOKIE)) {
      pendingNotice.current = true;
    }
  }, []);

  useEffect(() => {
    if (!pendingNotice.current || !user) return;
    pendingNotice.current = false;
    setOpen(true);
    if (!signedInTracked.current) {
      signedInTracked.current = true;
      trackSilentSignInResult({ strategy: "redirect", outcome: "signed_in" });
    }
  }, [user]);

  const dismiss = useCallback(() => {
    trackSilentSignInResult({ strategy: "redirect", outcome: "notice_continue" });
    setOpen(false);
  }, []);

  const signOut = useCallback(async () => {
    trackSilentSignInResult({ strategy: "redirect", outcome: "notice_sign_out" });
    setOpen(false);
    await logout();
  }, [logout]);

  if (!user || !open) {
    return null;
  }

  const maskedEmail = maskAccountEmail(user.email);
  const displayName = user.name?.trim() || maskedEmail;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismiss();
      }}
    >
      <DialogContent
        data-testid="silent-sign-in-notice"
        className="max-w-sm"
        overlayProps={{ onClick: dismiss }}
      >
        <DialogTitle>You&apos;re signed in</DialogTitle>
        <DialogDescription className="text-left text-sm leading-relaxed">
          We signed you in with your LAX account as{" "}
          <strong className="font-medium text-on-surface">{displayName}</strong> ({maskedEmail}).
        </DialogDescription>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" className="w-full" onClick={dismiss}>
            Continue
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={logoutPending}
            onClick={() => void signOut()}
          >
            Not you? Sign out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
