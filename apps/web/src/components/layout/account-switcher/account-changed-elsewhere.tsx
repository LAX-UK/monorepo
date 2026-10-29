"use client";

import {
  accountChangedElsewhere,
  onAccountSwitch,
} from "@/lib/legal-entity/account-switch-channel";
import { getClientActingLegalEntityId } from "@/lib/legal-entity/client-acting-context";
import {
  ACCOUNT_NOTICE_COOKIE,
  ACCOUNT_NOTICE_MAX_AGE_SEC,
  encodeAccountNotice,
} from "@/lib/navigation/account-notice";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  /** The account this page was rendered for; `null` renders nothing to keep in step. */
  renderedAccountId: string | null;
};

/**
 * Keeps an open tab honest after the person switches account in another one. The acting cookie
 * is shared, so this tab's next click would already act for the new account while the page still
 * named the old one. As soon as the person is looking at this tab (straight away when it is in
 * view, otherwise when they come back to it) it re-renders for the new account and leaves a
 * one-time notice saying why, so the change is never silent.
 */
export function AccountChangedElsewhere({ renderedAccountId }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!renderedAccountId) return;
    const follow = (browserAccountId: string | null | undefined) => {
      if (!browserAccountId || !accountChangedElsewhere(renderedAccountId, browserAccountId)) {
        return;
      }
      const notice = encodeAccountNotice({
        kind: "switched_elsewhere",
        accountId: browserAccountId,
      });
      document.cookie = `${ACCOUNT_NOTICE_COOKIE}=${notice}; path=/; max-age=${ACCOUNT_NOTICE_MAX_AGE_SEC}; SameSite=Lax`;
      router.refresh();
    };
    const followWhenSeen = () => {
      if (document.visibilityState === "visible") follow(getClientActingLegalEntityId());
    };
    const unsubscribe = onAccountSwitch(followWhenSeen);
    document.addEventListener("visibilitychange", followWhenSeen);
    window.addEventListener("focus", followWhenSeen);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", followWhenSeen);
      window.removeEventListener("focus", followWhenSeen);
    };
  }, [renderedAccountId, router]);

  return null;
}
