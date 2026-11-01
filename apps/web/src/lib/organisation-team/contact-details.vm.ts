import type { ContactDetailsView } from "@/lib/data/http/organisation-profile.types";
import { updateContactDetailsSchema } from "@auction/validators";
import type { ContactDetailsInput } from "./organisation-team.actions";

/** The organisation's contact details as the Profile shows them, and the form they are edited in. */

export type ContactField = "email" | "phone" | "website";

export type ContactDetailsForm = Record<ContactField, string>;

export const CONTACT_FIELDS: readonly {
  field: ContactField;
  label: string;
  empty: string;
  description: string;
}[] = [
  {
    field: "email",
    label: "Email",
    empty: "None. Add the address buyers and our team can write to.",
    description: "Where buyers and our team can write to you. Leave empty for none.",
  },
  {
    field: "website",
    label: "Website",
    empty: "None",
    description: "Your website's address. Leave empty for none.",
  },
  {
    field: "phone",
    label: "Phone",
    empty: "None",
    description: "Include the country code if you're outside the UK. Leave empty for none.",
  },
];

export function contactDetailsForm(view: ContactDetailsView): ContactDetailsForm {
  return { email: view.email ?? "", phone: view.phone ?? "", website: view.website ?? "" };
}

/** Field errors in words, from the same rules the API applies; empty when the form can be saved. */
export function validateContactDetails(
  form: ContactDetailsForm,
): Partial<Record<ContactField, string>> {
  const parsed = updateContactDetailsSchema.safeParse(form);
  if (parsed.success) return {};
  const errors: Partial<Record<ContactField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ContactField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

export function contactDetailsInput(form: ContactDetailsForm): ContactDetailsInput {
  return { email: form.email.trim(), phone: form.phone.trim(), website: form.website.trim() };
}

/** A web address as people say it: without `https://` and without a trailing slash. */
export function websiteLabel(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
