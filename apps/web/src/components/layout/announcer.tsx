"use client";

import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";

type Politeness = "polite" | "assertive";

type Announce = (message: string, politeness?: Politeness) => void;

const AnnouncerContext = createContext<Announce>(() => {});

/** Say something to assistive tech without moving focus: `announce("Preferences saved")`. */
export function useAnnounce(): Announce {
  return useContext(AnnouncerContext);
}

/**
 * The site's one pair of live regions: a polite one for results ("Saved", "Slide 2 of 3") and an
 * assertive one kept for failures. Components announce through `useAnnounce` instead of each
 * mounting their own region, so messages never compete.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const flip = useRef(false);

  const announce = useCallback<Announce>((message, politeness = "polite") => {
    // A zero-width suffix alternates so repeating the same sentence is still announced.
    flip.current = !flip.current;
    const text = flip.current ? message : `${message}​`;
    if (politeness === "assertive") setAssertive(text);
    else setPolite(text);
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {polite}
      </output>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}
