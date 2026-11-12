"use client";

import { trackSilentSignInResult } from "@/lib/analytics/events";
import { BID_SILENT_NOTICE_COOKIE } from "@/lib/auth/silent-sign-in/config";
import { useAppSession } from "@/lib/auth/use-app-session";
import { useLogout } from "@/lib/auth/use-logout";
import { setSignInNoticeActive } from "@/lib/ui/first-visit-overlays";
import {
  MarketingSignedInToast,
  signedInFirstName,
} from "@auction/marketing-ui/marketing-signed-in-toast";
import { useCallback, useEffect, useRef, useState } from "react";

function consumeNoticeCookie(cookieName: string): boolean {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=1(?:;|$)`));
  if (!match) return false;
  document.cookie = `${cookieName}=; Max-Age=0; path=/`;
  return true;
}

/** One-shot toast after a silent cross-product sign-in success on Bid. */
export function SilentSignInNotice() {
  const { user } = useAppSession();
  const { logout, pending: logoutPending } = useLogout();
  const [open, setOpen] = useState(false);
  const pendingNotice = useRef(false);
  const signedInTracked = useRef(false);

  useEffect(() => {
    if (consumeNoticeCookie(BID_SILENT_NOTICE_COOKIE)) {
      pendingNotice.current = true;
      // Hold the cookie banner and switcher hint back until the notice has been answered.
      setSignInNoticeActive(true);
    }
    return () => setSignInNoticeActive(false);
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
    setSignInNoticeActive(false);
  }, []);

  const signOut = useCallback(async () => {
    trackSilentSignInResult({ strategy: "redirect", outcome: "notice_sign_out" });
    setOpen(false);
    setSignInNoticeActive(false);
    await logout();
  }, [logout]);

  if (!user) return null;

  return (
    <MarketingSignedInToast
      open={open}
      firstName={signedInFirstName(user.name, user.email)}
      pending={logoutPending}
      onDismiss={dismiss}
      onNotYou={() => void signOut()}
    />
  );
}
