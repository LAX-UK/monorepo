import "server-only";

import {
  ACCOUNT_NOTICE_COOKIE,
  ACCOUNT_NOTICE_MAX_AGE_SEC,
  type AccountNotice,
  encodeAccountNotice,
} from "@/lib/navigation/account-notice";
import { cookies } from "next/headers";
import type { HopPlan } from "./account-hops";
import { ACTING_LEGAL_ENTITY_COOKIE } from "./client-acting-context";
import { RESTORE_MARKER_COOKIE, RESTORE_MARKER_MAX_AGE_SEC } from "./restore-loop";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** A cookie to write: the same description serves `cookies()` and a `NextResponse`. */
export type CookieSpec = {
  name: string;
  value: string;
  options: {
    path: "/";
    maxAge: number;
    sameSite: "lax";
    httpOnly: boolean;
    secure: boolean;
  };
};

function secure(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * The account this browser uses Bid as. The cookie is readable by scripts because the browser
 * sends it as `X-Legal-Entity-Id` on API calls.
 */
export function actingAccountCookie(legalEntityId: string): CookieSpec {
  return {
    name: ACTING_LEGAL_ENTITY_COOKIE,
    value: legalEntityId,
    options: {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax",
      httpOnly: false,
      secure: secure(),
    },
  };
}

/** A one-time notice for the next page; see `account-notice.ts`. */
export function accountNoticeCookie(notice: AccountNotice): CookieSpec {
  return {
    name: ACCOUNT_NOTICE_COOKIE,
    value: encodeAccountNotice(notice),
    options: {
      path: "/",
      maxAge: ACCOUNT_NOTICE_MAX_AGE_SEC,
      sameSite: "lax",
      httpOnly: false,
      secure: secure(),
    },
  };
}

/** Left by a restore so the layout can tell a restore that did not take; see `restore-loop.ts`. */
export function restoreMarkerCookie(): CookieSpec {
  return {
    name: RESTORE_MARKER_COOKIE,
    value: "1",
    options: {
      path: "/",
      maxAge: RESTORE_MARKER_MAX_AGE_SEC,
      sameSite: "lax",
      httpOnly: true,
      secure: secure(),
    },
  };
}

/** The cookies a hop plan writes: the account, then the notice when there is one. */
export function cookiesForHop(plan: HopPlan): CookieSpec[] {
  if (!plan.switchTo) return [];
  const { accountId, notice } = plan.switchTo;
  return [actingAccountCookie(accountId), ...(notice ? [accountNoticeCookie(notice)] : [])];
}

async function writeCookie(spec: CookieSpec): Promise<void> {
  (await cookies()).set(spec.name, spec.value, spec.options);
}

/** Only a server action or a route handler may call these (server components cannot set cookies). */
export async function writeActingAccountCookie(legalEntityId: string): Promise<void> {
  await writeCookie(actingAccountCookie(legalEntityId));
}

export async function writeAccountNoticeCookie(notice: AccountNotice): Promise<void> {
  await writeCookie(accountNoticeCookie(notice));
}

export async function writeRestoreMarkerCookie(): Promise<void> {
  await writeCookie(restoreMarkerCookie());
}
