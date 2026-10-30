"use client";

import { ArtEnquiryPanel } from "@/components/enquiry/art-enquiry-panel";
import { ArtGeneralEnquirySheet } from "@/components/enquiry/art-general-enquiry-sheet.client";
import { ArtArtworkFavoriteToggle } from "@/components/favorites/art-artwork-favorite-toggle.client";
import type { ArtworkDetailVm } from "@/lib/artwork/artwork-detail-page.composer";
import { MarketingStickyActionBar } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";

type ConversationsVm = Pick<
  ArtworkDetailVm,
  "slug" | "title" | "enquiry" | "specialistContact" | "saved" | "favoriteAuth"
>;

/**
 * The three conversations a gallery offers about a work: "Enquire about this work" (primary),
 * "Book a private viewing" (secondary, the same width beside it) and "Ask an advisor" (a quiet
 * link). On phones the primary sits in a bar fixed to the bottom with save; the bottom tab bar
 * gives way to it while it is shown.
 */
export function ArtArtworkConversations({ vm }: { vm: ConversationsVm }) {
  const specialist = vm.specialistContact.kind === "ready" ? vm.specialistContact : null;
  const available = vm.enquiry.kind === "ready";
  const subject = { contextSlug: vm.slug, contextLabel: vm.title };

  return (
    <div className="flex flex-col gap-4" data-testid="art-artwork-conversations">
      {available ? (
        <div className="grid gap-3 md:grid-cols-2">
          {/* One enquiry control for both layouts: fixed on phones, in flow from `md`, so a single
            sheet answers `?enquire=1`. */}
          <MarketingStickyActionBar
            ariaLabel="Artwork actions"
            inlineFromMd
            className="art-action-bar"
          >
            <div className="shrink-0 md:hidden">
              <ArtArtworkFavoriteToggle
                slug={vm.slug}
                title={vm.title}
                initialSaved={vm.saved}
                auth={vm.favoriteAuth}
              />
            </div>
            <div className="min-w-0 flex-1 *:w-full">
              <ArtEnquiryPanel
                slug={vm.slug}
                title={vm.title}
                enquiry={vm.enquiry}
                triggerLabel="Enquire about this work"
              />
            </div>
          </MarketingStickyActionBar>
          {specialist ? (
            <ArtGeneralEnquirySheet
              {...subject}
              contact={specialist.contact}
              viewerKind={specialist.viewerKind}
              defaultTopic="private_viewing"
              triggerLabel="Book a private viewing"
              triggerVariant="secondaryOutline"
              triggerClassName="w-full"
            />
          ) : null}
        </div>
      ) : (
        // A sold work: the panel says so, and the advisor link below offers similar works.
        <ArtEnquiryPanel slug={vm.slug} title={vm.title} enquiry={vm.enquiry} />
      )}
      {specialist ? (
        <ArtGeneralEnquirySheet
          {...subject}
          contact={specialist.contact}
          viewerKind={specialist.viewerKind}
          defaultTopic="art_advisory"
          renderTrigger={(open) => (
            <Button
              type="button"
              variant="link"
              onClick={open}
              className="min-h-11 w-fit px-0 text-sm font-medium text-on-surface underline underline-offset-4 hover:decoration-2"
            >
              {available ? "Ask an advisor" : "Ask about similar works"}
            </Button>
          )}
        />
      ) : null}
    </div>
  );
}
