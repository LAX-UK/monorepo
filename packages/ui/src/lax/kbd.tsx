"use client";

import * as React from "react";
import { cn } from "../lib/utils.js";

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

const KEY_NAMES: Record<string, string> = {
  shift: "Shift",
  alt: "⌥",
  ctrl: "Ctrl",
  control: "Ctrl",
  meta: "⌘",
  enter: "↵",
  escape: "Esc",
  esc: "Esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

/**
 * The key caps for a shortcut, one array per step of a sequence: "g h" → [["G"], ["H"]],
 * "mod+k" → [["⌘", "K"]] (Ctrl off a Mac), "shift+?" → [["?"]], since a symbol already implies
 * Shift. Accepts the kit's syntax and tinykeys' ("$mod+k", "Shift+?"). Letters show as upper-case
 * key caps; named keys read in sentence case ("Shift", "Esc"), never in capitals.
 */
export function shortcutKeyCaps(keys: string, { mac = true }: { mac?: boolean } = {}): string[][] {
  return keys
    .trim()
    .split(/\s+/)
    .map((step) => {
      // "+" may itself be the key: "+" alone, or "mod++".
      const parts =
        step === "+"
          ? ["+"]
          : step.endsWith("++")
            ? [...step.slice(0, -2).split("+"), "+"]
            : step.split("+");
      const key = parts[parts.length - 1] ?? "";
      const symbol = key.length === 1 && !/[a-z0-9]/i.test(key);
      return parts
        .filter(
          (part, index) => !(symbol && index < parts.length - 1 && part.toLowerCase() === "shift"),
        )
        .map((part) => {
          const name = part.replace(/^\$/, "").toLowerCase();
          if (name === "mod") return mac ? "⌘" : "Ctrl";
          if (KEY_NAMES[name]) return KEY_NAMES[name];
          if (part.length === 1) return part.toUpperCase();
          return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
        });
    });
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
