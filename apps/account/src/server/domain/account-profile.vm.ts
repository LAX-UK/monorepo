import { maskAccountEmail } from "@auction/lax-ecosystem";
import type { ProfileContactVm } from "./account-contact.vm";
import type { AccountLinksVm } from "./account-links";

export type ProfileStatusVm = { label: string; tone: "success" | "neutral" };

export type ProfileFieldVm = { label: string; value: string | null; status?: ProfileStatusVm };

export type ProfileActionVm = { label: string; href: string };

export type ProfileSectionVm = {
  id: "email" | "phone";
  title: string;
  fields: ProfileFieldVm[];
  actions: ProfileActionVm[];
  note?: string;
};

function verified(isVerified: boolean): ProfileStatusVm {
  return isVerified
    ? { label: "Verified", tone: "success" }
    : { label: "Not verified", tone: "neutral" };
}

/**
 * The contact part of Personal details (Figma 950:13732); the name above it is edited in
 * Account. Email and phone are changed in place by the editors the page renders under each
 * section. The email is masked because the page can be shown on a shared screen; the phone is
 * the person's own contact number and is shown in full. Without Bid configured the address
 * book, which Account cannot read, is hidden.
 */
export function buildProfileSections(
  contact: ProfileContactVm,
  links: Pick<AccountLinksVm, "bidSettings" | "verifyEmail">,
): ProfileSectionVm[] {
  const sections: ProfileSectionVm[] = [
    {
      id: "email",
      title: "Email",
      fields: [
        {
          label: "Email address",
          value: contact.email ? maskAccountEmail(contact.email) : null,
          ...(contact.email ? { status: verified(contact.emailVerified) } : {}),
        },
      ],
      actions:
        contact.email && !contact.emailVerified
          ? [{ label: "Verify email", href: links.verifyEmail }]
          : [],
      note: "To change it, we email a link to your current and your new address. It changes once you confirm both.",
    },
    {
      id: "phone",
      title: "Phone",
      fields: [
        {
          label: "Phone number",
          value: contact.phone,
          ...(contact.phone ? { status: verified(contact.phoneVerified) } : {}),
        },
      ],
      actions: [],
      note: "We use it to contact you about your activity. You can't sign in with it.",
    },
  ];
  return sections;
}

/** The address a pending change is waiting on, masked like the current one. */
export function maskPendingEmail(contact: ProfileContactVm): string | null {
  return contact.pendingEmail ? maskAccountEmail(contact.pendingEmail) : null;
}
