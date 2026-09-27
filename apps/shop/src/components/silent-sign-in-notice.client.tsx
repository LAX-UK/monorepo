"use client";

import { SHOP_SILENT_NOTICE_COOKIE } from "@/lib/silent-sign-in/config";
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

type SilentSignInNoticeProps = {
  logoutActionUrl: string;
  displayName: string | null;
  email: string | null;
};

/** One-shot modal after a silent cross-product sign-in success on Shop. */
export function SilentSignInNotice({
  logoutActionUrl,
  displayName,
  email,
}: SilentSignInNoticeProps) {
  const [open, setOpen] = useState(false);
  const pendingNotice = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (consumeNoticeCookie(SHOP_SILENT_NOTICE_COOKIE)) {
      pendingNotice.current = true;
    }
  }, []);

  useEffect(() => {
    if (!pendingNotice.current || !email) return;
    pendingNotice.current = false;
    setOpen(true);
  }, [email]);

  const dismiss = useCallback(() => {
    setOpen(false);
  }, []);

  const signOut = useCallback(() => {
    setOpen(false);
    formRef.current?.requestSubmit();
  }, []);

  if (!email || !open) {
    return (
      <form ref={formRef} action={logoutActionUrl} method="post" className="hidden" aria-hidden />
    );
  }

  const maskedEmail = maskAccountEmail(email);
  const name = displayName?.trim() || maskedEmail;

  return (
    <>
      <form ref={formRef} action={logoutActionUrl} method="post" className="hidden" aria-hidden />
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
            <strong className="font-medium text-on-surface">{name}</strong> ({maskedEmail}).
          </DialogDescription>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="button" className="w-full" onClick={dismiss}>
              Continue
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
              Not you? Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
