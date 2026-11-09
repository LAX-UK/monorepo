"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { addPrintParty, removePrintParty } from "@/server/application/print-party-actions.server";
import { PRINT_PARTY_NAME_MAX_LENGTH } from "@auction/shop-contracts";
import type { AdminPrintParty } from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  EmptyState,
  Field,
  Section,
  StaffButton,
  TextInput,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

/**
 * The studios and publishers staff pick "Printed by" and "Published by" from in the Edition
 * facts card. Names are spelled one way here; facts already saved keep the name they hold, so
 * removing a name never changes what shoppers read. Anyone can see the list; adding and removing
 * needs `settings.write`.
 */
export function PrintPartiesPanel({
  parties,
  canEdit,
}: {
  parties: readonly AdminPrintParty[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const action = useAdminAction();
  const fieldId = useId();
  const [name, setName] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [removing, setRemoving] = useState<AdminPrintParty | null>(null);

  const trimmed = name.trim();
  const duplicate = parties.some((party) => party.name.toLowerCase() === trimmed.toLowerCase());
  const error = !attempted
    ? undefined
    : !trimmed
      ? "Enter a name"
      : duplicate
        ? "That name is already in the list"
        : undefined;

  const add = async () => {
    setAttempted(true);
    if (!trimmed || duplicate) return;
    const ok = await action.run(
      () => addPrintParty({ name: trimmed, idempotencyKey: crypto.randomUUID() }),
      `${trimmed} added`,
    );
    if (ok) {
      setName("");
      setAttempted(false);
      router.refresh();
    }
  };

  const remove = async (party: AdminPrintParty) => {
    const ok = await action.run(
      () => removePrintParty({ id: party.id, idempotencyKey: crypto.randomUUID() }),
      `${party.name} removed`,
    );
    setRemoving(null);
    if (ok) router.refresh();
  };

  return (
    <Section
      title="Printers and publishers"
      description="The names the Edition facts card offers under Printed by and Published by. Leave a fact empty to say nothing."
    >
      <div className="flex flex-col gap-4">
        {action.error}
        {canEdit ? (
          <form
            noValidate
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <div className="min-w-0 flex-1">
              <Field
                id={fieldId}
                label="Name"
                description="As it should be printed, for example Coriander Studio, London."
                error={error}
              >
                <TextInput
                  value={name}
                  autoComplete="off"
                  maxLength={PRINT_PARTY_NAME_MAX_LENGTH}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
            </div>
            <StaffButton
              type="submit"
              variant="primary"
              loading={action.pending}
              className="sm:mt-6"
            >
              Add name
            </StaffButton>
          </form>
        ) : null}
        {parties.length === 0 ? (
          <EmptyState
            size="compact"
            title="No names yet"
            description={
              canEdit
                ? "Add the studios and publishers your editions are made and published by."
                : "A shop admin adds the studios and publishers here."
            }
          />
        ) : (
          <ul className="divide-y divide-staff-line-subtle rounded-staff-md border border-staff-line">
            {parties.map((party) => (
              <li
                key={party.id}
                className="flex min-h-12 items-center justify-between gap-3 px-4 py-2"
              >
                <span className="min-w-0 truncate text-staff-md text-staff-fg">{party.name}</span>
                {canEdit ? (
                  <StaffButton
                    size="sm"
                    variant="secondary"
                    aria-label={`Remove ${party.name}`}
                    onClick={() => setRemoving(party)}
                  >
                    Remove
                  </StaffButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmActionDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={removing ? `Remove ${removing.name}?` : "Remove this name?"}
        description="It leaves the list. Edition facts that already use it keep the name, and shoppers still read it."
        confirmLabel="Remove name"
        tone="danger"
        loading={action.pending}
        onConfirm={() => {
          if (removing) void remove(removing);
        }}
      />
    </Section>
  );
}
