"use client";

import { setBlockUnlinkedPublishingAction } from "@/lib/admin/unlinked-originals/unlinked-originals.actions";
import { notify } from "@/lib/ui/notify";
import { ChoiceRow, Notice, Section, StaffSwitch } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Whether LAX Bid refuses to publish a lot that is not linked to its Zoho record. It starts off,
 * so nothing changes until staff turn it on; the matching switch for lax.art is in LAX Admin.
 * A failure stays in the section.
 */
export function BlockUnlinkedPublishing({
  enabled,
  canEdit,
  unlinked,
}: {
  enabled: boolean;
  canEdit: boolean;
  /** Live originals still without a record, on both products. */
  unlinked: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  const save = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setBlockUnlinkedPublishingAction(next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify.success(
        next
          ? "Unlinked originals can no longer be published in LAX Bid"
          : "Unlinked originals can be published in LAX Bid again",
      );
      router.refresh();
    });
  };

  const state = enabled
    ? "On. A lot that is not linked to a Zoho record cannot be published."
    : unlinked > 0
      ? "Off. Turn it on once every live original below is linked."
      : "Off. Every live original is linked, so it is safe to turn on.";

  return (
    <Section
      title="Publishing in LAX Bid"
      description="Originals come from Zoho. With the switch on, a lot made without its Zoho record is refused when staff publish it."
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <Notice tone="danger" alert title="The setting did not change">
            {error}
          </Notice>
        ) : null}
        <ChoiceRow
          htmlFor="block-unlinked-publishing"
          label="Block publishing unlinked originals"
          description={`${state}${canEdit ? "" : " Only an administrator can change it."}`}
          control={
            <StaffSwitch
              id="block-unlinked-publishing"
              checked={enabled}
              disabled={!canEdit || saving}
              onCheckedChange={save}
            />
          }
        />
      </div>
    </Section>
  );
}
