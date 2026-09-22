import { FOCUS_RING } from "@auction/branding";
import { MarketingCatalogHubShell } from "@auction/marketing-ui";
import { DisplayHeading } from "@auction/ui";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

type ShopCatalogueHubProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function ShopCatalogueHub({ title, description, children, footer }: ShopCatalogueHubProps) {
  return (
    <MarketingCatalogHubShell footer={footer} shellClassName="flex flex-col gap-8 py-8 lg:py-12">
      <header className="flex max-w-[var(--container-inner,86rem)] flex-col gap-3">
        <DisplayHeading as="h1" size="md">
          {title}
        </DisplayHeading>
        {description ? (
          <p className="font-headline text-[length:var(--text-display-sm)] font-normal leading-snug text-on-surface">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </MarketingCatalogHubShell>
  );
}

export function ShopCataloguePagerLink({
  href,
  children,
}: {
  href: string | { pathname: string; query?: Record<string, string> };
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center text-link underline-offset-4 hover:underline",
        FOCUS_RING,
      )}
    >
      {children}
    </Link>
  );
}
