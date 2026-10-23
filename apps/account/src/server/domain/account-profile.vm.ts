import { maskAccountEmail } from "@auction/lax-ecosystem";
import type { AccountLinksVm } from "./account-links";
import type { AccountOverviewVm } from "./account-overview.vm";

export type ProfileStatusVm = { label: string; tone: "success" | "neutral" };

export type ProfileFieldVm = { label: string; value: string | null; status?: ProfileStatusVm };

export type ProfileActionVm = { label: string; href: string };

export type ProfileSectionVm = {
  id: "email" | "phone" | "addresses";
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
 * The read-only part of Personal details (Figma 950:13732); the name above it is edited in
 * Account. Values come from the ID token. Email and phone cannot be changed from Account yet,
 * so they say so and point to support rather than to a screen in another product. Without Bid
 * configured there is no support page and the address book, which Account cannot read, is hidden.
 */
export function buildProfileSections(
  overview: Pick<AccountOverviewVm, "email" | "emailVerified" | "phone" | "phoneVerified">,
  links: Pick<AccountLinksVm, "bidSettings" | "verifyEmail" | "support">,
): ProfileSectionVm[] {
  const contact: ProfileActionVm[] = links.support
    ? [{ label: "Contact us", href: links.support.contact }]
    : [];
  const sections: ProfileSectionVm[] = [
    {
      id: "email",
      title: "Email",
      fields: [
        {
          label: "Email address",
          value: overview.email ? maskAccountEmail(overview.email) : null,
          ...(overview.email ? { status: verified(overview.emailVerified) } : {}),
        },
      ],
      actions: [
        ...(overview.email && !overview.emailVerified
          ? [{ label: "Verify email", href: links.verifyEmail }]
          : []),
        ...contact,
      ],
      note: "You can't change your email address here yet. Contact us and we'll update it for you.",
    },
    {
      id: "phone",
      title: "Phone",
      fields: [
        {
          label: "Phone number",
          value: overview.phone,
          ...(overview.phone ? { status: verified(overview.phoneVerified) } : {}),
        },
      ],
      actions: contact,
      note: "You can't add or change your phone number here yet. Contact us and we'll help.",
    },
  ];
  if (links.bidSettings) {
    sections.push({
      id: "addresses",
      title: "Address book",
      fields: [],
      actions: [{ label: "Update", href: links.bidSettings.addresses }],
      note: "Your delivery and billing addresses are kept in LAX Bid.",
    });
  }
  return sections;
}
