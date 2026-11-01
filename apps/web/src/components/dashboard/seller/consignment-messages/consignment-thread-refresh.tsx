"use client";

import { markConsignmentMessagesReadAction } from "@/lib/actions/consignment-messages";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** The thread is read again at most this often while it is open, and on return to the tab. */
const REFRESH_MS = 60_000;
/** Coming back to the tab reads the thread again unless it was read this recently. */
const FOCUS_GAP_MS = 30_000;

/**
 * Keeps an open thread current without a socket: it reads the thread again every minute while
 * the page is visible, and when the person comes back to it. Opening it marks the specialist's
 * messages read for the people who answer (`markRead`), then reads the page again so Home, the
 * sidebar count and Needs you drop the task.
 */
export function ConsignmentThreadRefresh({
  submissionId,
  markRead,
  unread,
}: {
  submissionId: string;
  /** Whether this member's reading clears the task (the people who answer). */
  markRead: boolean;
  /** The specialist's unread messages now; a new one that arrives while open is marked too. */
  unread: number;
}) {
  const router = useRouter();
  const last = useRef(Date.now());

  useEffect(() => {
    if (!markRead || unread === 0) return;
    let cancelled = false;
    void markConsignmentMessagesReadAction(submissionId).then((result) => {
      if (!cancelled && result.ok && (result.data?.marked ?? 0) > 0) {
        last.current = Date.now();
        router.refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [markRead, unread, router, submissionId]);

  useEffect(() => {
    const refresh = () => {
      last.current = Date.now();
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last.current >= FOCUS_GAP_MS) {
        refresh();
      }
    };
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  return null;
}
