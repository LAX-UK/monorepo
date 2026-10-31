/**
 * Shortcut key caps, as a plain module (no "use client") so server code and the hotkey registry
 * can format keys too. `ShortcutKeys` draws them.
 */
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
