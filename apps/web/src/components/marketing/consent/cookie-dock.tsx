"use client";

import { cn } from "@auction/ui";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

/** Height of the whole dock (banner and anything in the slot); the page reserves this space. */
export const COOKIE_DOCK_HEIGHT_VAR = "--cookie-dock-height";

type DockContextValue = {
  slotElement: HTMLElement | null;
  registerSlot: (element: HTMLElement | null) => void;
};

const DockContext = createContext<DockContextValue | null>(null);

/** Holds the dock's slot element so a bar elsewhere in the tree can render into it. */
export function CookieDockProvider({ children }: { children: ReactNode }) {
  const [slotElement, setSlotElement] = useState<HTMLElement | null>(null);
  const value = useMemo<DockContextValue>(
    () => ({ slotElement, registerSlot: setSlotElement }),
    [slotElement],
  );
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

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
 * modal and traps no focus. Its height is published as `--cookie-dock-height` and the page body
 * pads by that much, so the last control on a page stays reachable while the banner is open.
 */
export function CookieDock({ children }: { children?: ReactNode }) {
  const ctx = useContext(DockContext);
  const publishHeight = usePublishedHeight(COOKIE_DOCK_HEIGHT_VAR);
  const registerSlot = ctx?.registerSlot;
  const setSlot = useCallback(
    (element: HTMLElement | null) => registerSlot?.(element),
    [registerSlot],
  );
  return (
    <div
      ref={publishHeight}
      data-cookie-dock=""
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-site-chrome,50)] flex flex-col"
    >
      {children}
      <div
        ref={setSlot}
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
  const slotElement = useContext(DockContext)?.slotElement ?? null;
  if (!slotElement) return null;
  return createPortal(children, slotElement);
}
