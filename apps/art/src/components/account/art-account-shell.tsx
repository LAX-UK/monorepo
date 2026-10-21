import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import type { ArtAccountNavItem } from "@/lib/account/account-nav.vm";
import type {
  ArtAccountIdentityVm,
  ArtAccountPageResult,
} from "@/lib/account/account-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingPageTitle, MarketingSubNav } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Avatar, AvatarFallback } from "@auction/ui/components/avatar";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * `account`: monogram band (Figma 867:16367). `favourites`: centred title band (867:15986).
 * `standalone`: breadcrumb header for routes Figma omits (collection, payouts).
 */
export type ArtAccountLayout = "account" | "favourites" | "standalone";

export type ArtAccountShellProps = {
  layout: ArtAccountLayout;
  title: string;
  nav: readonly ArtAccountNavItem[];
  identity: ArtAccountIdentityVm;
  children: ReactNode;
};

const FAVOURITES_SUBTITLE = "Save favourite works and follow artists to find them again.";

function AccountBand({ identity }: { identity: ArtAccountIdentityVm }) {
  return (
    <header className="flex flex-col items-center gap-4 px-4 py-10 text-center lg:py-14">
      <Avatar className="size-20 border border-border-hairline bg-surface-container lg:size-24">
        <AvatarFallback
          aria-hidden
          className="bg-transparent font-headline text-2xl font-semibold text-on-surface lg:text-3xl"
        >
          {identity.initials ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <h1 className="font-headline text-3xl font-semibold leading-tight text-on-surface lg:text-5xl">
          {identity.name ?? "Your account"}
        </h1>
        {identity.email && identity.name ? (
          <p className="text-base text-on-surface-variant">{identity.email}</p>
        ) : null}
      </div>
    </header>
  );
}

export function ArtAccountShell({ layout, title, nav, identity, children }: ArtAccountShellProps) {
  if (layout === "standalone") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-6 lg:py-10")}>
        <ArtPageHeader
          title={title}
          breadcrumbs={[{ label: "Account", href: "/account" }, { label: title }]}
        />
        <div className="mt-8 min-w-0">{children}</div>
      </div>
    );
  }
  const active = nav.find((item) => item.active)?.id ?? "";
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "pb-12 lg:pb-16")}>
      {layout === "account" ? (
        <AccountBand identity={identity} />
      ) : (
        <MarketingPageTitle title={title} subtitle={FAVOURITES_SUBTITLE} />
      )}
      <MarketingSubNav
        ariaLabel={layout === "account" ? "Account sections" : "Favourites sections"}
        items={nav}
        active={active}
        className="justify-center"
      />
      <div className="mt-8 min-w-0 lg:mt-12">{children}</div>
    </div>
  );
}

/** Applies gate outcomes (redirect, 404, identity outage) and renders the shell for `ok`. */
export function ArtAccountPage<T>({
  result,
  title,
  layout,
  children,
}: {
  result: ArtAccountPageResult<T>;
  title: string;
  layout: ArtAccountLayout;
  children: (vm: T) => ReactNode;
}) {
  if (result.kind === "redirect") redirect(result.to);
  if (result.kind === "not_found") notFound();
  if (result.kind === "unavailable") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtStatusState
          variant="error"
          layout="page"
          titleAs="h1"
          title="Account unavailable"
          description={result.message}
          actions={<ArtStatusStateLink href="/">Return home</ArtStatusStateLink>}
        />
      </div>
    );
  }
  return (
    <ArtAccountShell layout={layout} title={title} nav={result.nav} identity={result.identity}>
      {children(result.vm)}
    </ArtAccountShell>
  );
}
