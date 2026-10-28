"use client";

import { PersonAvatar } from "@/components/ui/person-avatar";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { endAdminImpersonationAction } from "@/lib/legal-entity/acting-context.actions";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { Button } from "@auction/ui/components/button";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

const MENU_ID = "view-as-client-menu";

/** Where support can look while viewing as a client; nothing here changes anything. */
const READ_ONLY_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Home", href: CLIENT_ROUTES.home },
  { label: "My bids", href: CLIENT_ROUTES.bids },
  { label: "Purchases", href: CLIENT_ROUTES.purchases },
  { label: "Watching", href: CLIENT_ROUTES.watching },
  { label: "Consignments", href: CLIENT_ROUTES.consignments },
];

const ITEM_CLASS =
  "block w-full px-4 py-2.5 text-left font-label text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * The header account menu while support views Bid as a client: the client's name, the pages to
 * look at, and Exit. The staff member's own account stays out of it; the banner names them.
 */
export function ViewAsClientMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  useEscapeKey(open, close);
  useClickOutside(open, wrapRef, close);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        className="h-auto max-w-[220px] justify-start gap-2 rounded-full bg-transparent py-1 pl-1 pr-2 text-left hover:bg-surface-container-low"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-label={`Viewing as ${name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <PersonAvatar src={null} name={name} initials={initials(name)} />
        <span className="hidden min-w-0 max-w-[8rem] truncate font-label text-sm font-medium text-on-surface sm:inline">
          {name}
        </span>
        <ChevronDown
          className="hidden size-4 shrink-0 text-on-surface-variant sm:block"
          aria-hidden
        />
      </Button>
      {open ? (
        <div
          id={MENU_ID}
          role="menu"
          aria-label={`Viewing as ${name}`}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-lg border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]"
        >
          <div className="border-b border-shell-stroke px-4 py-3">
            <p className="truncate font-body text-sm font-medium text-on-surface">{name}</p>
            <p className="mt-0.5 font-body text-xs text-on-surface-variant">Read-only view</p>
          </div>
          <div className="border-b border-shell-stroke py-1">
            {READ_ONLY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <form action={endAdminImpersonationAction} className="py-1">
            <button type="submit" role="menuitem" className={ITEM_CLASS}>
              Exit view as client
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
