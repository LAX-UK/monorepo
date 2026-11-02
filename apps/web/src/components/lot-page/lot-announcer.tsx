"use client";

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

type Announce = (message: string) => void;

const NO_BREAK_SPACE = String.fromCharCode(160);

const AnnounceContext = createContext<Announce | null>(null);

/**
 * The lot page's one polite live region, for changes that concern the viewer: a bid accepted,
 * being outbid. Prices from other bidders are not announced, so a busy close does not flood a
 * screen reader. The visible page changes too; this carries the same words to those who can't see.
 */
export function LotAnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState({ text: "", tick: 0 });
  const announce = useCallback<Announce>((text) => {
    setMessage((previous) => ({ text, tick: previous.tick + 1 }));
  }, []);
  const value = useMemo(() => announce, [announce]);
  return (
    <AnnounceContext.Provider value={value}>
      {children}
      {/* The tick alternates a trailing space so the same sentence said twice is read twice. */}
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {message.text ? `${message.text}${message.tick % 2 === 0 ? NO_BREAK_SPACE : ""}` : ""}
      </output>
    </AnnounceContext.Provider>
  );
}

/** Says something in the page's live region; a no-op outside a lot page. */
export function useAnnounce(): Announce {
  return useContext(AnnounceContext) ?? NOOP;
}

const NOOP: Announce = () => undefined;
