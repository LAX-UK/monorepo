"use client";

import { AdminRetryButton } from "@/components/admin-retry-button.client";
import {
  CONSIGNOR_NOT_SET,
  type ConsignorAgreementLine,
  consignorAgreementLine,
  consignorHistory,
  consignorHref,
  consignorName,
  moreHistoryNote,
  otherAgreementsNote,
  setterName,
} from "@/server/domain/artwork-consignor.vm";
import type { AdminArtworkConsignor } from "@auction/shop-contracts";
import {
  EmptyState,
  ErrorState,
  KeyValueList,
  Section,
  StaffButton,
  StaffDate,
  StatusBadge,
  Timeline,
  londonToday,
} from "@auction/staff-ui";
import { UserRound } from "@auction/staff-ui/icons";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { SetConsignorDialog } from "./set-consignor-dialog.client";

export type ConsignorSectionState =
  | { kind: "loaded"; consignor: AdminArtworkConsignor }
  | { kind: "failed" };

const TITLE = "Consignor";
/** The anchor a "Set consignor" link elsewhere in LAX Admin opens the record at. */
const ANCHOR = "consignor";
const DESCRIPTION = "Who consigned this work to LAX. Changes are kept in its history.";

/**
 * Who consigned the artwork, on its From Zoho record (ZI-5): a client, with whether one of their
 * agreements is in force today, or LAX itself. People who keep consignor agreements set it and
 * change it, with a reason after the first time; everyone who can read agreements reads it and
 * its history. People who cannot read it never get the section (the page leaves it out).
 */
export function ConsignorSection({
  registerId,
  title,
  state,
  today = londonToday(),
}: {
  registerId: string;
  /** The artwork's title, for the dialog. */
  title: string;
  state: ConsignorSectionState;
  /** The London day agreements are read against; given in tests and screenshots. */
  today?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (state.kind === "failed") {
    return (
      <Section id={ANCHOR} title={TITLE}>
        <ErrorState
          size="compact"
          headingLevel="h3"
          title="The consignor did not load"
          description="Something went wrong on our side. Try again in a moment."
          action={<AdminRetryButton />}
        />
      </Section>
    );
  }

  const { consignor } = state;
  const current = consignor.current;
  const setButton = (
    <StaffButton
      variant="secondary"
      size="sm"
      requires="consignor_agreement.manage"
      icon={<UserRound aria-hidden />}
      onClick={() => setEditing(true)}
    >
      {current ? "Change consignor…" : "Set consignor…"}
    </StaffButton>
  );

  return (
    <>
      <Section id={ANCHOR} title={TITLE} description={DESCRIPTION} action={setButton}>
        {current ? (
          <div className="flex flex-col gap-4">
            <KeyValueList
              items={[
                { label: "Consignor", value: <ConsignorValue consignor={consignor} /> },
                ...agreementItems(consignorAgreementLine(consignor, today), consignor),
                {
                  label: current.changeReason ? "Changed" : "Set",
                  value: (
                    <span>
                      <StaffDate value={current.setAt} withTime /> by {setterName(current)}
                    </span>
                  ),
                },
              ]}
            />
            <div className="flex flex-col gap-2">
              <h3 className="text-staff-sm font-medium text-staff-fg">Changes</h3>
              <Timeline label="Consignor history" events={consignorHistory(consignor)} />
              {consignor.moreHistory ? (
                <p className="text-staff-xs text-staff-muted">
                  {moreHistoryNote(consignor.history.length)}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <EmptyState
            size="compact"
            headingLevel="h3"
            title={`Consignor ${CONSIGNOR_NOT_SET.toLowerCase()}`}
            description="Say which client consigned this work, or that LAX owns it, so a move can read their agreement."
          />
        )}
      </Section>
      {editing ? (
        <SetConsignorDialog
          registerId={registerId}
          title={title}
          current={current}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}

function ConsignorValue({ consignor }: { consignor: AdminArtworkConsignor }) {
  const current = consignor.current;
  if (!current) return <span className="text-staff-muted">{CONSIGNOR_NOT_SET}</span>;
  const href = consignorHref(current.consignor);
  return href ? (
    <Link href={href} className="font-medium text-staff-fg underline-offset-2 hover:underline">
      {consignorName(current.consignor)}
    </Link>
  ) : (
    <span className="font-medium text-staff-fg">{consignorName(current.consignor)}</span>
  );
}

/** The Agreement row: none for LAX, which needs no agreement. */
function agreementItems(
  line: ConsignorAgreementLine,
  consignor: AdminArtworkConsignor,
): { label: string; value: ReactNode }[] {
  const href = consignor.current ? consignorHref(consignor.current.consignor) : null;
  switch (line.kind) {
    case "not_set":
    case "lax":
      return [];
    case "none":
      return [
        {
          label: "Agreement",
          value: (
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="warning">No agreement</StatusBadge>
              {href ? (
                <Link
                  href={href}
                  className="text-staff-sm text-staff-fg underline underline-offset-2"
                >
                  Add one on the client's page
                </Link>
              ) : null}
            </span>
          ),
        },
      ];
    case "agreement":
      return [
        {
          label: "Agreement",
          value: (
            <span className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={line.badge.tone}>{line.badge.label}</StatusBadge>
                <span className="text-staff-fg">{line.places}</span>
              </span>
              <span className="text-staff-xs text-staff-muted">
                {line.dates}
                {line.others > 0 ? ` · ${otherAgreementsNote(line.others)}` : ""}
              </span>
            </span>
          ),
        },
      ];
  }
}
