"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { recordCertificateAuthority } from "@/server/application/print-fulfilment-actions.server";
import { legalEntityFor } from "@auction/branding";
import { AUTHORITY_REFERENCE_FIELD_MAX } from "@auction/shop-contracts";
import type { AdminEditionRunDetail } from "@auction/shop-contracts";
import { Field, Section, StaffButton, TextInput, formatStaffDate } from "@auction/staff-ui";
import { useId, useState } from "react";

/** Whether the run's certificate is one London Art Exchange Ltd issues for the artist. */
export function laxIssuesCertificate(run: Pick<AdminEditionRunDetail, "facts">): boolean {
  const certificate = run.facts?.certificate;
  return certificate?.kind === "included" && certificate.issuer === "lax";
}

export const AUTHORITY_REFERENCE_EMPTY = "Say where the artist's written authority is kept.";

/**
 * The artist's written authority for certificates that London Art Exchange Ltd issues for this
 * run. Packing a print waits until it is recorded. One field, so a missing reference is shown
 * against it and nowhere else.
 */
export function CertificateAuthorityCard({
  artworkId,
  authority,
  canWrite,
}: {
  artworkId: string;
  authority: AdminEditionRunDetail["certificateAuthority"];
  canWrite: boolean;
}) {
  const action = useAdminAction();
  const fieldId = useId();
  const [reference, setReference] = useState(authority?.reference ?? "");
  const [attempted, setAttempted] = useState(false);
  const error = attempted && !reference.trim() ? AUTHORITY_REFERENCE_EMPTY : undefined;
  const changed = reference.trim() !== (authority?.reference ?? "");

  const submit = async () => {
    setAttempted(true);
    if (!reference.trim()) return;
    await action.run(
      () =>
        recordCertificateAuthority({
          artworkId,
          reference: reference.trim(),
          idempotencyKey: action.idempotencyKey,
        }),
      "The artist's authority is recorded",
    );
  };

  return (
    <Section
      title="Certificate authority"
      description={`${legalEntityFor("shop").name} issues this run's certificates on the artist's written authority.`}
    >
      {canWrite ? (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {action.error}
          <Field
            id={fieldId}
            label="Where the authority is kept"
            description={
              authority
                ? `Recorded on ${formatStaffDate(authority.recordedAt)}. Packing can go ahead.`
                : "A document name, date or filing reference. Packing waits until this is recorded."
            }
            error={error}
          >
            <TextInput
              value={reference}
              autoComplete="off"
              maxLength={AUTHORITY_REFERENCE_FIELD_MAX}
              onChange={(event) => setReference(event.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <StaffButton
              type="submit"
              variant="primary"
              loading={action.pending}
              disabled={!changed}
            >
              {authority ? "Update reference" : "Record authority"}
            </StaffButton>
          </div>
        </form>
      ) : authority ? (
        <p className="text-staff-sm text-staff-fg">
          {authority.reference}
          <span className="text-staff-muted">
            {" "}
            · recorded on {formatStaffDate(authority.recordedAt)}
          </span>
        </p>
      ) : (
        <p className="text-staff-sm text-staff-muted">
          Packing waits until the artist's authority is recorded.
        </p>
      )}
    </Section>
  );
}
