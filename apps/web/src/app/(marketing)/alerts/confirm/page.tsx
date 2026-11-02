import {
  type VisitorAlertConfirmResult,
  confirmVisitorAlert,
} from "@/lib/data/http/sale-alerts.server";
import { HOME_ALERTS_HREF } from "@/lib/marketing-cover/cover-alerts-outcome";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { ButtonLink, EmptyState, type EmptyStateProps } from "@auction/ui/lax";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Confirm sale alerts",
  "Confirm your LAX Bid sale alerts.",
);

type View = {
  illustration: EmptyStateProps["illustration"];
  variant: "empty" | "error";
  title: string;
  description: string;
  action: { href: string; label: string };
};

/** What the visitor sees for each result of following the confirmation link. */
const VIEWS: Record<VisitorAlertConfirmResult, View> = {
  confirmed: {
    illustration: "ticket",
    variant: "empty",
    title: "Sale alerts are on",
    description:
      "We'll email you when LAX Bid announces new sales. Every email has a link to unsubscribe.",
    action: { href: "/sales", label: "See upcoming sales" },
  },
  expired: {
    illustration: "askew",
    variant: "error",
    title: "This link has expired",
    description: "Confirmation links work for 48 hours. Sign up again and we'll send a new one.",
    action: { href: HOME_ALERTS_HREF, label: "Sign up again" },
  },
  invalid: {
    illustration: "askew",
    variant: "error",
    title: "This link doesn't work",
    description:
      "It may have been replaced by a newer email. Sign up again and we'll send a new one.",
    action: { href: HOME_ALERTS_HREF, label: "Sign up again" },
  },
  failed: {
    illustration: "askew",
    variant: "error",
    title: "We couldn't confirm just now",
    description: "Nothing has changed. Open the link in your email again in a moment.",
    action: { href: HOME_ALERTS_HREF, label: "Back to sale alerts" },
  },
};

export default async function ConfirmSaleAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const view = VIEWS[token ? await confirmVisitorAlert(token) : "invalid"];

  return (
    <EmptyState
      layout="page"
      className="pt-[var(--header-height)]"
      illustration={view.illustration}
      variant={view.variant}
      title={view.title}
      description={view.description}
      actions={
        <ButtonLink Link={Link} variant="primary" href={view.action.href}>
          {view.action.label}
        </ButtonLink>
      }
    />
  );
}
