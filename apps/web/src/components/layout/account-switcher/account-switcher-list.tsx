"use client";

import {
  type AccountChrome,
  type AccountOption,
  accountRowText,
  filterAccountOptions,
  needsYouLabel,
  pendingInvitationsLabel,
  showsAccountFilter,
} from "@/lib/navigation/account-switcher-model";
import { cn } from "@auction/ui";
import { TextInput } from "@auction/ui/lax";
import { Check, Loader2, Mail, Plus, Search } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useAccountNeedsYou } from "./account-needs-you";
import { AccountTile } from "./account-tile";

type Switcher = NonNullable<AccountChrome["switcher"]>;
type Density = "popover" | "sheet";

type Props = {
  switcher: Switcher;
  /** The account being switched to, while the switch is in flight. */
  pendingId: string | null;
  onChoose: (option: AccountOption) => void;
  /** Called when a footer link is followed, so the menu can close. */
  onNavigate: () => void;
  /** Sheet rows are taller, for thumbs, and the sheet's own title names the list. */
  density?: Density;
  /** More rows under the list's own, after a hairline (the phone sheet's LAX Account, Sign out). */
  footer?: ReactNode;
};

/** A menu row: 36px in the popover, 44px on a phone; account rows are 52px and 60px. */
export const SWITCHER_ROW =
  "lax-focus-inset flex w-full items-center gap-3 rounded-lax-control px-3 text-left text-lax-14 text-lax-fg transition-colors duration-150 hover:bg-lax-hover disabled:cursor-wait [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-lax-muted";
const ROW_HEIGHT: Record<Density, string> = { popover: "min-h-9", sheet: "min-h-11" };
const ACCOUNT_HEIGHT: Record<Density, string> = { popover: "min-h-[52px]", sheet: "min-h-[60px]" };

/** A hairline between the list's parts, edge to edge of the menu. */
export function SwitcherSeparator() {
  return <div aria-hidden className="-mx-1 my-1 h-px bg-lax-line" />;
}

function AccountRow({
  option,
  needs,
  pending,
  locked,
  density,
  onChoose,
}: {
  option: AccountOption;
  needs: number;
  pending: boolean;
  locked: boolean;
  density: Density;
  onChoose: (option: AccountOption) => void;
}) {
  const { title, caption } = accountRowText(option);
  return (
    <button
      type="button"
      onClick={() => onChoose(option)}
      disabled={locked}
      aria-current={option.current ? "true" : undefined}
      className={cn(
        SWITCHER_ROW,
        ACCOUNT_HEIGHT[density],
        "py-2",
        density === "sheet" && option.current && "bg-lax-selected hover:bg-lax-selected",
      )}
      data-testid={`switch-account-${option.kind}`}
    >
      <AccountTile account={option} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-lax-12 text-lax-muted">{caption}</span>
      </span>
      {needs > 0 ? (
        <>
          <span aria-hidden data-needs-you="" className="size-2 shrink-0 rounded-full bg-lax-ink" />
          <span className="sr-only">, {needsYouLabel(needs)}</span>
        </>
      ) : null}
      {pending ? (
        <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
      ) : option.current ? (
        <Check aria-hidden strokeWidth={2} />
      ) : null}
      {option.current ? <span className="sr-only">, current account</span> : null}
    </button>
  );
}

/**
 * The accounts someone can use Bid as: their own first, then each organisation with their role
 * in it, a tick on the one in use and a dot where something needs them. From six accounts a field
 * finds one by name. Then the invitations waiting for an answer and a way to register an
 * organisation. Shared by the desktop popover and the phone sheet.
 */
export function AccountSwitcherList({
  switcher,
  pendingId,
  onChoose,
  onNavigate,
  density = "popover",
  footer,
}: Props) {
  const headingId = useId();
  const [query, setQuery] = useState("");
  const { counts, request } = useAccountNeedsYou();
  // The dots are read when the list opens, never on page load.
  useEffect(() => request(), [request]);

  const filterable = showsAccountFilter(switcher.options);
  const shown = filterable ? filterAccountOptions(switcher.options, query) : switcher.options;
  const rowHeight = ROW_HEIGHT[density];

  return (
    <div className="flex flex-col">
      <p
        id={headingId}
        className={cn(
          "px-3 pt-2 pb-1 text-lax-12 font-medium text-lax-muted",
          density === "sheet" && "sr-only",
        )}
      >
        Switch account
      </p>
      {filterable ? (
        <div className="px-1 pt-1 pb-1.5">
          <TextInput
            size="sm"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an account"
            aria-label="Find an account"
            leading={<Search aria-hidden className="size-4 text-lax-muted" />}
          />
        </div>
      ) : null}
      <ul
        aria-labelledby={headingId}
        className={cn(
          "flex flex-col gap-0.5",
          density === "popover" && "max-h-[min(23rem,calc(100dvh-16rem))] overflow-y-auto",
        )}
      >
        {shown.map((option) => (
          <li key={option.id}>
            <AccountRow
              option={option}
              needs={counts?.[option.id] ?? 0}
              pending={pendingId === option.id}
              locked={pendingId !== null}
              density={density}
              onChoose={onChoose}
            />
          </li>
        ))}
      </ul>
      {shown.length === 0 ? (
        <output className="block px-3 py-3 text-lax-13 text-lax-muted">
          No accounts match “{query.trim()}”.
        </output>
      ) : null}
      <SwitcherSeparator />
      {switcher.pendingInvitations > 0 ? (
        <Link
          href={switcher.invitationsHref}
          onClick={onNavigate}
          aria-label={pendingInvitationsLabel(switcher.pendingInvitations)}
          className={cn(SWITCHER_ROW, rowHeight)}
        >
          <Mail aria-hidden strokeWidth={1.75} />
          <span className="flex-1">Pending invitations</span>
          <span className="text-lax-13 tabular-nums text-lax-muted">
            {switcher.pendingInvitations > 9 ? "9+" : switcher.pendingInvitations}
          </span>
        </Link>
      ) : null}
      <Link
        href={switcher.registerHref}
        onClick={onNavigate}
        className={cn(SWITCHER_ROW, rowHeight)}
      >
        <Plus aria-hidden strokeWidth={1.75} />
        Register an organisation
      </Link>
      {footer ? (
        <>
          <SwitcherSeparator />
          {footer}
        </>
      ) : null}
    </div>
  );
}
