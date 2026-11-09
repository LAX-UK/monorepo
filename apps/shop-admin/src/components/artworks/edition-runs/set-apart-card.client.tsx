"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { returnPrintToRun } from "@/server/application/edition-run-actions.server";
import type { AdminSetApartInfo } from "@auction/shop-contracts";
import { describeReturnBlock } from "@auction/shop-domain";
import {
  ConfirmActionDialog,
  KeyValueList,
  Notice,
  Section,
  StaffButton,
  TextLink,
  formatStaffTime,
  toast,
} from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The editor page of a print sold on its own: which print of which run it is, what is different
 * about it, and, while it is unsold, a way to put it back in the run. Its run and edition facts
 * follow the run, so they are changed there.
 */
export function SetApartCard({
  artworkId,
  setApart,
  canWrite,
}: {
  artworkId: string;
  setApart: AdminSetApartInfo;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [returning, setReturning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const block = setApart.returnBlock
    ? describeReturnBlock(
        {
          kind: setApart.returnBlock.kind,
          until: setApart.returnBlock.until ? new Date(setApart.returnBlock.until) : null,
        },
        setApart.label,
        (until) => formatStaffTime(until, { zoneLabel: true }),
      )
    : null;

  function close(next: boolean) {
    if (saving) return;
    if (next) {
      setFormError(null);
      setIdempotencyKey(crypto.randomUUID());
    }
    setReturning(next);
  }

  async function returnIt() {
    setSaving(true);
    setFormError(null);
    const result = await returnPrintToRun({ artworkId, idempotencyKey }).catch(
      () => ({ ok: false, kind: "failed", message: "Returning it failed. Try again." }) as const,
    );
    setSaving(false);
    if (!result.ok) {
      setFormError(adminMutationErrorMessage(result));
      return;
    }
    toast.success(`Print ${setApart.label} is back in ${setApart.runTitle}`);
    setReturning(false);
    router.push(`/artworks/${result.data.artworkId}`);
  }

  return (
    <Section
      id="set-apart"
      title="Sold on its own"
      description={`One print of ${setApart.runTitle}. Its run and edition facts follow the run; change them there.`}
      action={
        canWrite ? (
          <StaffButton
            variant="secondary"
            size="sm"
            disabled={block !== null}
            {...(block ? { title: block.title } : {})}
            onClick={() => close(true)}
          >
            Return print {setApart.label} to the run
          </StaffButton>
        ) : null
      }
      bodyClassName="flex flex-col gap-4 p-4"
    >
      {block ? (
        <Notice tone="warning" title={block.title}>
          {block.detail}
        </Notice>
      ) : null}
      <KeyValueList
        items={[
          { label: "Print", value: setApart.printOf },
          {
            label: "Run",
            value: (
              <TextLink href={`/artworks/${setApart.runArtworkId}`} Link={Link}>
                {setApart.runTitle}
              </TextLink>
            ),
          },
          {
            label: "What is different",
            value: (
              <ul className="flex flex-col gap-1">
                {setApart.differences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ),
          },
        ]}
      />
      <ConfirmActionDialog
        open={returning}
        onOpenChange={close}
        title={`Return print ${setApart.label} to the run?`}
        description={`It joins the queue of ${setApart.runTitle} again, at the run's price. This listing is archived, and shoppers are no longer told what is different about the print. The change is recorded in the audit log.`}
        confirmLabel={`Return print ${setApart.label}`}
        loading={saving}
        onConfirm={() => void returnIt()}
      >
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
      </ConfirmActionDialog>
    </Section>
  );
}
