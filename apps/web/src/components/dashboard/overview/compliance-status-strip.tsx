import { type KycCompliancePillTone, kycComplianceIdentityPill } from "@/components/kyc/kyc-copy";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { dashboardIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { cn } from "@auction/ui";
import {
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  type LucideIcon,
  MapPin,
  ShieldAlert,
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

const TONE_DOT: Record<PillTone, string> = {
  ok: "bg-success",
  info: "bg-primary",
  warn: "bg-lot-orange",
  danger: "bg-live-red",
};

type ComplianceStatusStripProps = {
  user: Pick<SessionUser, "emailVerified" | "emailStatus" | "twoFactorEnabled">;
  kyc: KycStatusSummaryDto | null;
  /** Number of saved addresses; 0 means none on file. */
  addressesCount: number;
  className?: string;
  /** When true, omit the address pill (e.g. addresses slice failed to load). */
  hideAddressPill?: boolean;
  /** Seller workspace: payout setup readiness pill. */
  payoutSetup?: PayoutSetupPill | null;
};

/** Action-only identity and readiness strip for the dashboard.
 *
 * Banners retain detailed, time-sensitive messaging while this strip provides
 * direct links only for checks that still need attention.
 */
export function ComplianceStatusStrip({
  user,
  kyc,
  addressesCount,
  className,
  hideAddressPill = false,
  payoutSetup = null,
}: ComplianceStatusStripProps) {
  const pills: StatusPill[] = [];

  if (payoutSetup && !payoutSetup.ready) {
    pills.push({
      id: "payout-setup",
      icon: WalletCards,
      label: "Payouts",
      value: "Setup needed",
      href: payoutSetup.href,
      tone: "warn",
      hint: "Complete payout setup to receive transfers",
    });
  }

  // Identity verification
  if (kyc && kyc.status !== "approved") {
    const identityPill = kycComplianceIdentityPill(kyc);
    const IdentityIcon =
      kyc.feedback?.needsResubmit || kyc.status === "rejected"
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
  }

  // Email verification / deliverability
  if (user.emailVerified === false) {
    pills.push({
      id: "email",
      icon: AlertTriangle,
      label: "Email",
      value: "Unverified",
      href: "/dashboard/settings/account",
      tone: "warn",
    });
  } else if (user.emailStatus === "bounced") {
    pills.push({
      id: "email",
      icon: AlertTriangle,
      label: "Email",
      value: "Bouncing",
      href: "/dashboard/settings/account",
      tone: "danger",
    });
  } else if (user.emailStatus === "complained") {
    pills.push({
      id: "email",
      icon: AlertTriangle,
      label: "Email",
      value: "Complaint",
      href: "/dashboard/settings/account",
      tone: "danger",
    });
  }

  // Shipping address availability
  if (!hideAddressPill && addressesCount === 0) {
    pills.push({
      id: "address",
      icon: MapPin,
      label: "Address",
      value: "Add address",
      href: "/dashboard/settings/addresses",
      tone: "warn",
    });
  }

  const twoFaOn = user.twoFactorEnabled === true;
  if (!twoFaOn) {
    pills.push({
      id: "2fa",
      icon: CheckCircle2,
      label: "2FA",
      value: "Off",
      href: "/dashboard/settings/security/two-factor",
      tone: "warn",
      hint: "Add an authenticator for stronger protection",
    });
  }

  if (pills.length === 0) return null;

  return (
    <nav
      aria-label="Account readiness"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-border-hairline bg-surface-container-lowest/60 p-3 shadow-sm",
        className,
      )}
    >
      {pills.map((pill) => (
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
          <span className={cn("size-2 rounded-full", TONE_DOT[pill.tone])} aria-hidden />
          <pill.icon className="size-3.5 opacity-80" aria-hidden />
          <span className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] opacity-80">
            {pill.label}
          </span>
          <span className="font-headline text-xs font-semibold">{pill.value}</span>
        </Link>
      ))}
    </nav>
  );
}
