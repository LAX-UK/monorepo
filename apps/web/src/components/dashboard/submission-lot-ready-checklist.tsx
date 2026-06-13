import { lotPath } from "@/lib/seo/url";
import { evaluateLotReadiness, evaluateSubmissionQuality } from "@auction/domain";
import type { ItemSubmission, Lot } from "@auction/types";
import { CheckCircle2, CircleAlert } from "lucide-react";
import Link from "next/link";

type Props = {
  submission: ItemSubmission;
  lot?: Pick<
    Lot,
    | "images"
    | "description"
    | "sellerLegalEntityId"
    | "artistReviewRequired"
    | "saleId"
    | "startTime"
    | "endTime"
  > | null;
  connectRequired?: boolean;
};

export function SubmissionLotReadyChecklist({ submission, lot, connectRequired = false }: Props) {
  if (submission.status !== "approved" && submission.status !== "converted") {
    return null;
  }

  if (submission.status === "approved") {
    const quality = evaluateSubmissionQuality(submission);
    const connectCheck = {
      id: "connect",
      label: "Stripe Connect for payouts",
      ok: !connectRequired,
      severity: "warning" as const,
    };
    const checks = [...quality.checks, connectCheck];
    const percent = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

    return (
      <div className="space-y-3 rounded-lg border border-border-hairline bg-surface-container-low/50 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-headline text-base text-on-surface">Next steps</h3>
          <span className="font-label text-xs font-semibold uppercase tracking-wider text-secondary">
            {percent}%
          </span>
        </div>
        <p className="font-body text-sm text-on-surface-variant">
          Your submission was accepted. Complete the items below while specialists prepare your
          catalogue entry.
        </p>
        <ul className="space-y-2">
          {checks
            .filter((c) => !c.ok)
            .map((check) => (
              <li key={check.id} className="font-body text-sm text-on-surface">
                {check.label}
                {check.id === "connect" ? (
                  <>
                    {" — "}
                    <Link
                      href="/dashboard/seller/connect"
                      className="text-link underline-offset-4 hover:underline"
                    >
                      Complete Connect
                    </Link>
                  </>
                ) : check.id === "images-recommended" ? (
                  <span className="text-on-surface-variant">
                    {" — "}
                    Add photos via your specialist while catalogue entry is prepared
                  </span>
                ) : null}
              </li>
            ))}
        </ul>
      </div>
    );
  }

  if (!lot) return null;

  const readiness = evaluateLotReadiness({ ...lot, connectRequired });

  return (
    <div className="space-y-3 rounded-lg border border-border-hairline bg-surface-container-low/50 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-headline text-base text-on-surface">Catalogue readiness</h3>
        <span className="font-label text-xs font-semibold uppercase tracking-wider text-secondary">
          {readiness.percent}%
        </span>
      </div>
      <ul className="space-y-2">
        {readiness.checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 font-body text-sm">
            {check.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden />
            )}
            <span className={check.ok ? "text-on-surface-variant" : "text-on-surface"}>
              {check.label}
              {!check.ok && check.sellerActionable ? (
                <>
                  {" — "}
                  {check.id === "seller" ? (
                    <Link
                      href="/dashboard/seller/connect"
                      className="text-link underline-offset-4 hover:underline"
                    >
                      Complete Connect
                    </Link>
                  ) : check.id === "images" ? (
                    <>
                      <Link
                        href={lotPath({
                          id: submission.convertedLotId ?? "",
                          title: submission.title,
                        })}
                        className="text-link underline-offset-4 hover:underline"
                      >
                        View listing
                      </Link>
                      {" · "}
                      <Link
                        href="/dashboard/seller/in-sale"
                        className="text-link underline-offset-4 hover:underline"
                      >
                        In-sale dashboard
                      </Link>
                    </>
                  ) : null}
                </>
              ) : !check.ok ? (
                <span className="text-on-surface-variant"> (in progress)</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
