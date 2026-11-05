"use client";

import { useEffect, useState } from "react";
import { useBottomSlotClaimed } from "./bottom-slot.js";

/** The visual viewport counts as shrunk by the keyboard once it is under this share of the window. */
export const KEYBOARD_VIEWPORT_RATIO = 0.75;

const MODAL_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="dialog"][aria-modal="true"], dialog[open]';

const FIELD_SELECTOR = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "radio",
  "submit",
  "reset",
  "file",
  "image",
]);

/** Whether the focused element takes typed text (so the on-screen keyboard is likely up). */
export function isTextFieldFocused(active: Element | null): boolean {
  if (!active?.matches(FIELD_SELECTOR)) return false;
  if (active instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(active.type);
  return true;
}

/** Whether the visual viewport has shrunk the way an on-screen keyboard shrinks it. */
export function isViewportShrunk(visualHeight: number, windowHeight: number): boolean {
  return windowHeight > 0 && visualHeight < windowHeight * KEYBOARD_VIEWPORT_RATIO;
}

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setOpen(
        isViewportShrunk(viewport.height, window.innerHeight) &&
          isTextFieldFocused(document.activeElement),
      );
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  return open;
}

function useModalOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const update = () => setOpen(document.querySelector(MODAL_SELECTOR) !== null);
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state", "aria-modal", "open", "role"],
    });
    update();
    return () => observer.disconnect();
  }, []);
  return open;
}

export type BottomBarVisibility = {
  visible: boolean;
  /** Why it is hidden, for tests and data attributes; null while visible. */
  reason: "keyboard" | "modal" | "slot-claimed" | "forced" | null;
};

/**
 * Whether the bottom tab bar shows. It hides while the on-screen keyboard is open (the visual
 * viewport has shrunk and a text field has focus), while any modal or sheet is open, and while
 * another bar holds the shared bottom slot. Scrolling never hides it.
 */
export function useBottomBarVisibility(
  options: { forceHidden?: boolean } = {},
): BottomBarVisibility {
  const keyboard = useKeyboardOpen();
  const modal = useModalOpen();
  const claimed = useBottomSlotClaimed();
  const reason = options.forceHidden
    ? "forced"
    : modal
      ? "modal"
      : keyboard
        ? "keyboard"
        : claimed
          ? "slot-claimed"
          : null;
  return { visible: reason === null, reason };
}
