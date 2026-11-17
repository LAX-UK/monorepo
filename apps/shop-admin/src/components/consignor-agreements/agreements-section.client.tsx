"use client";

import { AdminRetryButton } from "@/components/admin-retry-button.client";
import { agreementFileLink } from "@/server/application/admin-consignor-agreement-actions.server";
import {
  AGREEMENT_STATE_BADGES,
  agreementDates,
  agreementState,
  commissionText,
  lowestPriceText,
  placesSentence,
  sortAgreements,
} from "@/server/domain/consignor-agreement.vm";
import type { AdminConsignorAgreement } from "@auction/shop-contracts";
import {
  EmptyState,
  ErrorState,
  KeyValueList,
  Section,
  StaffButton,
  StaffDate,
  StatusBadge,
  londonToday,
  toast,
} from "@auction/staff-ui";
import { FileText, Plus, RefreshCw } from "@auction/staff-ui/icons";
import { useState } from "react";
import { AgreementDialog } from "./agreement-dialog.client";
import { RetireAgreementDialog } from "./retire-agreement-dialog.client";

type Open =
  | { kind: "add" }
  | { kind: "replace"; agreement: AdminConsignorAgreement }
  | { kind: "retire"; agreement: AdminConsignorAgreement }
  | null;

/**
 * A consignor's agreements on their client page (ZI-5): the places LAX may offer their works,
 * from and until when, the lowest price and commission agreed, the signed file and a note. In
 * force first, then not started, expired and retired. People who keep agreements add, replace
 * (a new version, never an edit) and retire them; everyone who can open the page reads them.
 */
export function AgreementsSection({
  partyId,
  consignorName,
  agreements,
  today = londonToday(),
}: {
  partyId: string;
  consignorName: string;
  /** Null when they did not load: the section says so and offers to try again. */
  agreements: readonly AdminConsignorAgreement[] | null;
  /** The London day agreements are read against; given in tests and screenshots. */
  today?: string;
}) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  const add = (
    <StaffButton
      variant="secondary"
      size="sm"
      requires="consignor_agreement.manage"
      icon={<Plus aria-hidden />}
      onClick={() => setOpen({ kind: "add" })}
    >
      Add agreement
    </StaffButton>
  );

  let body: React.ReactNode;
  if (agreements === null) {
    body = (
      <ErrorState
        size="compact"
        headingLevel="h3"
        title="The agreements did not load"
        description="Something went wrong on our side. Try again in a moment."
        action={<AdminRetryButton />}
      />
    );
  } else if (agreements.length === 0) {
    body = (
      <EmptyState
        size="compact"
        headingLevel="h3"
        title="No agreements"
        description={`When ${consignorName} consigns works to LAX, record what they agreed here, with the signed file.`}
      />
    );
  } else {
    body = (
      <ul className="flex flex-col divide-y divide-staff-line-subtle">
        {sortAgreements(agreements, today).map((agreement) => (
          <AgreementItem
            key={agreement.id}
            partyId={partyId}
            agreement={agreement}
            today={today}
            onReplace={() => setOpen({ kind: "replace", agreement })}
            onRetire={() => setOpen({ kind: "retire", agreement })}
          />
        ))}
      </ul>
    );
  }

  return (
    <>
      <Section
        id="agreements"
        title="Agreements"
        description="What they agreed LAX may sell for them, where and on what terms."
        action={agreements === null ? null : add}
        bodyClassName="p-0"
      >
        <div className={agreements?.length ? "" : "p-4"}>{body}</div>
      </Section>
      {open?.kind === "add" || open?.kind === "replace" ? (
        <AgreementDialog
          partyId={partyId}
          consignorName={consignorName}
          agreement={open.kind === "replace" ? open.agreement : null}
          onClose={close}
        />
      ) : null}
      {open?.kind === "retire" ? (
        <RetireAgreementDialog
          partyId={partyId}
          consignorName={consignorName}
          agreement={open.agreement}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function AgreementItem({
  partyId,
  agreement,
  today,
  onReplace,
  onRetire,
}: {
  partyId: string;
  agreement: AdminConsignorAgreement;
  today: string;
  onReplace: () => void;
  onRetire: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const state = agreementState(agreement, today);
  const badge = AGREEMENT_STATE_BADGES[state];
  const retired = state === "retired";

  async function openFile() {
    setOpening(true);
    const link = await agreementFileLink({ partyId, versionId: agreement.id });
    setOpening(false);
    if (link.ok) window.location.assign(link.url);
    else toast.error(link.message);
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4" aria-label={placesSentence(agreement.places)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-staff-sm font-semibold text-staff-fg">
              {placesSentence(agreement.places)}
            </h3>
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </div>
          <p className="text-staff-xs text-staff-muted">
            Version {agreement.version}, added <StaffDate value={agreement.createdAt} />
            {agreement.retiredAt ? (
              <>
                , retired <StaffDate value={agreement.retiredAt} />
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StaffButton
            size="sm"
            variant="ghost"
            icon={<FileText aria-hidden />}
            loading={opening}
            onClick={() => void openFile()}
          >
            Signed file
          </StaffButton>
          {retired ? null : (
            <>
              <StaffButton
                size="sm"
                variant="secondary"
                requires="consignor_agreement.manage"
                icon={<RefreshCw aria-hidden />}
                onClick={onReplace}
              >
                Replace…
              </StaffButton>
              <StaffButton
                size="sm"
                variant="secondary"
                requires="consignor_agreement.manage"
                onClick={onRetire}
              >
                Retire…
              </StaffButton>
            </>
          )}
        </div>
      </div>
      <KeyValueList
        items={[
          { label: "Dates", value: agreementDates(agreement) },
          {
            label: "Lowest price",
            value: lowestPriceText(agreement.lowestPricePence),
            numeric: agreement.lowestPricePence !== null,
          },
          { label: "Commission", value: commissionText(agreement.commissionBasisPoints) },
          ...(agreement.note
            ? [
                {
                  label: "Note",
                  value: <span className="whitespace-pre-line break-words">{agreement.note}</span>,
                },
              ]
            : []),
        ]}
      />
    </li>
  );
}
