import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import Link from "next/link";
import { KYC_BID_BLOCKED_DESCRIPTION } from "./kyc-copy";

type Props = {
  /** Post-verification return path (e.g. lot page). Passed as verify-identity `?next=`. */
  returnPath?: string;
  feedback?: Pick<KycUserFeedbackDto, "headline" | "detail" | "needsResubmit" | "action"> | null;
};

export function KycThresholdCallout({ returnPath, feedback }: Props) {
  const verifyHref = returnPath
    ? `/dashboard/verify-identity?next=${encodeURIComponent(returnPath)}`
    : "/dashboard/verify-identity";

  const headline = feedback?.headline ?? "Identity verification required";
  const detail = feedback?.detail ?? KYC_BID_BLOCKED_DESCRIPTION;
  const ctaLabel =
    feedback?.needsResubmit || feedback?.action === "continue"
      ? "Continue verification"
      : feedback?.action === "retry"
        ? "Try again"
        : "Verify identity";

  return (
    <div
      className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-center text-sm text-on-surface-variant"
      role="alert"
      aria-live="polite"
    >
      <p className="font-medium text-on-surface">{headline}</p>
      <p className="mt-2 text-pretty">{detail}</p>
      <p className="mt-3">
        <Link className="font-semibold text-primary underline underline-offset-2" href={verifyHref}>
          {ctaLabel}
        </Link>
      </p>
    </div>
  );
}
