import { contactLinkLines } from "@/components/exhibition/art-exhibition-contact-links";
import type { ExhibitionFactsVm } from "@/lib/editorial/exhibition-page.vm";
import { Avatar, AvatarFallback, AvatarImage } from "@auction/ui";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * Mobile "Exhibition specialist" card (Figma `599:7263`). From the tablet width the same person
 * sits in the facts row's contact column instead, so this card is mobile-only. Venue-only
 * contact details have no person to introduce and render nothing here.
 */
export function ArtExhibitionSpecialist({ contact }: { contact: ExhibitionFactsVm["contact"] }) {
  if (!contact?.name) return null;
  const { name, role, avatarUrl } = contact;
  return (
    <section
      aria-label="Exhibition specialist"
      className="flex items-center gap-4 rounded-lg bg-surface-container-low p-4 sm:hidden"
      data-testid="art-exhibition-specialist"
    >
      <Avatar size="lg" className="size-16">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback aria-hidden="true">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="font-label text-xs text-on-surface-variant">Exhibition specialist</p>
        <p className="text-base font-medium text-on-surface">{name}</p>
        {role ? <p className="text-on-surface-variant">{role}</p> : null}
        {contactLinkLines(contact)}
      </div>
    </section>
  );
}
