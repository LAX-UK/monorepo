"use client";

import * as React from "react";
import { cn } from "../lib/utils.js";
import { shortcutKeyCaps } from "./shortcut-key-caps.js";

/** A keyboard hint, e.g. ⌘K. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-lax-badge border border-lax-line bg-lax-sunken px-1 font-lax text-lax-2xs font-medium text-lax-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * "g o" as two key caps, "mod+s" as ⌘ S (Ctrl S off a Mac), "?" as itself, through
 * `shortcutKeyCaps`. The server renders ⌘ and the browser corrects it after mount, so the first
 * paint matches.
 */
export function ShortcutKeys({
  keys,
  className,
  sequence = "then",
}: {
  keys: string;
  className?: string;
  /** How the steps of a sequence read: "G then H", or just the key caps side by side. */
  sequence?: "then" | "caps";
}) {
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  const steps = shortcutKeyCaps(keys, { mac });
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {steps.map((caps, index) => (
        <React.Fragment key={`${caps.join("+")}-${index.toString()}`}>
          {index > 0 && sequence === "then" ? (
            <span className="text-lax-12 text-lax-subtle">then</span>
          ) : null}
          {caps.map((cap, capIndex) => (
            <Kbd key={`${cap}-${capIndex.toString()}`}>{cap}</Kbd>
          ))}
        </React.Fragment>
      ))}
    </span>
  );
}
