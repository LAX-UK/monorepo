import "server-only";

import { getServerSessionUser } from "@/lib/data/http/session.server";
import { cookies } from "next/headers";
import {
  type FinanceNoticeContent,
  financeNoticeContent,
  financeNoticeCookieName,
  financeNoticeDismissCookie,
  showFinanceNotice,
} from "./finance-notice";

export type FinanceNoticeModel = { content: FinanceNoticeContent; dismissCookie: string } | null;

/** The rule notice for the signed-in person, or null once they have dismissed it or it ended. */
export async function loadFinanceNotice(now: Date = new Date()): Promise<FinanceNoticeModel> {
  const user = await getServerSessionUser().catch(() => null);
  if (!user) return null;
  const jar = await cookies();
  const dismissed = jar.get(financeNoticeCookieName(user.id))?.value === "1";
  if (!showFinanceNotice({ dismissed, now })) return null;
  return {
    content: financeNoticeContent(now),
    dismissCookie: financeNoticeDismissCookie(user.id, now),
  };
}
