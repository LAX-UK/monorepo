import {
  OnsiteAbsenteeBidForm,
  OnsiteTelephoneBidForm,
} from "@/components/sections/artwork/onsite/onsite-participation-forms";
import { OnsiteVenueDrawer } from "@/components/sections/artwork/onsite/onsite-venue-drawer";
import type { OnsiteParticipationContext } from "@/lib/onsite/participation-request-input";
import type { TelephoneBookingSnapshot } from "@/lib/telephone/telephone-booking-types";
import type { Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { ExternalLink, Globe, Mail, MapPin, Phone, Video } from "lucide-react";

type Props = {
  sale: Sale;
  participationCtx: OnsiteParticipationContext;
  lotId: string;
  loginNextPath: string;
  isAuthenticated: boolean;
  kycApproved: boolean;
  mobile: string | null;
  mobileDisplay?: string | null;
  buyerEntities: Array<{ id: string; displayName: string; memberRole: string }>;
  telephoneBooking?: TelephoneBookingSnapshot | null;
  orgModuleEnabled?: boolean;
};

export function OnsiteParticipationHub({
  sale,
  participationCtx,
  lotId,
  loginNextPath,
  isAuthenticated,
  kycApproved,
  mobile,
  mobileDisplay,
  buyerEntities,
  telephoneBooking = null,
  orgModuleEnabled = true,
}: Props) {
  return (
    <section
      id="bid-onsite-hub"
      aria-labelledby="bid-onsite-hub-heading"
      className="scroll-mt-28 rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm dark:bg-surface-container-low/40 sm:p-8"
    >
      <div className="mb-6 flex items-center gap-3 border-b border-outline-variant/10 pb-5">
        <div className="rounded-full bg-primary/10 p-2.5 text-primary">
          <Globe className="size-5" />
        </div>
        <div>
          <h2
            id="bid-onsite-hub-heading"
            className="font-headline text-2xl font-bold tracking-tight text-on-surface"
          >
            In-Person Event Participation Hub
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            Select your preferred physical or representative bidding channel.
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="group flex flex-col justify-between rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 transition-all hover:border-link/30 hover:shadow-md">
          <div className="space-y-3">
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">
              ROUTE 1 · SALEROOM
            </span>
            <h3 className="flex items-center gap-2 font-headline text-base font-bold text-on-surface">
              <MapPin className="size-4 text-primary" />
              Bid Live in the Room
            </h3>
            <p className="font-body text-xs leading-relaxed text-on-surface-variant">
              Visit the saleroom desk on arrival for paddle check-in. You must already have an
              account and completed identity verification — staff will assign your paddle at
              reception.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-outline-variant/10 pt-3">
            <OnsiteVenueDrawer sale={sale}>
              <Button size="sm" variant="outline" className="w-full">
                View Saleroom Address
              </Button>
            </OnsiteVenueDrawer>
          </div>
        </div>

        <div className="group flex flex-col justify-between rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 transition-all hover:border-link/30 hover:shadow-md">
          <div className="space-y-3">
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">
              ROUTE 2 · CONFIDENTIAL
            </span>
            <h3 className="flex items-center gap-2 font-headline text-base font-bold text-on-surface">
              <Mail className="size-4 text-primary" />
              Submit Absentee Bid
            </h3>
            <p className="font-body text-xs leading-relaxed text-on-surface-variant">
              Set a confidential maximum hammer price for execution on your behalf in the saleroom.
            </p>
          </div>
          <div className="mt-6 border-t border-outline-variant/10 pt-3">
            <OnsiteAbsenteeBidForm ctx={participationCtx} />
          </div>
        </div>

        <div className="group flex flex-col justify-between rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 transition-all hover:border-link/30 hover:shadow-md">
          <div className="space-y-3">
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">
              ROUTE 3 · TELEPHONE
            </span>
            <h3 className="flex items-center gap-2 font-headline text-base font-bold text-on-surface">
              <Phone className="size-4 text-primary" />
              Request Telephone Line
            </h3>
            <p className="font-body text-xs leading-relaxed text-on-surface-variant">
              Register for a live telephone line before this lot opens in the saleroom.
            </p>
          </div>
          <div className="mt-6 border-t border-outline-variant/10 pt-3">
            <OnsiteTelephoneBidForm
              ctx={participationCtx}
              saleId={sale.id}
              lotId={lotId}
              loginNextPath={loginNextPath}
              isAuthenticated={isAuthenticated}
              kycApproved={kycApproved}
              mobile={mobile}
              {...(mobileDisplay ? { mobileDisplay } : {})}
              buyerEntities={buyerEntities}
              existingBooking={telephoneBooking}
              orgModuleEnabled={orgModuleEnabled}
            />
          </div>
        </div>

        <div className="group flex flex-col justify-between rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 transition-all hover:border-link/30 hover:shadow-md">
          <div className="space-y-3">
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">
              ROUTE 4 · BROADCAST
            </span>
            <h3 className="flex items-center gap-2 font-headline text-base font-bold text-on-surface">
              <Video className="size-4 text-primary" />
              Watch Live Stream
            </h3>
            <p className="font-body text-xs leading-relaxed text-on-surface-variant">
              Follow auctioneer activity from our gallery broadcast feed.
            </p>
          </div>
          <div className="mt-6 border-t border-outline-variant/10 pt-3">
            {sale.streamUrl ? (
              <Button size="sm" variant="ghost" className="w-full gap-1.5" asChild>
                <a href="#live-stream">
                  <ExternalLink className="size-3.5" />
                  Go to live stream
                </a>
              </Button>
            ) : (
              <span className="block w-full text-center font-body text-xs italic text-on-surface-variant/60">
                Live stream unavailable
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
