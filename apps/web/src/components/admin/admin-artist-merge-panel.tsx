"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminMergeArtistResultAction } from "@/lib/actions/admin";
import { searchArtistOptions } from "@/lib/admin/pickers/staff-entity-search";
import { type EntityOption, EntityPicker, Field, Section, StaffButton } from "@auction/staff-ui";
import { GitMerge } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useId, useState } from "react";

type Props = {
  fromArtistId: string;
  fromDisplayName: string;
  /** Renders inside another card (a duplicate cluster) instead of as its own section. */
  bare?: boolean;
};

/**
 * Merges this profile into the one to keep: moves its aliases and lots across and removes it
 * from the registry. The surviving profile is chosen by name; the merge itself is confirmed with
 * a reason for the audit log.
 */
export function AdminArtistMergePanel({ fromArtistId, fromDisplayName, bare = false }: Props) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const [target, setTarget] = useState<EntityOption | null>(null);
  const pickerId = useId();

  const search = useCallback(
    async (query: string) =>
      (await searchArtistOptions(query)).filter((option) => option.id !== fromArtistId),
    [fromArtistId],
  );

  const merge = () => {
    if (!target) return;
    const keep = target;
    confirm.ask({
      title: `Merge ${fromDisplayName} into ${keep.label}?`,
      description: `Every alias and lot of ${fromDisplayName} moves to ${keep.label}, and ${fromDisplayName} is removed from the registry. This cannot be undone.`,
      confirmLabel: "Merge artists",
      cancelLabel: "Keep both",
      tone: "danger",
      reason: {
        label: "Reason for merging",
        description: "At least 10 characters. Kept in the audit log.",
        minLength: 10,
        maxLength: 1000,
      },
      run: ({ reason }) =>
        adminMergeArtistResultAction(fromArtistId, {
          intoArtistId: keep.id,
          reason,
          confirmationPhrase: `MERGE INTO ${keep.label}`,
        }),
      success: "Artists merged",
      onSuccess: () => {
        router.push(`/admin/artists/${keep.id}/edit`);
        router.refresh();
      },
    });
  };

  const body = (
    <div className="flex flex-col gap-4">
      <Field
        id={pickerId}
        label="Profile to keep"
        description="Search by name. The profile you choose keeps its details; this one's aliases and lots move to it."
      >
        <EntityPicker
          id={pickerId}
          value={target?.id ?? null}
          selected={target}
          search={search}
          placeholder="Choose the profile to keep"
          searchPlaceholder="Type at least two letters"
          emptyText="No other artists match."
          onValueChange={(option) => setTarget(option)}
        />
      </Field>
      <div>
        <StaffButton
          variant="danger-secondary"
          icon={<GitMerge aria-hidden />}
          {...(target ? {} : { disabledReason: "Choose the profile to keep first" })}
          onClick={merge}
        >
          {target ? `Merge into ${target.label}` : "Merge into another profile"}
        </StaffButton>
      </div>
      {confirm.dialog}
    </div>
  );

  if (bare) {
    return (
      <div className="flex flex-col gap-3 border-t border-staff-line-subtle p-4">
        <h3 className="font-staff text-staff-md font-semibold text-staff-fg">
          Merge {fromDisplayName}
        </h3>
        {body}
      </div>
    );
  }
  return (
    <Section
      title="Merge into another profile"
      description={`Use when ${fromDisplayName} is a duplicate of a profile that should stay.`}
    >
      {body}
    </Section>
  );
}
