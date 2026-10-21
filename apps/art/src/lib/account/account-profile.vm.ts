/** Monogram initials: first and last word of the name, else the email's first letter. */
export function accountInitials(name: string | null, email: string | null): string | null {
  const words = name?.split(/\s+/).filter(Boolean) ?? [];
  const first = words[0]?.[0];
  if (first) {
    const last = words.length > 1 ? words[words.length - 1]?.[0] : "";
    return `${first}${last ?? ""}`.toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? null;
}

export type ArtProfileBannerVm = {
  title: string;
  description: string;
  /** Omitted when neither deep link is configured. */
  action: { label: string; href: string } | null;
};

/**
 * "You're almost ready" prompt (Figma 930:14088). Shown while the email is unverified or no
 * verified phone is on file; email comes first because it blocks sign-in recovery.
 */
export function buildProfileIncompleteBanner(input: {
  emailVerified: boolean | null;
  phone: string | null;
  verifyEmailHref: string | null;
  laxAccountHref: string | null;
}): ArtProfileBannerVm | null {
  const emailUnverified = input.emailVerified === false;
  const phoneMissing = !input.phone?.trim();
  if (!emailUnverified && !phoneMissing) return null;

  const title = "You're almost ready";
  if (emailUnverified) {
    return {
      title,
      description: "Verify your email address so we can reach you about your enquiries.",
      action: input.verifyEmailHref ? { label: "Verify email", href: input.verifyEmailHref } : null,
    };
  }
  return {
    title,
    description: "Add a phone number so the gallery can reach you about your enquiries.",
    action: input.laxAccountHref ? { label: "Add phone number", href: input.laxAccountHref } : null,
  };
}

export type ArtAccountPromoVm = { title: string; description: string; href: string; label: string };

/** Figma promo cards (867:16367); destinations are existing lax.art pages. */
export const ART_ACCOUNT_PROMOS: readonly ArtAccountPromoVm[] = [
  {
    title: "How to buy",
    description: "From enquiry to delivery, see how collecting with LAX works.",
    href: "/how-to-buy",
    label: "Learn more",
  },
  {
    title: "How to sell",
    description: "Thinking of selling a work? Talk to our specialists.",
    href: "/how-to-sell",
    label: "Learn more",
  },
  {
    title: "FAQs",
    description: "Answers to the questions collectors ask most.",
    href: "/contact",
    label: "Get in touch",
  },
];
