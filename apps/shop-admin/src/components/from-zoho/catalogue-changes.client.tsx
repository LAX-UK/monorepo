"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { updateCatalogueFromZoho } from "@/server/application/admin-catalogue-change-actions.server";
import { changeRows, joinFields } from "@/server/domain/zoho-link.vm";
import type { AdminCatalogueChange, AdminCatalogueCopy } from "@auction/shop-contracts";
import { ChangesTable, Notice, StaffButton, toast, useStaffAccess } from "@auction/staff-ui";
import { RefreshCw } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";

const COPY_WORDS: Record<AdminCatalogueCopy, { name: string; now: string }> = {
  lax_art: { name: "lax.art listing", now: "lax.art now" },
  bid_lot: { name: "Bid lot", now: "Bid lot now" },
};

/** What a person may do here: the same two capabilities as making the copy in the first place. */
export function useCanUpdateFromZoho(): boolean {
  const access = useStaffAccess();
  return access.can("catalogue.write") && access.can("artwork_register.review");
}

type ChangeViewProps = {
  change: AdminCatalogueChange;
  /** Whether this person may update; they still see the difference without it. */
  canUpdate: boolean;
  saving: boolean;
  /** Why the last attempt failed; the difference stays on screen so staff can try again. */
  formError: string | null;
  onUpdate: () => void;
};

/**
 * One copy of an artwork that no longer matches Zoho: the fields that differ, with the copy's
 * value beside Zoho's, then either "Update from Zoho" (a draft) or why staff decide (published,
 * in a live or upcoming sale). It renders from props, so every state can be drawn on its own.
 */
export function CatalogueChangeView({
  change,
  canUpdate,
  saving,
  formError,
  onUpdate,
}: ChangeViewProps) {
  const words = COPY_WORDS[change.copy];
  const changed = change.comparison.filter((row) => row.changes).map((row) => row.label);
  return (
    <Notice
      tone="warning"
      title={`Zoho changed since it was listed: ${words.name}`}
      actions={
        change.canUpdate && canUpdate ? (
          <StaffButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw aria-hidden />}
            loading={saving}
            onClick={onUpdate}
          >
            {formError ? "Try again" : "Update from Zoho"}
          </StaffButton>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        <p>
          Zoho has a different {joinFields(changed)}. The{" "}
          {change.state === "draft"
            ? `${words.name} is a draft, so it can take Zoho's values.`
            : `${words.name} keeps what it had until staff decide.`}
        </p>
        <ChangesTable
          label={`What differs on the ${words.name}`}
          beforeHeading={words.now}
          afterHeading="Zoho now"
          rows={changeRows(change.comparison)}
        />
        {change.note ? <p className="text-staff-xs text-staff-muted">{change.note}</p> : null}
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
      </div>
    </Notice>
  );
}

/** The copies of one artwork that differ from Zoho. Renders nothing when they all match. */
export function CatalogueChanges({
  registerId,
  changes,
}: {
  registerId: string;
  changes: readonly AdminCatalogueChange[];
}) {
  const router = useRouter();
  const canUpdate = useCanUpdateFromZoho();
  const [saving, setSaving] = useState<AdminCatalogueCopy | null>(null);
  const [errors, setErrors] = useState<Partial<Record<AdminCatalogueCopy, string>>>({});

  if (changes.length === 0) return null;

  async function update(copy: AdminCatalogueCopy) {
    setSaving(copy);
    setErrors((current) => ({ ...current, [copy]: undefined }));
    const result = await updateCatalogueFromZoho({ registerId, copy });
    setSaving(null);
    if (!result.ok) {
      setErrors((current) => ({ ...current, [copy]: adminMutationErrorMessage(result) }));
      return;
    }
    toast.success(
      result.data.updated.length > 0
        ? `${COPY_WORDS[copy].name} updated from Zoho`
        : `${COPY_WORDS[copy].name} already matches Zoho`,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {changes.map((change) => (
        <CatalogueChangeView
          key={change.copy}
          change={change}
          canUpdate={canUpdate}
          saving={saving === change.copy}
          formError={errors[change.copy] ?? null}
          onUpdate={() => void update(change.copy)}
        />
      ))}
    </div>
  );
}
