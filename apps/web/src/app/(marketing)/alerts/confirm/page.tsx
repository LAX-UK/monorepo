import { AuthLayout } from "@/components/auth/auth-layout";
import {
  type VisitorAlertConfirmResult,
  confirmVisitorAlert,
} from "@/lib/data/http/sale-alerts.server";
import { HOME_ALERTS_HREF } from "@/lib/marketing-cover/cover-alerts-outcome";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { ButtonLink, Notice } from "@auction/ui/lax";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Confirm sale alerts",
  "Confirm your LAX Bid sale alerts.",
);

type View = {
  tone: "success" | "danger";
  title: string;
  body: string;
  action: { href: string; label: string };
};

const VIEWS: Record<VisitorAlertConfirmResult, View> = {
  confirmed: {
    tone: "success",
    title: "Sale alerts are on",
    body: "We'll email you when LAX Bid announces new sales. Every email has a link to unsubscribe.",
    action: { href: "/sales", label: "See upcoming sales" },
  },
  expired: {
    tone: "danger",
    title: "This link has expired",
    body: "Confirmation links work for 48 hours. Sign up again and we'll send a new one.",
    action: { href: HOME_ALERTS_HREF, label: "Sign up again" },
  },
  invalid: {
    tone: "danger",
    title: "This link doesn't work",
    body: "It may have been replaced by a newer email. Sign up again and we'll send a new one.",
    action: { href: HOME_ALERTS_HREF, label: "Sign up again" },
  },
  failed: {
    tone: "danger",
    title: "We couldn't confirm just now",
    body: "Nothing has changed. Open the link in your email again in a moment.",
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
  const result = token ? await confirmVisitorAlert(token) : "invalid";
  const view = VIEWS[result];

  return (
    <AuthLayout title="Sale alerts" description="Email alerts for new LAX Bid sales.">
      <div className="flex flex-col gap-6">
        <Notice
          tone={view.tone}
          title={view.title}
          alert={view.tone === "danger"}
          data-testid="alerts-confirm-result"
        >
          {view.body}
        </Notice>
        <ButtonLink Link={Link} variant="primary" href={view.action.href}>
          {view.action.label}
        </ButtonLink>
      </div>
    </AuthLayout>
  );
}
