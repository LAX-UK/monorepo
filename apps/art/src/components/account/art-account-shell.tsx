import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import type { ArtAccountNavItem } from "@/lib/account/account-nav.vm";
import type { ArtAccountPageResult } from "@/lib/account/account-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

export type ArtAccountShellProps = {
  title: string;
  nav: readonly ArtAccountNavItem[];
  children: ReactNode;
};

export function ArtAccountShell({ title, nav, children }: ArtAccountShellProps) {
  const breadcrumbs =
    title === "Profile"
      ? [{ label: "Account" }]
      : [{ label: "Account", href: "/account" }, { label: title }];
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-6 lg:py-10")}>
      <ArtPageHeader title={title} breadcrumbs={breadcrumbs} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[12rem_1fr]">
        <nav
          aria-label="Account sections"
          className="-mx-1 overflow-x-auto lg:mx-0 lg:overflow-visible"
        >
          <ul className="flex flex-row gap-1 px-1 lg:flex-col lg:px-0">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "art-focus-ring flex min-h-11 items-center whitespace-nowrap rounded-md px-3 font-label text-sm uppercase tracking-wide",
                    item.active
                      ? "bg-surface-container-high text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

/** Applies gate outcomes (redirect, 404, identity outage) and renders the shell for `ok`. */
export function ArtAccountPage<T>({
  result,
  title,
  children,
}: {
  result: ArtAccountPageResult<T>;
  title: string;
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
    <ArtAccountShell title={title} nav={result.nav}>
      {children(result.vm)}
    </ArtAccountShell>
  );
}
