import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import type { LegalEntitySummary } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  acting: LegalEntitySummary | null;
};

function supportMailto(subject: string) {
  return `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

function copyForStatus(acting: LegalEntitySummary): {
  title: string;
  body: ReactNode;
} | null {
  const { status, kind } = acting;
  switch (status) {
    case "approved":
      return null;
    case "lead":
      return {
        title: "Account setup",
        body: "Your account is being set up. You'll be notified when ready.",
      };
    case "docs_requested":
      return {
        title: "Documents needed",
        body: (
          <>
            We need documents from you.{" "}
            <Link
              className="font-medium underline underline-offset-2"
              href={
                kind === "organisation"
                  ? `/dashboard/organisations/${acting.id}/documents`
                  : "/dashboard/organisations"
              }
            >
              Upload now
            </Link>
          </>
        ),
      };
    case "docs_received":
    case "under_review":
      return {
        title: "Under review",
        body: "Your account is under review. Check back here for status updates.",
      };
    case "connect_pending":
      return {
        title: "Finish payout setup to sell",
        body: (
          <>
            You can bid now. To sell or receive payouts, add your bank details and verification.{" "}
            <Link
              className="font-medium underline underline-offset-2"
              href={
                kind === "individual"
                  ? DASHBOARD_ROUTES.sellerConnect
                  : `/dashboard/organisations/${acting.id}/connect`
              }
            >
              Continue setup
            </Link>
          </>
        ),
      };
    case "restricted":
      return {
        title: "Account restrictions",
        body: (
          <>
            Your account has restrictions.{" "}
            <a
              className="font-medium underline underline-offset-2"
              href={supportMailto("Account restrictions")}
            >
              Contact support
            </a>
          </>
        ),
      };
    case "rejected":
      return {
        title: "Verification unsuccessful",
        body: (
          <>
            Your account verification was unsuccessful.
            {acting.statusReason ? (
              <span className="mt-1 block text-on-surface-variant">{acting.statusReason}</span>
            ) : null}{" "}
            <a
              className="font-medium underline underline-offset-2"
              href={supportMailto("Verification unsuccessful")}
            >
              Contact support
            </a>
          </>
        ),
      };
    case "archived":
      return {
        title: "Account inactive",
        body: (
          <>
            This account is no longer active.{" "}
            <a
              className="font-medium underline underline-offset-2"
              href={supportMailto("Archived account")}
            >
              Contact support
            </a>
          </>
        ),
      };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function isEntityStatusBannerVisible(acting: LegalEntitySummary | null): boolean {
  if (!acting) return false;
  return copyForStatus(acting) !== null;
}

/**
 * When the acting workspace entity is not fully approved, explain limitations on every dashboard page.
 */
export function EntityStatusBanner({ acting }: Props) {
  if (!acting) return null;
  const copy = copyForStatus(acting);
  if (!copy) return null;

  return (
    <Alert className="border-lot-orange/40 bg-surface-container-low/80" variant="default">
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription className="text-on-surface">{copy.body}</AlertDescription>
    </Alert>
  );
}
