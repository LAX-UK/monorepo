"use client";

import { useAccountSwitch } from "@/components/layout/account-switcher/use-account-switch";
import { accountLinkTarget } from "@/lib/navigation/account-link";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

/** What the row and button links hand their link component. */
type Props = {
  href: string;
  className?: string | undefined;
  children?: ReactNode;
  "aria-label"?: string | undefined;
  "data-record-link"?: boolean | undefined;
  /** Accepted so the link can stand in for the framework link; an anchor has no prefetch. */
  prefetch?: boolean | undefined;
};

/** Plain clicks only: a modified click (new tab, download) keeps the browser's own behaviour. */
function isPlainClick(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
  );
}

function SwitchingAnchor({
  accountId,
  next,
  href,
  prefetch: _prefetch,
  ...anchor
}: Props & { accountId: string; next: string }) {
  const { choose } = useAccountSwitch(next);
  return (
    <a
      {...anchor}
      href={href}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        void choose({ id: accountId, current: false });
      }}
    />
  );
}

/**
 * A link to a page of another account (`?account=<id>`). A click switches through the server
 * action and loads the page afresh, because the client router cannot carry the account cookie of
 * the switch hop through to the layout it keeps. Without scripts the anchor still works as a page
 * load through the hop. Any other link is an ordinary client link.
 */
export function AccountSwitchLink({ href, prefetch, ...anchor }: Props) {
  const target = accountLinkTarget(new URL(href, "http://lax.invalid"));
  if (!target) {
    return <Link href={href} {...(prefetch === undefined ? {} : { prefetch })} {...anchor} />;
  }
  return (
    <SwitchingAnchor {...anchor} href={href} accountId={target.accountId} next={target.next} />
  );
}
