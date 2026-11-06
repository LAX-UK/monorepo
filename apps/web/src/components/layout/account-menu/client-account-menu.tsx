"use client";

import { AccountSwitcherList } from "@/components/layout/account-switcher/account-switcher-list";
import { useAccountSwitch } from "@/components/layout/account-switcher/use-account-switch";
import { useLogout } from "@/lib/auth/use-logout";
import type { AttentionCount } from "@/lib/navigation/client-attention";
import type { HeaderAccountMenu, HeaderMenuLink } from "@/lib/navigation/header-account-menu.vm";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { ExternalLink, LogOut, Mail } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactElement, type ReactNode, createContext, useContext } from "react";

/** `popover`: the desktop dropdown (a menu); `sheet`: the phone sheet (a plain list). */
export type AccountMenuSurface = "popover" | "sheet";

const ROW: Record<AccountMenuSurface, string> = {
  popover: "min-h-[2.375rem] text-sm",
  sheet: "min-h-12 text-[0.9375rem]",
};

const ROW_BASE =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 font-body text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

const CURRENT_ROW =
  "bg-[color-mix(in_srgb,var(--color-product-accent)_9%,transparent)] font-medium text-product-accent hover:bg-[color-mix(in_srgb,var(--color-product-accent)_13%,transparent)]";

const COUNT_TONE: Record<AttentionCount["tone"], string> = {
  danger: "bg-danger-container text-danger-on-surface",
  neutral: "bg-surface-container-high text-on-surface",
};

/**
 * How a row is wrapped as a menu item. The sheet's rows are plain links; inside a Radix dropdown
 * each row is wrapped (as its child) in the dropdown's own item, which gives arrow-key movement
 * and typeahead. Identity by default.
 */
type WrapItem = (row: ReactElement) => ReactElement;
const IDENTITY: WrapItem = (row) => row;
const WrapItemContext = createContext<WrapItem>(IDENTITY);

function itemProps(surface: AccountMenuSurface) {
  return surface === "popover" ? { role: "menuitem", "data-account-menu-item": "" } : {};
}

function GroupHeading({ children }: { children: ReactNode }) {
  return (
    <p
      aria-hidden
      className="px-2.5 pt-1.5 pb-1 font-body text-xs font-medium text-on-surface-variant"
    >
      {children}
    </p>
  );
}

function Separator() {
  return <hr className="m-0 h-px border-0 bg-outline-variant/60" />;
}

/** A labelled block of menu entries (the WAI-ARIA menu pattern's group, not a form fieldset). */
function MenuGroup({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a menu groups its items with role="group"; <fieldset> is for form controls
    <div role="group" aria-label={label} className={className}>
      {children}
    </div>
  );
}

function CountMark({ count }: { count: AttentionCount }) {
  const text = count.value > 9 ? "9+" : String(count.value);
  if (count.menuStyle === "text") {
    return <span className="font-body text-xs text-on-surface-variant">{count.label}</span>;
  }
  return (
    <span
      className={cn(
        "inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-body text-xs font-semibold",
        COUNT_TONE[count.tone],
      )}
    >
      <span aria-hidden>{text}</span>
      <span className="sr-only">{count.label}</span>
    </span>
  );
}

function PageLink({
  link,
  surface,
  onNavigate,
}: {
  link: HeaderMenuLink;
  surface: AccountMenuSurface;
  onNavigate: () => void;
}) {
  const Icon = link.icon;
  const body = (
    <>
      <Icon
        className={cn(
          "size-4 shrink-0",
          link.current ? "text-product-accent" : "text-on-surface-variant",
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{link.label}</span>
      {link.count ? <CountMark count={link.count} /> : null}
      {link.external ? (
        <ExternalLink className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden />
      ) : null}
    </>
  );
  const wrap = useContext(WrapItemContext);
  const className = cn(ROW_BASE, ROW[surface], link.current && CURRENT_ROW);
  if (link.external) {
    return wrap(
      <a
        href={link.href}
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
        {...itemProps(surface)}
      >
        {body}
      </a>,
    );
  }
  return wrap(
    <Link
      href={link.href}
      aria-current={link.current ? "page" : undefined}
      className={className}
      onClick={onNavigate}
      {...itemProps(surface)}
    >
      {body}
    </Link>,
  );
}

function InvitationsRow({
  href,
  label,
  surface,
  onNavigate,
}: { href: string; label: string; surface: AccountMenuSurface; onNavigate: () => void }) {
  const wrap = useContext(WrapItemContext);
  return wrap(
    <Link
      href={href}
      className={cn(ROW_BASE, ROW[surface])}
      onClick={onNavigate}
      {...itemProps(surface)}
    >
      <Mail className="size-4 shrink-0 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
      <span>{label}</span>
    </Link>,
  );
}

function SignOutRow({
  surface,
  onNavigate,
}: { surface: AccountMenuSurface; onNavigate: () => void }) {
  const { logout, pending } = useLogout({ onBeforeNavigate: onNavigate });
  const wrap = useContext(WrapItemContext);
  return wrap(
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() => void logout()}
      className={cn(
        ROW_BASE,
        ROW[surface],
        "h-auto justify-start border-0 font-normal shadow-none disabled:cursor-not-allowed disabled:opacity-60",
      )}
      {...itemProps(surface)}
    >
      <LogOut className="size-4 shrink-0 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
      <span>{pending ? "Signing out…" : "Sign out"}</span>
    </Button>,
  );
}

type ClientAccountMenuProps = {
  menu: HeaderAccountMenu;
  surface: AccountMenuSurface;
  onNavigate: () => void;
  /** Wraps each row as a menu item; the dropdown passes its item wrapper, the sheet passes none. */
  wrapItem?: WrapItem;
};

/** The accounts under "Switch account": the same list as the sidebar and the phone sheet. */
function MenuAccounts({
  switcher,
  wrapItem,
  inMenu,
  onNavigate,
}: {
  switcher: NonNullable<HeaderAccountMenu["switcher"]>;
  wrapItem: WrapItem;
  inMenu: boolean;
  onNavigate: () => void;
}) {
  const { pendingId, failure, choose, retry } = useAccountSwitch(undefined, "inline");
  return (
    <AccountSwitcherList
      switcher={switcher}
      pendingId={pendingId}
      // Stays open: the chosen row shows the progress, and a failure shows under the rows.
      onChoose={(option) => void choose(option)}
      onNavigate={onNavigate}
      failure={failure}
      onRetry={() => void retry()}
      withLinks={false}
      {...(inMenu ? { wrapItem } : {})}
    />
  );
}

/**
 * A client's account menu: their accounts (for organisation members), their pages grouped as
 * Buying, Selling and account pages with whatever is due, then Sign out. The same body serves
 * the desktop dropdown and the phone sheet.
 */
export function ClientAccountMenu({ menu, surface, onNavigate, wrapItem }: ClientAccountMenuProps) {
  const pad = surface === "popover" ? "p-1.5" : "px-0 py-2";
  const wrap = wrapItem ?? IDENTITY;
  return (
    <WrapItemContext.Provider value={wrapItem ?? IDENTITY}>
      {menu.switcher ? (
        <>
          <div className={pad}>
            <MenuAccounts
              switcher={menu.switcher}
              wrapItem={wrap}
              inMenu={wrapItem !== undefined}
              onNavigate={onNavigate}
            />
          </div>
          <Separator />
        </>
      ) : null}
      {menu.invitations ? (
        <>
          <div className={pad}>
            <InvitationsRow
              href={menu.invitations.href}
              label={menu.invitations.label}
              surface={surface}
              onNavigate={onNavigate}
            />
          </div>
          <Separator />
        </>
      ) : null}
      {menu.sections.map((section) => (
        <Fragment key={section.id}>
          <MenuGroup label={section.label ?? "Account"} className={pad}>
            {section.label ? <GroupHeading>{section.label}</GroupHeading> : null}
            {section.links.map((link) => (
              <PageLink key={link.id} link={link} surface={surface} onNavigate={onNavigate} />
            ))}
          </MenuGroup>
          <Separator />
        </Fragment>
      ))}
      <div className={pad}>
        <SignOutRow surface={surface} onNavigate={onNavigate} />
      </div>
    </WrapItemContext.Provider>
  );
}
