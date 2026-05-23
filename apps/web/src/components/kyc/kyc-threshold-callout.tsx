import Link from "next/link";
import { KYC_BID_BLOCKED_DESCRIPTION } from "./kyc-copy";

type Props = {
  /** Post-verification return path (e.g. lot page). Passed as verify-identity `?next=`. */
  returnPath?: string;
};

export function KycThresholdCallout({ returnPath }: Props) {
  const verifyHref = returnPath
    ? `/dashboard/verify-identity?next=${encodeURIComponent(returnPath)}`
    : "/dashboard/verify-identity";

  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-center text-sm text-on-surface-variant">
      <p className="font-medium text-on-surface">Identity verification required</p>
      <p className="mt-2">{KYC_BID_BLOCKED_DESCRIPTION}</p>
      <p className="mt-3">
        <Link className="font-semibold text-primary underline underline-offset-2" href={verifyHref}>
          Verify identity
        </Link>
      </p>
    </div>
  );
}
