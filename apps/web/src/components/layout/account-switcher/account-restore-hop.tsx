"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** The restore or switch hop for the page being opened; see `restoreAccountHref`. */
  href: string;
};

/**
 * Puts a browser in the right account (no usable choice yet, or a record owned by another
 * account), by loading the restore or switch hop as a page. A page load is what lets the hop's cookie and redirect take effect and leaves nothing
 * of this layout in the router's cache; a `redirect()` here would be followed by the client
 * router, which keeps the layout that asked for it and asks again. The link is for the rare
 * browser where the script does not run.
 */
export function AccountRestoreHop({ href }: Props) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.location.replace(href);
  }, [href]);

  return (
    <output
      data-testid="account-restore-hop"
      className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <p className="text-lax-14 font-medium text-lax-fg">Opening your account…</p>
      <a
        href={href}
        className="text-lax-14 text-lax-muted underline underline-offset-4 hover:text-lax-fg"
      >
        Continue
      </a>
    </output>
  );
}
