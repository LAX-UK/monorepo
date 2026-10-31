"use client";

import { AppShellBreadcrumbs } from "@/components/layout/app-shell-breadcrumbs";
import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import type { SessionUser } from "@/lib/data/contracts";
import { ClientGlobalHotkeys } from "@/lib/hotkeys/client-global-hotkeys";
import { ClientHotkeyHelpDialog } from "@/lib/hotkeys/client-hotkey-help-dialog";
import { type HotkeyHelpRenderer, HotkeyProvider } from "@/lib/hotkeys/hotkey-provider";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { buildClientBreadcrumbTrail } from "@/lib/navigation/client-breadcrumb-trail";
import type { ClientNavSection } from "@/lib/navigation/client-nav-model";
import { resolveMobileShellTitle } from "@/lib/navigation/mobile-shell-title";
import { ShellChromeProvider, useShellChrome } from "@/lib/shell/shell-chrome-context";
import type { SearchPage } from "@/lib/workspace/workspace-search-model";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { LaxDensityProvider, laxDensityAttributes } from "@auction/ui/lax";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo, useRef } from "react";
import { usePageTitleInBar } from "./use-page-title-in-bar";
import type { WorkspaceNavCounts } from "./workspace-nav-list";
import { WorkspaceSearch } from "./workspace-search";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceTabBar } from "./workspace-tab-bar";
import { WorkspaceTopBar } from "./workspace-top-bar";

const renderHelp: HotkeyHelpRenderer = (props) => <ClientHotkeyHelpDialog {...props} />;

/** The shell the shared header parts draw for. */
const CLIENT_SHELL_ROLE = "client" as const;

export type WorkspaceShellProps = {
  user: SessionUser;
  /** The account in use and its switcher. */
  account: AccountChrome;
  /** The member's role, as the switcher names it: "Owner". */
  roleLabel: string;
  sections: readonly ClientNavSection[];
  /** The phone's bottom tabs, the role's own plus More. */
  tabs: readonly AppShellNavItem[];
  /** Needs-you counts by menu entry id, without zeros. */
  needsYou: Readonly<Record<string, number>>;
  familyLinks: readonly LaxFamilyLinkVm[];
  /** Notices about the account (a switch elsewhere, a failed read), above the page. */
  banner?: ReactNode;
  topSlot?: ReactNode;
  children: ReactNode;
};

function WorkspaceFrame({
  user,
  account,
  roleLabel,
  sections,
  tabs,
  needsYou,
  familyLinks,
  banner,
  topSlot,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const scrolledTitle = usePageTitleInBar(mainRef);
  const { mobileTitleOverride, hideBottomTabBar } = useShellChrome();
  const { unread } = useUnreadNotifications();
  const counts: WorkspaceNavCounts = useMemo(() => ({ needsYou, unread }), [needsYou, unread]);
  const phoneTitle = useMemo(() => {
    const model = resolveMobileShellTitle(buildClientBreadcrumbTrail(pathname));
    return mobileTitleOverride ? { ...model, title: mobileTitleOverride } : model;
  }, [pathname, mobileTitleOverride]);
  const pages: (SearchPage & { icon: LucideIcon })[] = useMemo(
    () =>
      sections.flatMap((section) =>
        section.items
          .filter((item) => !item.external)
          .map((item) => ({ id: item.id, label: item.label, href: item.href, icon: item.icon })),
      ),
    [sections],
  );

  return (
    <div
      {...laxDensityAttributes("client")}
      data-workspace-shell=""
      className="flex h-[calc(100dvh-var(--view-as-client-banner-height,0px))] flex-col overflow-hidden bg-lax-page font-body text-lax-fg"
    >
      <ClientGlobalHotkeys pages={pages} />
      <WorkspaceTopBar
        user={user}
        familyLinks={familyLinks}
        phoneTitle={phoneTitle}
        scrolledTitle={scrolledTitle}
        search={
          <WorkspaceSearch
            accountId={account.current.id}
            accountName={account.current.name}
            roleLabel={roleLabel}
            pages={pages}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-lax-line bg-lax-side lg:block">
          <WorkspaceSidebar
            account={account}
            sections={sections}
            pathname={pathname}
            counts={counts}
          />
        </aside>
        <main
          id="main-content"
          ref={mainRef}
          // The main area scrolls on its own, so it must be reachable with Tab (WCAG 2.1.1).
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard reachable
          tabIndex={0}
          className="lax-focus-inset min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
        >
          {/* A left-aligned column up to 1120px; forms keep their own 960px. */}
          <div className="w-full max-w-[calc(70rem+5rem)] px-4 pt-6 pb-10 lg:px-10 lg:pt-8">
            <div className="hidden lg:mb-4 lg:block lg:empty:hidden">
              <AppShellBreadcrumbs role={CLIENT_SHELL_ROLE} sessionUser={user} variant="desktop" />
            </div>
            {topSlot ? <div className="mb-6 empty:hidden">{topSlot}</div> : null}
            {banner ? <div className="mb-6 space-y-4 empty:hidden">{banner}</div> : null}
            {children}
          </div>
        </main>
      </div>
      {tabs.length > 0 && !hideBottomTabBar ? (
        <WorkspaceTabBar
          tabs={tabs}
          sections={sections}
          account={account}
          pathname={pathname}
          counts={counts}
        />
      ) : null}
    </div>
  );
}

/**
 * The organisation workspace's shell: one 48px bar, a role-shaped sidebar with the account
 * switcher, a left-aligned content column, and the role's bottom tabs on a phone, with the
 * client key set (`?` lists it). It draws at
 * the client density, and moves every page inside it onto the LAX system's surfaces.
 */
export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <LaxDensityProvider density="client">
      <TooltipProvider delayDuration={300}>
        <ShellChromeProvider>
          <HotkeyProvider scope="page" renderHelp={renderHelp}>
            <WorkspaceFrame {...props} />
          </HotkeyProvider>
        </ShellChromeProvider>
      </TooltipProvider>
    </LaxDensityProvider>
  );
}
