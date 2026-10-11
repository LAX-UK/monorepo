import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@auction/ui/components/breadcrumb";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export type ArtBreadcrumbItem = {
  label: string;
  href?: string;
};

export type ArtPageHeaderProps = {
  title: string;
  breadcrumbs?: readonly ArtBreadcrumbItem[];
  description?: ReactNode;
  action?: ReactNode;
};

export function ArtPageHeader({ title, breadcrumbs, description, action }: ArtPageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList className="font-label text-xs uppercase tracking-wide text-on-surface-variant">
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={`${item.label}-${item.href ?? "current"}`}>
                  {index > 0 ? <BreadcrumbSeparator>/</BreadcrumbSeparator> : null}
                  <BreadcrumbItem>
                    {item.href && !isLast ? (
                      <BreadcrumbLink asChild className="art-focus-ring rounded-sm">
                        <Link href={item.href}>{item.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-on-surface">{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-2">
          <h1 className="font-headline text-[length:var(--text-display-md)] font-semibold tracking-tight text-on-surface">
            {title}
          </h1>
          {description ? <div className="text-on-surface-variant">{description}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
