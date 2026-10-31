"use client";

import { useReadOnlyView } from "@/components/layout/view-as-client/read-only-boundary";
import { acceptConsignmentAgreementAction } from "@/lib/actions/consignment-agreement";
import type { ConditionsSection } from "@/lib/legal/conditions-of-business-part-c";
import { consignmentAgreementViewModel } from "@/lib/seller/consignment-agreement-view";
import { notify } from "@/lib/ui/notify";
import { agreementTermsComplete } from "@auction/domain";
import type { ConsignmentAgreement } from "@auction/types";
import { cn } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Label } from "@auction/ui/components/label";
import { Surface } from "@auction/ui/components/surface";
import { CheckCircle2, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  agreement: ConsignmentAgreement;
  /** The person may accept for this account (from the capability matrix). */
  canAccept: boolean;
  /** "your own name" or the organisation's name, said on the confirmation. */
  accountName: string;
  accountKind: "personal" | "organisation";
  /** Part C of the Conditions of Business, version 1. */
  conditions: readonly ConditionsSection[];
};

function ConditionsText({ conditions }: { conditions: readonly ConditionsSection[] }) {
  return (
    <div className="space-y-4 font-body text-sm leading-relaxed text-on-surface-variant">
      {conditions.map((section) =>
        section.paragraphs.length === 0 && !section.bullets ? (
          <h3 key={section.title} className="font-headline text-base text-on-surface">
            {section.title.replace(" — ", ": ")}
          </h3>
        ) : (
          <section key={section.title} className="space-y-2">
            <h4 className="font-body text-sm font-semibold text-on-surface">{section.title}</h4>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets ? (
              <ul className="list-disc space-y-1 pl-5">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ),
      )}
    </div>
  );
}

/**
 * The consignment agreement on the consignment page: the specialist's estimate and terms, the
 * seller conditions to read, and the acceptance. Once accepted it records who accepted, when
 * and which version, and stays readable.
 */
export function ConsignmentAgreementPanel({
  agreement,
  canAccept,
  accountName,
  accountKind,
  conditions,
  pdfHref = null,
}: Props & {
  /** The agreement as a PDF to keep, once its terms are set. */
  pdfHref?: string | null;
}) {
  const router = useRouter();
  const vm = consignmentAgreementViewModel(agreement);
  const [confirmed, setConfirmed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const checkboxId = useId();
  const termsId = useId();
  const readOnlyView = useReadOnlyView();

  const accept = () => {
    setFailure(null);
    startTransition(async () => {
      const result = await acceptConsignmentAgreementAction(
        agreement.submissionId,
        agreement.termsVersion,
      );
      if (result.ok) {
        notify.success("Agreement accepted");
        router.refresh();
        return;
      }
      setFailure(result.error);
    });
  };

  // No estimate and commission yet: nothing to read or accept until the specialist sends them.
  if (!agreement.acceptedAt && !agreementTermsComplete(agreement)) {
    return (
      <section id="agreement" aria-labelledby="agreement-heading" className="scroll-mt-24">
        <Surface variant="section" className="space-y-1" data-testid="agreement-pending-terms">
          <h2
            id="agreement-heading"
            className="font-headline text-lg font-semibold tracking-tight text-on-surface"
          >
            Consignment agreement
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            Your specialist will send the estimate and terms. You'll read and accept them here.
          </p>
        </Surface>
      </section>
    );
  }

  return (
    <section id="agreement" aria-labelledby="agreement-heading" className="scroll-mt-24">
      <Surface variant="section" className="space-y-5">
        <div className="space-y-1">
          <h2
            id="agreement-heading"
            className="font-headline text-lg font-semibold tracking-tight text-on-surface"
          >
            Consignment agreement
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            Your specialist's estimate and terms, under the Conditions for Sellers and Consignors (
            {vm.versionName.toLowerCase()}).
          </p>
          {pdfHref ? (
            <a
              href={pdfHref}
              className="inline-flex w-fit items-center gap-1.5 pt-1 font-body text-sm font-medium text-on-surface underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Download className="size-4" aria-hidden />
              Download agreement (PDF)
            </a>
          ) : null}
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {vm.terms.map((term) => (
            <div key={term.label} className="space-y-0.5">
              <dt className="font-body text-xs text-on-surface-variant">{term.label}</dt>
              <dd className="font-body text-sm font-semibold tabular-nums text-on-surface">
                {term.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2">
          <p id={termsId} className="font-body text-sm font-semibold text-on-surface">
            Conditions for Sellers and Consignors
          </p>
          {/* A long legal text reads in its own scrolling region, reachable by keyboard. In a
              read-only view, where every control is off, it is shown in full instead. */}
          <section
            aria-labelledby={termsId}
            tabIndex={readOnlyView ? undefined : 0}
            className={cn(
              "rounded-lg border border-border-hairline bg-surface-container-low p-4",
              !readOnlyView &&
                "max-h-72 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <ConditionsText conditions={conditions} />
          </section>
          <p className="font-body text-xs text-on-surface-variant">
            Part C of the{" "}
            <Link href="/terms#sellers" className="text-link underline underline-offset-4">
              Conditions of Business
            </Link>
            .
          </p>
        </div>

        {vm.accepted ? (
          <p
            className="flex items-start gap-2 font-body text-sm text-on-surface"
            data-testid="agreement-accepted"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span>
              Accepted by {vm.accepted.by} on {vm.accepted.on} · {vm.versionName}
            </span>
          </p>
        ) : canAccept ? (
          <div className="space-y-4 border-t border-border-hairline pt-5">
            <div className="flex items-start gap-3">
              <Checkbox
                id={checkboxId}
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
                className="mt-0.5"
                disabled={pending}
              />
              <Label
                htmlFor={checkboxId}
                className="font-body text-sm leading-snug text-on-surface"
              >
                {accountKind === "organisation"
                  ? `I have read the conditions and accept the agreement for ${accountName}.`
                  : "I have read the conditions and accept the agreement."}
              </Label>
            </div>
            {failure ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{failure}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="button"
              variant="primary"
              onClick={accept}
              disabled={!confirmed || pending}
              data-testid="agreement-accept"
            >
              {pending
                ? "Accepting…"
                : accountKind === "organisation"
                  ? `Accept for ${accountName}`
                  : "Accept agreement"}
            </Button>
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              Only an owner or admin of {accountName} can accept this agreement.
            </AlertDescription>
          </Alert>
        )}
      </Surface>
    </section>
  );
}
