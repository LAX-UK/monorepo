import { type KycCompliancePillTone, kycComplianceIdentityPill } from "@/components/kyc/kyc-copy";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { dashboardIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { cn } from "@auction/ui";
import type { DotStatusPillTone } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import {
  AlertTriangle,
  Hourglass,
  type LucideIcon,
  MailCheck,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

export type PayoutSetupPill = {
  ready: boolean;
  href: string;
};

type PillTone = KycCompliancePillTone;

type StatusPill = {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  href: string;
  tone: PillTone;
  /** Optional helper, shown on hover via title attribute. */
  hint?: string;
};

const TONE_CLASSES: Record<PillTone, string> = {
  ok: "border-border-hairline bg-surface-container-low/60 text-on-surface",
  info: "border-primary/30 bg-primary/10 text-primary",
  warn: "border-lot-orange/35 bg-lot-orange/10 text-lot-orange",
  danger: "border-live-red/40 bg-live-red/10 text-live-red",
};

function complianceStripDotTone(tone: PillTone): DotStatusPillTone {
  if (tone === "ok") return "success";
  if (tone === "warn") return "warning";
  if (tone === "danger") return "critical";
  return "info";
}

type ComplianceStatusStripProps = {
  user: Pick<SessionUser, "emailVerified" | "emailStatus" | "kycStatus">;
  kyc: KycStatusSummaryDto | null;
  /** Number of saved addresses; 0 means none on file. */
  addressesCount: number;
  className?: string;
  /** When true, omit the identity pill (e.g. KYC blocking banner already covers it). */
  hideIdentityPill?: boolean;
  /** When true, omit the address pill (e.g. addresses slice failed to load). */
  hideAddressPill?: boolean;
  /** Seller workspace: payout setup readiness pill. */
  payoutSetup?: PayoutSetupPill | null;
};

/**
 * What still stands between a buyer and paying at checkout: identity not yet verified, an email
 * that cannot be reached, no address to ship to. Anything that is already fine is left out, and
 * with nothing to fix the strip renders nothing, so it is only ever a to-do list.
 *
 * Buying pages do not carry it. Two-step verification and other account settings live in LAX
 * Account, so there is no pill for them here.
 */
export function ComplianceStatusStrip({
  user,
  kyc,
  addressesCount,
  className,
  hideIdentityPill = false,
  hideAddressPill = false,
  payoutSetup = null,
}: ComplianceStatusStripProps) {
  const pills: StatusPill[] = [];

  if (payoutSetup) {
    pills.push({
      id: "payout-setup",
      icon: WalletCards,
      label: "Payouts",
      value: payoutSetup.ready ? "Ready" : "Setup needed",
      href: payoutSetup.href,
      tone: payoutSetup.ready ? "ok" : "warn",
      hint: payoutSetup.ready
        ? "Payout account is ready for settlement"
        : "Complete payout setup to receive transfers",
    });
  }

  // Identity verification
  if (!hideIdentityPill) {
    if (kyc) {
      const identityPill = kycComplianceIdentityPill(kyc);
      const IdentityIcon =
        kyc.status === "approved"
          ? ShieldCheck
          : kyc.feedback?.needsResubmit || kyc.status === "rejected"
            ? ShieldAlert
            : identityPill.value === "In review"
              ? Hourglass
              : ShieldAlert;
      pills.push({
        id: "kyc",
        icon: IdentityIcon,
        label: "Identity",
        value: identityPill.value,
        href: dashboardIdentityOnboardingHref(),
        tone: identityPill.tone,
        ...(identityPill.hint !== undefined ? { hint: identityPill.hint } : {}),
      });
    } else if (user.kycStatus === "approved") {
      pills.push({
        id: "kyc",
        icon: ShieldCheck,
        label: "Identity",
        value: "Verified",
        href: dashboardIdentityOnboardingHref(),
        tone: "ok",
      });
    }
  }

  // Email verification / deliverability
  if (user.emailVerified === false) {
    pills.push({
      id: "email",
      icon: AlertTriangle,
      label: "Email",
      value: "Unverified",
      href: "/register/verify-pending?next=%2Fdashboard",
      tone: "warn",
      hint: "Resend the verification link to your inbox",
    });
  } else if (user.emailStatus === "bounced") {
    pills.push({
      id: "email",
      icon: AlertTriangle,
      label: "Email",
      value: "Bouncing",
      href: laxAccountUrl("/account/profile"),
      tone: "danger",
    });
  } else if (user.emailStatus === "complained") {
    pills.push({
      id: "email",
      icon: AlertTriangle,
      label: "Email",
      value: "Complaint",
      href: laxAccountUrl("/account/profile"),
      tone: "danger",
    });
  } else if (user.emailVerified === true) {
    pills.push({
      id: "email",
      icon: MailCheck,
      label: "Email",
      value: "Verified",
      href: laxAccountUrl("/account/profile"),
      tone: "ok",
    });
  }

  // Shipping address availability
  if (!hideAddressPill) {
    pills.push({
      id: "address",
      icon: MapPin,
      label: "Address",
      value: addressesCount > 0 ? `${addressesCount} on file` : "Add address",
      href: laxAccountUrl("/account/profile"),
      tone: addressesCount > 0 ? "ok" : "warn",
    });
  }

  // Only what needs doing is shown; a pill that is fine would just be noise.
  const todo = pills.filter((pill) => pill.tone !== "ok");
  if (todo.length === 0) return null;

  return (
    <nav
      aria-label="Before you pay"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-border-hairline bg-surface-container-lowest/60 p-3 shadow-sm",
        className,
      )}
    >
      {todo.map((pill) => (
        <Link
          key={pill.id}
          href={pill.href}
          title={pill.hint}
          aria-label={
            pill.hint
              ? `${pill.label}: ${pill.value}. ${pill.hint}`
              : `${pill.label}: ${pill.value}`
          }
          className={cn(
            "group inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            TONE_CLASSES[pill.tone],
          )}
        >
          <span className={cn("size-2 rounded-full", "sr-only")} aria-hidden />
          <pill.icon className="size-3.5 opacity-80" aria-hidden />
          <span className="font-label text-xs font-medium opacity-80">{pill.label}</span>
          <DotStatusPill label={pill.value} tone={complianceStripDotTone(pill.tone)} />
        </Link>
      ))}
    </nav>
  );
}
