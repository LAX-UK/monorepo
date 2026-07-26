import {
  CatalogBreadcrumbs,
  CatalogDetailShell,
  type CatalogMobileAction,
} from "@/components/admin/catalog";
import type { ReactNode } from "react";

type Props = {
  slug: string;
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  stickySubnav?: ReactNode;
  mobileActions?: readonly CatalogMobileAction[];
  mobileMeta?: ReactNode;
  children: ReactNode;
};

/** Operations detail shell — catalog language for RSVP/check-in workflows. */
export function OperationsDetailShell({
  slug,
  title,
  description,
  eyebrow = "Onsite event",
  meta,
  actions,
  aside,
  stickySubnav,
  mobileActions,
  mobileMeta,
  children,
}: Props) {
  return (
    <CatalogDetailShell
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Event RSVPs", href: "/admin/event-rsvps" },
            { label: title, href: `/admin/event-rsvps/${encodeURIComponent(slug)}` },
          ]}
        />
      }
      eyebrow={eyebrow}
      title={title}
      {...(description ? { description } : {})}
      {...(meta ? { meta } : {})}
      metaBelowTitle
      {...(actions ? { actions } : {})}
      {...(aside ? { aside } : {})}
      {...(stickySubnav ? { stickySubnav } : {})}
      {...(mobileActions ? { mobileActions } : {})}
      {...(mobileMeta ? { mobileMeta } : {})}
    >
      {children}
    </CatalogDetailShell>
  );
}
