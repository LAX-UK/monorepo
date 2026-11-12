"use client";

import { AccountTile } from "@/components/layout/account-switcher/account-tile";
import { initials } from "@/components/organisations/initials";
import type { EnquiringAsChoice } from "@/lib/private-sales/enquiring-as";
import { Button } from "@auction/ui/lax/button";
import { Field } from "@auction/ui/lax/field";
import { NativeSelect } from "@auction/ui/lax/native-select";
import { useState } from "react";

/**
 * Who the enquiry is from, for a signed-in sender: their name and address from LAX Account, shown
 * once and not as fields to retype. Members of an organisation choose to enquire as themselves or
 * as the organisation, so a later deal starts with the right party.
 */
export function EnquiringAsCard({
  name,
  email,
  choices,
  choiceId,
  onChoose,
}: {
  name: string;
  email: string;
  choices: readonly EnquiringAsChoice[];
  choiceId: string;
  onChoose: (id: string) => void;
}) {
  const [changing, setChanging] = useState(false);
  const chosen = choices.find((c) => c.id === choiceId) ?? choices[0];
  const label = chosen?.label ?? "Myself";
  const organisation = chosen?.legalEntityId !== undefined;
  return (
    <div className="flex flex-col gap-3 rounded-lax-card border border-lax-line p-3">
      <div className="flex items-center gap-3">
        <AccountTile
          account={{
            kind: organisation ? "organisation" : "personal",
            initials: initials(organisation ? label : name),
          }}
          size="md"
        />
        <p className="m-0 min-w-0 flex-1 text-lax-13 leading-5 text-lax-fg">
          <span className="block truncate font-medium">
            Enquiring as {organisation ? label : name}
          </span>
          <span className="block truncate text-lax-12 text-lax-muted">
            {organisation ? `${name} · ` : ""}
            {email} · from your LAX Account
          </span>
        </p>
        {choices.length > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={changing}
            onClick={() => setChanging((open) => !open)}
          >
            {changing ? "Done" : "Change"}
          </Button>
        ) : null}
      </div>
      {changing ? (
        <Field label="Send this enquiry as" id="enquiring-as">
          <NativeSelect
            value={choiceId}
            onValueChange={onChoose}
            options={choices.map((c) => ({ value: c.id, label: c.label }))}
          />
        </Field>
      ) : null}
    </div>
  );
}
