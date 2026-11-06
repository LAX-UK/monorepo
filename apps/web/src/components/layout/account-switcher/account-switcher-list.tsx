"use client";

import {
  type AccountChrome,
  type AccountOption,
  CURRENT_ACCOUNT_LABEL,
  SWITCH_ACCOUNT_HEADING,
  accountRowView,
  filterAccountOptions,
  pendingInvitationsLabel,
  showsAccountFilter,
} from "@/lib/navigation/account-switcher-model";
import { cn } from "@auction/ui";
import { Button, TextInput } from "@auction/ui/lax";
import { Check, Loader2, Mail, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { type ReactElement, type ReactNode, useEffect, useId, useState } from "react";
import { useAccountNeedsYou } from "./account-needs-you";
import { AccountTile } from "./account-tile";
import type { SwitchFailure } from "./use-account-switch";

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
  /** Why the last switch did not happen; shown under the rows with "Try again". */
  failure?: SwitchFailure | null;
  onRetry?: () => void;
  /**
   * Inside a menu, each account row is a menu item: the dropdown passes its item wrapper and the
   * rows sit in a group instead of a list.
   */
  wrapItem?: (row: ReactElement) => ReactElement;
  /** Whether the invitations, All accounts and Register links follow the rows (a menu has its own). */
  withLinks?: boolean;
};

/** A menu row: 36px in the popover, 44px on a phone; account rows are 52px and 60px. */
export const SWITCHER_ROW =
  "lax-focus-inset flex h-auto w-full items-center justify-start gap-3 whitespace-normal rounded-lax-control px-3 text-left font-normal text-lax-14 text-lax-fg transition-colors duration-150 hover:bg-lax-hover disabled:cursor-wait [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-lax-muted";
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
  wrapItem = (row) => row,
}: {
  option: AccountOption;
  needs: number;
  pending: boolean;
  locked: boolean;
  density: Density;
  onChoose: (option: AccountOption) => void;
  wrapItem?: (row: ReactElement) => ReactElement;
}) {
  const view = accountRowView(option, { needs, pending });
  return wrapItem(
    <Button
      variant="ghost"
      onClick={() => onChoose(option)}
      disabled={locked}
      aria-current={option.current ? "true" : undefined}
      aria-busy={pending || undefined}
      className={cn(
        SWITCHER_ROW,
        ACCOUNT_HEIGHT[density],
        "py-2",
        // The row being switched to stays readable; only the others dim.
        pending && "disabled:opacity-100",
        density === "sheet" && option.current && "bg-lax-selected hover:bg-lax-selected",
      )}
      data-testid={`switch-account-${option.kind}`}
    >
      <AccountTile account={option} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{view.title}</span>
        <span className="block truncate text-lax-12 text-lax-muted">{view.caption}</span>
      </span>
      {view.needsText ? (
        <>
          <span
            aria-hidden
            data-needs-you=""
            className="inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-lax-ink px-1.5 text-lax-12 font-semibold text-lax-on-ink tabular-nums"
          >
            {view.needsText}
          </span>
          <span className="sr-only">, {view.needsLabel}</span>
        </>
      ) : null}
      {pending ? (
        <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
      ) : view.current ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-lax-12 font-medium text-lax-fg">
          <span aria-hidden>{CURRENT_ACCOUNT_LABEL}</span>
          <Check aria-hidden className="size-4" strokeWidth={2} />
          <span className="sr-only">, current account</span>
        </span>
      ) : null}
    </Button>,
  );
}

/** "Could not switch" with a way to try again, under the rows. */
function SwitchFailureNotice({
  failure,
  onRetry,
}: {
  failure: SwitchFailure;
  onRetry: (() => void) | undefined;
}) {
  return (
    <div role="alert" className="flex items-center gap-3 px-3 py-2">
      <p className="min-w-0 flex-1 text-lax-13 text-lax-fg">
        <span className="font-medium">{failure.title}.</span> {failure.description}
      </p>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** The account rows: a list, or a group of menu items inside a menu. */
function Rows({
  headingId,
  density,
  inMenu,
  children,
}: {
  headingId: string;
  density: Density;
  inMenu: boolean;
  children: ReactElement[];
}) {
  if (inMenu) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: a menu groups its items with role="group"; <fieldset> is for form controls
      <div role="group" aria-labelledby={headingId} className="flex flex-col gap-0.5">
        {children}
      </div>
    );
  }
  return (
    <ul
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-0.5",
        density === "popover" && "max-h-[min(28rem,calc(100dvh-16rem))] overflow-y-auto",
      )}
    >
      {children.map((row) => (
        <li key={row.key}>{row}</li>
      ))}
    </ul>
  );
}

/** Pending invitations, every account on one page, and registering an organisation. */
function SwitcherLinks({
  switcher,
  rowHeight,
  onNavigate,
}: {
  switcher: Switcher;
  rowHeight: string;
  onNavigate: () => void;
}) {
  return (
    <>
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
        href={switcher.accountsHref}
        onClick={onNavigate}
        className={cn(SWITCHER_ROW, rowHeight)}
      >
        <Users aria-hidden strokeWidth={1.75} />
        All accounts
      </Link>
      <Link
        href={switcher.registerHref}
        onClick={onNavigate}
        className={cn(SWITCHER_ROW, rowHeight)}
      >
        <Plus aria-hidden strokeWidth={1.75} />
        Register an organisation
      </Link>
    </>
  );
}

/**
 * The accounts someone can use Bid as, on every surface that switches: their own first, then each
 * organisation with their role in it, "Current" with a tick on the one in use and a number where
 * something needs them. The row being switched to says "Switching…" and the others wait. From six
 * accounts a field finds one by name. Then the invitations waiting for an answer and a way to
 * register an organisation. The popover, the
 * phone sheet and the avatar menu all draw this one list.
 */
export function AccountSwitcherList({
  switcher,
  pendingId,
  onChoose,
  onNavigate,
  density = "popover",
  footer,
  failure = null,
  onRetry,
  wrapItem,
  withLinks = true,
}: Props) {
  const headingId = useId();
  const [query, setQuery] = useState("");
  const { counts, request } = useAccountNeedsYou();
  // The counts are read when the list opens, never on page load.
  useEffect(() => request(), [request]);

  const filterable = showsAccountFilter(switcher.options);
  const shown = filterable ? filterAccountOptions(switcher.options, query) : switcher.options;

  return (
    <div className="flex flex-col">
      <p
        id={headingId}
        className={cn(
          "px-3 pt-2 pb-1 text-lax-12 font-medium text-lax-muted",
          density === "sheet" && "sr-only",
        )}
      >
        {SWITCH_ACCOUNT_HEADING}
      </p>
      {filterable ? (
        <div className="px-2 pt-1.5 pb-2">
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
      <Rows headingId={headingId} density={density} inMenu={wrapItem !== undefined}>
        {shown.map((option) => (
          <AccountRow
            key={option.id}
            option={option}
            needs={counts?.[option.id] ?? 0}
            pending={pendingId === option.id}
            locked={pendingId !== null}
            density={density}
            onChoose={onChoose}
            {...(wrapItem ? { wrapItem } : {})}
          />
        ))}
      </Rows>
      {shown.length === 0 ? (
        <output className="block px-3 py-3 text-lax-13 text-lax-muted">
          No accounts match “{query.trim()}”.
        </output>
      ) : null}
      {failure ? <SwitchFailureNotice failure={failure} onRetry={onRetry} /> : null}
      {withLinks ? (
        <SwitcherLinks
          switcher={switcher}
          rowHeight={ROW_HEIGHT[density]}
          onNavigate={onNavigate}
        />
      ) : null}
      {footer ? (
        <>
          <SwitcherSeparator />
          {footer}
        </>
      ) : null}
    </div>
  );
}
