import "server-only";

import {
  ACCOUNT_NOTICE_COOKIE,
  ACCOUNT_NOTICE_MAX_AGE_SEC,
  type AccountNotice,
  encodeAccountNotice,
} from "@/lib/navigation/account-notice";
import { cookies } from "next/headers";
import { ACTING_LEGAL_ENTITY_COOKIE } from "./client-acting-context";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Writes the account this browser uses Bid as. Only a server action or a route handler may call
 * it (server components cannot set cookies). The cookie is readable by scripts because the
 * browser sends it as `X-Legal-Entity-Id` on API calls.
 */
export async function writeActingAccountCookie(legalEntityId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTING_LEGAL_ENTITY_COOKIE, legalEntityId, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Leaves a one-time notice for the next page; see `account-notice.ts`. */
export async function writeAccountNoticeCookie(notice: AccountNotice): Promise<void> {
  const jar = await cookies();
  jar.set(ACCOUNT_NOTICE_COOKIE, encodeAccountNotice(notice), {
    path: "/",
    maxAge: ACCOUNT_NOTICE_MAX_AGE_SEC,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}
