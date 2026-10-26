"use client";

import { useCallback, useState } from "react";

/** Announces reorder moves to screen readers via a polite live region. */
export function useMediaReorderAnnouncement() {
  const [message, setMessage] = useState("");

  const announceMove = useCallback((label: string, fromIndex: number, toIndex: number) => {
    setMessage(`Moved ${label} from position ${fromIndex + 1} to position ${toIndex + 1}.`);
  }, []);

  const clear = useCallback(() => setMessage(""), []);

  return { message, announceMove, clear };
}
