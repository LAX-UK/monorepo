"use client";

import { ShortcutKeys, TextInput } from "@auction/ui/lax";
import { Search } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffDialog } from "../panels/staff-dialog.js";

/*
 * Keyboard shortcuts for the staff tools: one registry the shell owns, so every page registers
 * its keys the same way and the `?` sheet always lists what works right now.
 *
 * Keys are written in lower case: a single key ("e", "/", "?"), a modifier combination
 * ("mod+s", where mod is ⌘ on a Mac and Ctrl elsewhere), or a two-key sequence ("g o").
 * Single-character shortcuts never fire while typing in a field, and people can turn them off
 * from the account menu (WCAG 2.1.4); modifier shortcuts keep working.
 */

export type StaffShortcut = {
  /** Unique per registration; a later registration with the same id replaces the earlier one. */
  id: string;
  keys: string;
  /** What it does, in the sheet and in tooltips: "Next record". */
  label: string;
  /** Where it applies, as the sheet's group: "Global", "Lists", "Records". */
  group: string;
  handler: (event: KeyboardEvent) => void;
  /** Also fire while focus is in a text field; for modifier combinations such as "mod+s". */
  allowInFields?: boolean;
  /**
   * Listed in the `?` sheet but handled where it applies (Enter on a focused row, Escape in a
   * panel), so the registry never intercepts it.
   */
  passive?: boolean;
};

type Registry = {
  register: (shortcut: StaffShortcut) => () => void;
  shortcuts: readonly StaffShortcut[];
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  openHelp: () => void;
  /** False when the app keeps its own `?` help, so the kit sheet is not offered. */
  helpAvailable: boolean;
};

const ShortcutsContext = React.createContext<Registry | null>(null);

/** The registry, when inside a `StaffShortcutsProvider` (the shell); null elsewhere. */
export function useStaffShortcuts(): Registry | null {
  return React.useContext(ShortcutsContext);
}

/** Where the on/off choice for single-key shortcuts is remembered in this browser. */
export const STAFF_SHORTCUTS_STORAGE_KEY = "staff.shortcuts";

/** How long the second key of a sequence ("g" then "o") is waited for. */
const SEQUENCE_TIMEOUT_MS = 1000;

/** True when a key press would type into a field rather than drive the page. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color"].includes(
      target.type,
    );
  }
  return Boolean(target.closest("[role=textbox],[role=combobox],[cmdk-input]"));
}

/** The key as written in a shortcut: "k", "?", "shift+j", "mod+s", "escape". */
function keyName(event: KeyboardEvent): string {
  const key = event.key.toLowerCase();
  if (event.metaKey || event.ctrlKey) return `mod+${key}`;
  if (event.altKey) return `alt+${key}`;
  // Shift is part of symbols such as "?", but turns a letter into a different shortcut.
  if (event.shiftKey && /^[a-z]$/.test(key)) return `shift+${key}`;
  return key;
}

function isSingleKey(keys: string): boolean {
  return !keys.includes("+");
}

/**
 * Holds the page's shortcuts, listens for them, and opens the `?` sheet. The shell mounts it;
 * pages register keys with `useStaffShortcut`.
 */
export function StaffShortcutsProvider({
  children,
  helpShortcut = true,
}: {
  children: React.ReactNode;
  /** `?` opens the shortcuts sheet. Off when the app already binds `?` itself. */
  helpShortcut?: boolean;
}) {
  const entries = React.useRef<StaffShortcut[]>([]);
  const [shortcuts, setShortcuts] = React.useState<readonly StaffShortcut[]>([]);
  const [enabled, setEnabledState] = React.useState(true);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const prefix = React.useRef<{ key: string; at: number } | null>(null);

  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(STAFF_SHORTCUTS_STORAGE_KEY) === "off") {
        setEnabledState(false);
      }
    } catch {
      // Storage unavailable: shortcuts stay on.
    }
  }, []);

  const setEnabled = React.useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(STAFF_SHORTCUTS_STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
  }, []);

  const register = React.useCallback((shortcut: StaffShortcut) => {
    entries.current = [...entries.current.filter((entry) => entry.id !== shortcut.id), shortcut];
    setShortcuts(entries.current);
    return () => {
      entries.current = entries.current.filter((entry) => entry !== shortcut);
      setShortcuts(entries.current);
    };
  }, []);

  const openHelp = React.useCallback(() => setHelpOpen(true), []);

  React.useEffect(() => {
    if (!helpShortcut) return;
    return register({
      id: "staff:shortcuts-help",
      keys: "?",
      label: "Show keyboard shortcuts",
      group: "Global",
      handler: () => setHelpOpen(true),
    });
  }, [helpShortcut, register]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (["Shift", "Meta", "Control", "Alt"].includes(event.key)) return;
      const typing = isTypingTarget(event.target);
      const name = keyName(event);
      const now = Date.now();
      const held =
        prefix.current && now - prefix.current.at < SEQUENCE_TIMEOUT_MS ? prefix.current : null;
      prefix.current = null;
      const candidates = held ? [`${held.key} ${name}`, name] : [name];
      const active = entries.current;
      for (const keys of candidates) {
        // The newest registration wins, so a page or dialog can take over a key.
        const match = [...active].reverse().find((entry) => !entry.passive && entry.keys === keys);
        if (!match) continue;
        if (typing && !match.allowInFields) return;
        if (!enabled && isSingleKey(match.keys)) return;
        event.preventDefault();
        match.handler(event);
        return;
      }
      if (!typing && active.some((entry) => !entry.passive && entry.keys.startsWith(`${name} `))) {
        prefix.current = { key: name, at: now };
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  const value = React.useMemo(
    () => ({ register, shortcuts, enabled, setEnabled, openHelp, helpAvailable: helpShortcut }),
    [register, shortcuts, enabled, setEnabled, openHelp, helpShortcut],
  );

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
      <ShortcutsDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        shortcuts={shortcuts}
        enabled={enabled}
      />
    </ShortcutsContext.Provider>
  );
}

/**
 * Registers a shortcut while the calling component is mounted. Pass `null` to register nothing
 * (e.g. while a control is disabled). Does nothing outside the shell.
 */
export function useStaffShortcut(shortcut: StaffShortcut | null): void {
  const registry = useStaffShortcuts();
  const handler = React.useRef(shortcut?.handler);
  handler.current = shortcut?.handler;
  const register = registry?.register;
  const id = shortcut?.id;
  const keys = shortcut?.keys;
  const label = shortcut?.label;
  const group = shortcut?.group;
  const allowInFields = shortcut?.allowInFields;
  const passive = shortcut?.passive;
  React.useEffect(() => {
    if (!register || !id || !keys || !label || !group) return;
    return register({
      id,
      keys,
      label,
      group,
      ...(allowInFields ? { allowInFields } : {}),
      ...(passive ? { passive } : {}),
      handler: (event) => handler.current?.(event),
    });
  }, [register, id, keys, label, group, allowInFields, passive]);
}

/** The `?` sheet: every shortcut that works right now, grouped, and searchable. */
export function ShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
  enabled = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: readonly StaffShortcut[];
  enabled?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  const needle = query.trim().toLowerCase();
  const shown = shortcuts.filter(
    (shortcut) =>
      !needle ||
      shortcut.label.toLowerCase().includes(needle) ||
      shortcut.group.toLowerCase().includes(needle) ||
      shortcut.keys.includes(needle),
  );
  const groups = new Map<string, StaffShortcut[]>();
  for (const shortcut of shown) {
    groups.set(shortcut.group, [...(groups.get(shortcut.group) ?? []), shortcut]);
  }
  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Keyboard shortcuts"
      description={
        enabled
          ? "Single-key shortcuts work when you are not typing in a field."
          : "Single-key shortcuts are off. Turn them on from your account menu."
      }
      size="md"
    >
      <div className="flex flex-col gap-4">
        <TextInput
          size="sm"
          type="search"
          aria-label="Search shortcuts"
          placeholder="Search shortcuts"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          leading={<Search aria-hidden />}
        />
        <div className="flex max-h-[min(420px,55vh)] flex-col gap-4 overflow-y-auto">
          {groups.size === 0 ? (
            <p className="py-6 text-center text-staff-sm text-staff-muted">
              No shortcuts match “{query.trim()}”.
            </p>
          ) : (
            [...groups.entries()].map(([group, items]) => (
              <section key={group} aria-label={group} className="flex flex-col gap-1">
                <h3 className="text-staff-xs font-medium text-staff-muted">{group}</h3>
                <ul className="divide-y divide-staff-line-subtle">
                  {items.map((shortcut) => (
                    <li
                      key={shortcut.id}
                      className={cn(
                        "flex min-h-control-sm items-center justify-between gap-4 py-1 text-staff-sm text-staff-fg",
                        !enabled && isSingleKey(shortcut.keys) && "text-staff-disabled",
                      )}
                    >
                      <span>{shortcut.label}</span>
                      <ShortcutKeys keys={shortcut.keys} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </StaffDialog>
  );
}
