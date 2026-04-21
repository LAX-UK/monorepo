"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type NavItem = { href: string; label: string; hint?: string };

const marketingItems: NavItem[] = [
  { href: "/", label: "Upcoming auctions", hint: "Home" },
  { href: "/search", label: "Search lots" },
  { href: "/archive", label: "Past auctions" },
  { href: "/artist/featured", label: "Featured artists" },
];

const dashboardItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard home" },
  { href: "/dashboard/portfolio", label: "My collection" },
  { href: "/dashboard/bids", label: "My bids" },
  { href: "/", label: "Browse gallery", hint: "Marketing site" },
  { href: "/search", label: "Search lots" },
];

type Props = {
  variant: "marketing" | "dashboard";
};

export function CommandPalette({ variant }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const items = variant === "dashboard" ? dashboardItems : marketingItems;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onPaletteOpen = () => setOpen(true);
    window.addEventListener("lax-command-palette-open", onPaletteOpen);
    return () => window.removeEventListener("lax-command-palette-open", onPaletteOpen);
  }, []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        el.showModal();
        queueMicrotask(() => firstLinkRef.current?.focus());
      }
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  const onDialogClose = useCallback(() => {
    setOpen(false);
  }, []);

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[100] max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-inverse-surface/40 backdrop:backdrop-blur-sm"
      aria-labelledby={titleId}
      onClose={onDialogClose}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="flex min-h-full items-start justify-center px-4 pt-[15vh]">
        <button
          type="button"
          className="fixed inset-0 cursor-default"
          tabIndex={-1}
          aria-hidden
          onClick={close}
        />
        <div className="relative z-10 w-full max-w-lg rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-2xl ring-1 ring-outline-variant/10">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-outline-variant/15 pb-3">
            <h2
              id={titleId}
              className="font-label text-xs font-bold uppercase tracking-widest text-secondary"
            >
              Quick go
            </h2>
            <span className="hidden font-mono text-xs text-on-surface-variant sm:inline">Esc</span>
          </div>
          <p className="mb-4 font-body text-sm text-on-surface-variant">
            Jump to a page. Open anytime with{" "}
            <kbd className="rounded border border-outline-variant/30 bg-surface-container-high px-1.5 py-0.5 font-mono text-xs">
              {isMac ? "⌘" : "Ctrl"}+K
            </kbd>
            .
          </p>
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={item.href}
                  onClick={close}
                  className="flex flex-col rounded-lg px-3 py-2.5 font-body text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span>{item.label}</span>
                  {item.hint ? (
                    <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant">
                      {item.hint}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </dialog>
  );
}
