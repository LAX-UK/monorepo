"use client";

import * as React from "react";
import { ConfirmActionDialog } from "../panels/staff-dialog.js";

/*
 * Unsaved-changes protection for every editable page, panel and form. While a form has changes,
 * the guard asks before they are lost: closing or reloading the tab (the browser's own prompt),
 * a click on an in-app link (nav, breadcrumbs), the browser Back button, ⌘K navigation, a panel
 * closing, and any code that navigates through `confirmDiscardChanges` first.
 */

export type DiscardPrompt = {
  title: string;
  description: string;
  confirmLabel: string;
};

type Registration = { ask: (prompt?: Partial<DiscardPrompt>) => Promise<boolean> };

/** Guards for forms with changes, newest last. Only dirty forms register. */
const registered: Registration[] = [];

/** True while any form on the page has unsaved changes. */
export function hasUnsavedChanges(): boolean {
  return registered.length > 0;
}

/**
 * Resolves true when it is safe to go on: nothing is unsaved, or the person chose to discard.
 * Call before navigating in code (Cancel buttons, ⌘K, closing a panel).
 */
export function confirmDiscardChanges(prompt?: Partial<DiscardPrompt>): Promise<boolean> {
  const latest = registered[registered.length - 1];
  return latest ? latest.ask(prompt) : Promise.resolve(true);
}

export function discardPrompt(label?: string): DiscardPrompt {
  return {
    title: label ? `Discard changes to ${label}?` : "Discard unsaved changes?",
    description: "Your changes have not been saved and will be lost.",
    confirmLabel: "Discard changes",
  };
}

/** The browser's own prompt when the tab is closed or reloaded with unsaved changes. */
export function useBeforeUnloadGuard(dirty: boolean): void {
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The in-app destination of a click on a link that would leave this page, or null when the
 * click stays on the page, opens elsewhere or is not a link.
 */
function leavingHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || !isPlainLeftClick(event)) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Marks the history entry pushed while dirty; Back from it stays on the page. */
const SENTINEL_KEY = "__unsavedChangesGuard";

function isSentinel(state: unknown): boolean {
  return typeof state === "object" && state !== null && SENTINEL_KEY in state;
}

function pushSentinel(): void {
  window.history.pushState({ ...window.history.state, [SENTINEL_KEY]: true }, "");
}

type Pending =
  | { kind: "link"; href: string }
  | { kind: "history" }
  | { kind: "ask"; resolve: (discard: boolean) => void };

export type UnsavedChangesOptions = {
  /** What is being edited, for "Discard changes to <label>?". */
  label?: string;
  /** In-app navigation (e.g. `router.push`), used to follow a held link once confirmed. */
  navigate?: (href: string) => void;
  /**
   * Turns the browser Back button into the same question (default). An extra history entry is
   * kept while dirty; call `release()` before navigating away on your own after a save.
   */
  interceptBack?: boolean;
};

export type UnsavedChangesState = {
  /** True while the question is showing. */
  pending: boolean;
  /** The question to show. */
  prompt: DiscardPrompt;
  /** Keep editing: stay on the page with the changes. */
  stay: () => void;
  /** Discard the changes and carry on to where the person was going. */
  leave: () => void;
  /**
   * Drops the extra history entry and resolves once the browser has settled, so a navigation
   * that follows (e.g. to a record just created) is not cancelled by it.
   */
  release: () => Promise<void>;
};

/**
 * Guards leaving a form with unsaved changes. Render `UnsavedChangesDialog` with the result, or
 * use `UnsavedChangesGuard`, which does both.
 */
export function useUnsavedChanges(
  dirty: boolean,
  { label, navigate, interceptBack = true }: UnsavedChangesOptions = {},
): UnsavedChangesState {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [override, setOverride] = React.useState<Partial<DiscardPrompt> | null>(null);
  // True while this hook owns a sentinel entry. A ref rather than history.state alone, so a
  // reload that restores a stale sentinel is never mistaken for one this mount pushed.
  const armed = React.useRef(false);
  // Set once the person has confirmed leaving, so the Back we trigger is not intercepted again.
  const leaving = React.useRef(false);
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;
  useBeforeUnloadGuard(dirty);

  React.useEffect(() => {
    if (!dirty) return;
    const registration: Registration = {
      ask: (prompt) =>
        new Promise<boolean>((resolve) => {
          setOverride(prompt ?? null);
          setPending({ kind: "ask", resolve });
        }),
    };
    registered.push(registration);
    return () => {
      const index = registered.indexOf(registration);
      if (index >= 0) registered.splice(index, 1);
    };
  }, [dirty]);

  React.useEffect(() => {
    if (!dirty) return;
    // Capture phase, so the click is held before the framework's own link handling navigates.
    const hold = (event: MouseEvent) => {
      const href = leavingHref(event);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      setOverride(null);
      setPending({ kind: "link", href });
    };
    document.addEventListener("click", hold, true);
    return () => document.removeEventListener("click", hold, true);
  }, [dirty]);

  React.useEffect(() => {
    if (!interceptBack) return;
    if (!dirty) {
      // Saved or reverted: drop the extra entry so Back behaves normally again.
      if (armed.current && !leaving.current) {
        armed.current = false;
        if (isSentinel(window.history.state)) window.history.back();
      }
      return;
    }
    // Strict Mode mounts twice; never stack a second entry on top of ours.
    if (!armed.current || !isSentinel(window.history.state)) {
      pushSentinel();
      armed.current = true;
    }
    const onPopState = () => {
      if (leaving.current || isSentinel(window.history.state)) return;
      setOverride(null);
      setPending({ kind: "history" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dirty, interceptBack]);

  const stay = React.useCallback(() => {
    if (pending?.kind === "history") pushSentinel();
    if (pending?.kind === "ask") pending.resolve(false);
    setPending(null);
  }, [pending]);

  const leave = React.useCallback(() => {
    if (pending?.kind === "history") {
      // Back already popped the sentinel; one more Back leaves the page for real.
      leaving.current = true;
      armed.current = false;
      window.history.back();
    } else if (pending?.kind === "link") {
      const { href } = pending;
      const go = () => {
        if (navigateRef.current) navigateRef.current(href);
        else window.location.assign(href);
      };
      if (armed.current && isSentinel(window.history.state)) {
        // Step off the sentinel first so it does not linger behind the destination.
        leaving.current = true;
        armed.current = false;
        window.addEventListener("popstate", go, { once: true });
        window.history.back();
      } else {
        go();
      }
    } else if (pending?.kind === "ask") {
      pending.resolve(true);
    }
    setPending(null);
  }, [pending]);

  const release = React.useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (!armed.current || !isSentinel(window.history.state)) {
          resolve();
          return;
        }
        leaving.current = true;
        armed.current = false;
        window.addEventListener(
          "popstate",
          () => {
            leaving.current = false;
            resolve();
          },
          { once: true },
        );
        window.history.back();
      }),
    [],
  );

  const prompt = { ...discardPrompt(label), ...override };
  return { pending: pending !== null, prompt, stay, leave, release };
}

/** "Discard changes to …?" with Keep editing (focused first) and Discard changes. */
export function UnsavedChangesDialog({ guard }: { guard: UnsavedChangesState }) {
  return (
    <ConfirmActionDialog
      open={guard.pending}
      onOpenChange={(open) => {
        if (!open) guard.stay();
      }}
      title={guard.prompt.title}
      description={guard.prompt.description}
      cancelLabel="Keep editing"
      confirmLabel={guard.prompt.confirmLabel}
      tone="danger"
      onConfirm={guard.leave}
    />
  );
}

/** The guard and its question in one: mount it in any form that can have unsaved changes. */
export function UnsavedChangesGuard({
  dirty,
  ...options
}: UnsavedChangesOptions & { dirty: boolean }) {
  const guard = useUnsavedChanges(dirty, options);
  return <UnsavedChangesDialog guard={guard} />;
}
