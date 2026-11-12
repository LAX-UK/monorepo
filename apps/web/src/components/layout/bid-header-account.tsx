"use client";

import { AccountMenuItems } from "@/components/layout/account-menu-items";
import { AccountMenuIdentity } from "@/components/layout/account-menu/account-menu-identity";
import { asDropdownItem } from "@/components/layout/account-menu/as-dropdown-item";
import { ClientAccountMenu } from "@/components/layout/account-menu/client-account-menu";
import { personInitials } from "@/components/layout/account-menu/person-initials";
import {
  type HeaderAccountMenuState,
  useHeaderAccountMenu,
} from "@/components/layout/account-menu/use-header-account-menu";
import { DesktopAccountFace } from "@/components/layout/account-switcher/desktop-account-face";
import { LogoutButton } from "@/components/layout/logout-button";
import { useBidAttention } from "@/hooks/use-bid-attention";
import { useIsLg } from "@/hooks/use-is-lg";
import { useAppSession } from "@/lib/auth/use-app-session";
import { useAuthHeaderLinks } from "@/lib/auth/use-auth-header-links";
import type { SessionUser } from "@/lib/data/contracts";
import type { SiteHeaderTone } from "@/lib/layout/header-chrome-tone";
import { accountButtonView } from "@/lib/navigation/account-button.vm";
import type { AccountMenuEntry } from "@/lib/navigation/account-menu-model";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { MarketingAccountSheet } from "@auction/marketing-ui/header/marketing-account-sheet";
import { MarketingAccountEntry } from "@auction/marketing-ui/marketing-account-entry";
import { cn } from "@auction/ui/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type BidHeaderAccountProps = {
  headerTone?: SiteHeaderTone;
  laxProductLinks?: LaxProductLinkVm[];
};

/** A staff account's menu: other LAX products, the admin area, LAX Account, Sign out. */
function StaffMenuBody({
  groups,
  otherProducts,
  onNavigate,
  surface,
}: {
  groups: AccountMenuEntry[][];
  otherProducts: LaxProductLinkVm[];
  onNavigate: () => void;
  surface: "dropdown" | "sheet";
}) {
  const dropdown = surface === "dropdown";
  const wrap = dropdown ? asDropdownItem : undefined;
  return (
    <div className={dropdown ? "py-1" : "flex flex-col py-2"}>
      {otherProducts.length > 0 ? (
        <div className="border-b border-nav-border px-3 py-2 dark:border-border-hairline">
          <p className="font-label text-xs font-medium text-on-surface-variant">LAX products</p>
          <div className="mt-2 flex flex-col gap-1">
            {otherProducts.map((item) => {
              const link = (
                <a
                  href={item.href}
                  className="block px-0 py-1.5 font-label text-sm font-medium text-on-surface transition-colors hover:text-link focus-visible:text-link focus-visible:underline focus-visible:outline-none"
                  rel="noopener noreferrer"
                  onClick={onNavigate}
                >
                  {item.label}
                </a>
              );
              return <div key={item.id}>{wrap ? wrap(link) : link}</div>;
            })}
          </div>
        </div>
      ) : null}
      <AccountMenuItems
        groups={groups}
        variant={dropdown ? "header" : "drawer"}
        menu={dropdown}
        onNavigate={onNavigate}
        {...(wrap ? { wrapItem: wrap } : {})}
      />
      <hr className="my-1 border-0 border-t border-nav-border dark:border-border-hairline" />
      {(() => {
        const signOut = (
          <LogoutButton
            onBeforeNavigate={onNavigate}
            className="block w-full px-3 py-2.5 text-left font-label text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        );
        return wrap ? wrap(signOut) : signOut;
      })()}
    </div>
  );
}

function DropdownBody({
  state,
  user,
  otherProducts,
  onNavigate,
}: {
  state: HeaderAccountMenuState;
  user: SessionUser;
  otherProducts: LaxProductLinkVm[];
  onNavigate: () => void;
}) {
  return (
    <div className="w-[min(100vw-2rem,22rem)]">
      <div className="border-b border-outline-variant/60 p-4">
        <AccountMenuIdentity user={user} />
      </div>
      {state.kind === "staff" ? (
        <StaffMenuBody
          groups={state.groups}
          otherProducts={otherProducts}
          onNavigate={onNavigate}
          surface="dropdown"
        />
      ) : (
        <ClientAccountMenu
          menu={state.menu}
          surface="popover"
          onNavigate={onNavigate}
          wrapItem={asDropdownItem}
        />
      )}
    </div>
  );
}

function SignedInAccount({
  user,
  headerTone,
  laxProductLinks,
}: {
  user: SessionUser;
  headerTone: SiteHeaderTone;
  laxProductLinks: LaxProductLinkVm[];
}) {
  const { signInHref, registerHref } = useAuthHeaderLinks();
  const state = useHeaderAccountMenu(user);
  const isLg = useIsLg();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const otherProducts = laxProductLinks.filter((link) => !link.current);
  const close = () => setOpen(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the menu when the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The dot says something waits: the chip's prompt (outbid, in review, payment due) or unread
  // notifications. It reads from the same facts as the tab bar's dots.
  const { chip, attention: facts } = useBidAttention();
  const attention = chip !== null || (facts?.unreadNotifications ?? 0) > 0;
  const displayName = user.name.trim() || user.email;
  // Someone with an organisation sees the account in use on the button; the menu's account list
  // is the same one the sidebar and the phone sheet show.
  const current =
    state.kind === "client" ? state.menu.switcher?.options.find((o) => o.current) : undefined;
  const accountView = current
    ? accountButtonView(current, {
        initials: personInitials(user.name, user.email),
        name: displayName,
      })
    : null;

  return (
    <>
      <MarketingAccountEntry
        viewer={{
          displayName: user.name,
          email: user.email,
          ...(user.image ? { avatarUrl: user.image } : {}),
        }}
        {...(accountView
          ? {
              triggerLabel: accountView.label,
              triggerContent: (
                <DesktopAccountFace
                  view={accountView}
                  user={user}
                  onDark={headerTone === "on-dark"}
                />
              ),
            }
          : {})}
        signInHref={signInHref}
        createAccountHref={registerHref}
        attention={attention}
        headerTone={headerTone}
        // Wide screens get the dropdown; from 768 to 1023px the avatar opens the sheet instead.
        open={isLg && open}
        onOpenChange={setOpen}
        menuItems={
          <DropdownBody
            state={state}
            user={user}
            otherProducts={otherProducts}
            onNavigate={close}
          />
        }
      />
      <MarketingAccountSheet
        open={!isLg && open}
        onOpenChange={setOpen}
        title={displayName}
        description={user.email}
      >
        {state.kind === "client" ? (
          <ClientAccountMenu menu={state.menu} surface="sheet" onNavigate={close} />
        ) : (
          <StaffMenuBody
            groups={state.groups}
            otherProducts={otherProducts}
            onNavigate={close}
            surface="sheet"
          />
        )}
      </MarketingAccountSheet>
    </>
  );
}

/**
 * The header's one account control: "Account" with Sign in and Create account when signed out,
 * the avatar and first name when signed in. Notifications are reached from the account menu.
 */
export function BidHeaderAccount({
  headerTone = "on-light",
  laxProductLinks = [],
}: BidHeaderAccountProps) {
  const { user, pending } = useAppSession();
  const { signInHref, registerHref } = useAuthHeaderLinks();

  if (pending) {
    return (
      <div
        role="status"
        aria-label="Loading account"
        aria-busy="true"
        className={cn(
          "size-11 rounded-full motion-safe:animate-pulse",
          headerTone === "on-dark" ? "bg-white/20" : "bg-surface-container-high/70",
        )}
      />
    );
  }
  if (!user) {
    return (
      <MarketingAccountEntry
        viewer={null}
        signInHref={signInHref}
        createAccountHref={registerHref}
        headerTone={headerTone}
      />
    );
  }
  return <SignedInAccount user={user} headerTone={headerTone} laxProductLinks={laxProductLinks} />;
}
