"use client";

import { SHOP_SILENT_NOTICE_COOKIE } from "@/lib/silent-sign-in/config";
import { MarketingSignedInToast, signedInFirstName } from "@auction/marketing-ui";
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

/** One-shot toast after a silent cross-product sign-in success on Shop. */
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

  const dismiss = useCallback(() => setOpen(false), []);

  const signOut = useCallback(() => {
    setOpen(false);
    formRef.current?.requestSubmit();
  }, []);

  return (
    <>
      <form ref={formRef} action={logoutActionUrl} method="post" className="hidden" aria-hidden />
      {email ? (
        <MarketingSignedInToast
          open={open}
          firstName={signedInFirstName(displayName, email)}
          onDismiss={dismiss}
          onNotYou={signOut}
        />
      ) : null}
    </>
  );
}
