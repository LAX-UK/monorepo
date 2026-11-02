"use client";

import { useLiveConnection } from "@/lib/connection/use-live-connection";
import { type ConnectionNoticeKind, connectionNoticeFor } from "@auction/domain";
import { useEffect, useRef, useState } from "react";

/** How often the clock is read while a loss or a recovery is being timed. */
const CHECK_EVERY_MS = 500;

type Memory = {
  /** When the connection last stopped being live; `null` while it is. */
  troubledSince: number | null;
  /** A loss notice was shown, so recovery deserves a confirmation. */
  shown: boolean;
  /** When the connection came back after a notice was shown. */
  restoredAt: number | null;
};

/**
 * The notice the live connection calls for: nothing while it is healthy, then reconnecting (or
 * slow, or paused) once a loss has lasted, and a brief confirmation when it recovers. The rules
 * are in the domain; this only keeps time.
 */
export function useConnectionNotice(): ConnectionNoticeKind | null {
  const { state } = useLiveConnection();
  const [notice, setNotice] = useState<ConnectionNoticeKind | null>(null);
  const memory = useRef<Memory>({ troubledSince: null, shown: false, restoredAt: null });

  useEffect(() => {
    const m = memory.current;
    const read = (): boolean => {
      const now = Date.now();
      if (state === "live") {
        if (m.troubledSince !== null) {
          m.restoredAt = m.shown ? now : null;
          m.troubledSince = null;
        }
      } else {
        m.troubledSince ??= now;
        m.restoredAt = null;
      }
      const kind = connectionNoticeFor({
        state,
        troubledForMs: m.troubledSince === null ? 0 : now - m.troubledSince,
        noticeWasShown: m.shown,
        restoredForMs: m.restoredAt === null ? null : now - m.restoredAt,
      });
      if (kind !== null && kind !== "restored") m.shown = true;
      if (kind === null && state === "live") {
        m.shown = false;
        m.restoredAt = null;
      }
      setNotice(kind);
      return state !== "live" || m.restoredAt !== null;
    };
    if (!read()) return;
    const id = setInterval(() => {
      if (!read()) clearInterval(id);
    }, CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, [state]);

  return notice;
}
