"use client";

import { BOTTOM_BAR_ABOVE_CLASS } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/** Height of the whole dock (banner and anything in the slot); the page reserves this space. */
export const COOKIE_DOCK_HEIGHT_VAR = "--cookie-dock-height";

/**
 * The dock's slot element lives in a small module store, not in a provider around the app: a
 * provider would put the whole page inside one more client boundary, which changes how the
 * streamed page is revealed. The store is read with `useSyncExternalStore`.
 */
let slotElement: HTMLElement | null = null;
const slotListeners = new Set<() => void>();

function registerSlot(element: HTMLElement | null): void {
  if (slotElement === element) return;
  slotElement = element;
  for (const listener of slotListeners) listener();
}

function subscribeToSlot(listener: () => void): () => void {
  slotListeners.add(listener);
  return () => {
    slotListeners.delete(listener);
  };
}

const getSlot = (): HTMLElement | null => slotElement;
const getServerSlot = (): HTMLElement | null => null;

/** Publishes an element's rendered height as a CSS variable on the root, and clears it on unmount. */
function usePublishedHeight(name: string): (element: HTMLElement | null) => void {
  const [element, setElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!element) return;
    const root = document.documentElement;
    const publish = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height > 0) root.style.setProperty(name, `${height}px`);
      else root.style.removeProperty(name);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(name);
    };
  }, [element, name]);
  return setElement;
}

/**
 * The fixed dock at the bottom edge. The cookie banner sits first; below it is a slot for one more
 * bar (the lot page's phone bid bar), so the two stack and never cover each other. It is not a
 * modal and traps no focus. It sits above the docked tab bar (`--lax-bottom-bar-space`, zero
 * where no bar shows). Its height is published as `--cookie-dock-height` and the page body
 * pads by that much, so the last control on a page stays reachable while the banner is open.
 */
export function CookieDock({ children }: { children?: ReactNode }) {
  const publishHeight = usePublishedHeight(COOKIE_DOCK_HEIGHT_VAR);
  return (
    <div
      ref={publishHeight}
      data-cookie-dock=""
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[var(--z-site-chrome,50)] flex flex-col",
        BOTTOM_BAR_ABOVE_CLASS,
      )}
    >
      {children}
      <div
        ref={registerSlot}
        data-cookie-dock-slot=""
        className={cn("pointer-events-auto empty:hidden")}
      />
    </div>
  );
}

/**
 * Renders its children into the dock, stacked under the cookie banner. Renders nothing where no
 * dock exists (staff routes) or before it has mounted.
 */
export function CookieDockSlot({ children }: { children: ReactNode }) {
  const slot = useSyncExternalStore(subscribeToSlot, getSlot, getServerSlot);
  if (!slot) return null;
  return createPortal(children, slot);
}
