import { maskAccountEmail } from "@auction/lax-ecosystem";
import type { AccountLinksVm } from "./account-links";
import type { AccountOverviewVm } from "./account-overview.vm";

export type ProfileStatusVm = { label: string; tone: "success" | "neutral" };

export type ProfileFieldVm = { label: string; value: string | null; status?: ProfileStatusVm };

export type ProfileActionVm = { label: string; href: string };

export type ProfileSectionVm = {
  id: "about" | "email" | "phone" | "addresses";
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
 * Edit account (Figma 950:13732). Values come from the ID token; every "Update"
 * opens the LAX Bid screen that owns the write (see BidSettingsLinksVm). Without
 * Bid configured the read-only values stay and the address book, which Account
 * cannot read, is hidden.
 */
export function buildProfileSections(
  overview: Pick<AccountOverviewVm, "name" | "email" | "emailVerified" | "phone" | "phoneVerified">,
  links: Pick<AccountLinksVm, "bidSettings" | "verifyEmail">,
): ProfileSectionVm[] {
  const bid = links.bidSettings;
  const update = (href: string | undefined): ProfileActionVm[] =>
    href ? [{ label: "Update", href }] : [];
  const sections: ProfileSectionVm[] = [
    {
      id: "about",
      title: "About me",
      fields: [{ label: "Name", value: overview.name }],
      actions: update(bid?.profile),
    },
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
        ...update(bid?.email),
      ],
      ...(bid ? { note: "We'll send a confirmation link to your current and new address." } : {}),
    },
    {
      id: "phone",
      title: "Phone book",
      fields: [
        {
          label: "Phone number",
          value: overview.phone,
          ...(overview.phone ? { status: verified(overview.phoneVerified) } : {}),
        },
      ],
      actions: update(bid?.profile),
    },
  ];
  if (bid) {
    sections.push({
      id: "addresses",
      title: "Address book",
      fields: [],
      actions: update(bid.addresses),
      note: "Your delivery and billing addresses are kept in LAX Bid.",
    });
  }
  return sections;
}
