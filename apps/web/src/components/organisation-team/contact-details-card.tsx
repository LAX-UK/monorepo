"use client";

import type { ContactDetailsView } from "@/lib/data/http/organisation-profile.types";
import {
  CONTACT_FIELDS,
  type ContactDetailsForm,
  type ContactField,
  contactDetailsForm,
  contactDetailsInput,
  validateContactDetails,
  websiteLabel,
} from "@/lib/organisation-team/contact-details.vm";
import { saveContactDetailsAction } from "@/lib/organisation-team/organisation-team.actions";
import { notify } from "@/lib/ui/notify";
import { Button, Field, Notice, TextInput } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { SettingsCard, SettingsRow } from "./settings-section";

type Props = { legalEntityId: string; details: ContactDetailsView };

const INPUT: Record<ContactField, { type: string; autoComplete: string; inputMode?: "tel" }> = {
  email: { type: "email", autoComplete: "email" },
  website: { type: "text", autoComplete: "url" },
  phone: { type: "tel", autoComplete: "tel", inputMode: "tel" },
};

/**
 * How buyers and LAX reach the organisation, each detail edited in place. They are not checked,
 * so a change is saved straight away. One row opens at a time; Save sends the whole set.
 */
export function ContactDetailsCard({ legalEntityId, details }: Props) {
  const router = useRouter();
  const saved = useMemo(() => contactDetailsForm(details), [details]);
  const [form, setForm] = useState<ContactDetailsForm>(saved);
  const [editing, setEditing] = useState<ContactField | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = tried ? validateContactDetails(form) : {};

  const open = (field: ContactField | null) => {
    setForm(saved);
    setTried(false);
    setError(null);
    setEditing(field);
  };
  const save = () => {
    setTried(true);
    if (Object.keys(validateContactDetails(form)).length > 0) return;
    startTransition(async () => {
      const result = await saveContactDetailsAction(legalEntityId, contactDetailsInput(form));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify.success("Contact details saved");
      setEditing(null);
      router.refresh();
    });
  };

  return (
    <SettingsCard>
      {CONTACT_FIELDS.map(({ field, label, empty, description }) => {
        const value = details[field];
        if (editing === field) {
          return (
            <div key={field} className="flex flex-col gap-3 bg-lax-sunken px-4 py-4 md:px-5">
              <Field label={label} description={description} error={errors[field] ?? null} optional>
                <TextInput
                  {...INPUT[field]}
                  autoFocus
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  disabled={pending}
                />
              </Field>
              {error ? <Notice tone="danger" alert title={error} /> : null}
              <div className="flex gap-2 max-md:[&>*]:flex-1 md:justify-end">
                <Button disabled={pending} onClick={() => open(null)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={pending} onClick={save}>
                  Save
                </Button>
              </div>
            </div>
          );
        }
        return (
          <SettingsRow
            key={field}
            label={label}
            value={value ? (field === "website" ? websiteLabel(value) : value) : empty}
            muted={!value}
            action={
              details.canEdit && editing === null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => open(field)}
                  aria-label={`${value ? "Edit" : "Add"} ${label.toLowerCase()}`}
                >
                  {value ? "Edit" : "Add"}
                </Button>
              ) : null
            }
          />
        );
      })}
    </SettingsCard>
  );
}
