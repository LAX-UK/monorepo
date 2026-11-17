"use client";

import { AdminRetryButton } from "@/components/admin-retry-button.client";
import { MoveArtworksDialog } from "@/components/stock-location/move-artworks-dialog.client";
import { locationHistory, moreMovesNote, moverName } from "@/server/domain/stock-location.vm";
import type { AdminArtworkLocation, AdminStockLocation } from "@auction/shop-contracts";
import {
  ErrorState,
  KeyValueList,
  Section,
  StaffButton,
  StaffDate,
  Timeline,
} from "@auction/staff-ui";
import { MapPin } from "@auction/staff-ui/icons";
import { useState } from "react";

/**
 * Where the artwork physically is, on its From Zoho record: the current location, who moved it
 * there and when, and every move before it, newest first (docs/design/stock-location.md). It is
 * kept apart from "Where it is", which says where the artwork is offered. People who can move
 * artworks get Move; everyone else who can open the record reads the panel.
 */
export function LocationPanel({
  registerId,
  title,
  location,
  locations,
}: {
  registerId: string;
  title: string;
  /** Null when it did not load: the panel says so and offers to try again. */
  location: AdminArtworkLocation | null;
  /** The places Move can choose from; null when the list did not load. */
  locations: readonly AdminStockLocation[] | null;
}) {
  const [moving, setMoving] = useState(false);

  if (!location) {
    return (
      <Section title="Location">
        <ErrorState
          size="compact"
          headingLevel="h3"
          title="The location did not load"
          description="Something went wrong on our side. Try again in a moment."
          action={<AdminRetryButton />}
        />
      </Section>
    );
  }

  const current = location.current;
  const history = locationHistory(location);

  return (
    <>
      <Section
        title="Location"
        description="Where the artwork physically is. Moves are kept in its history."
        action={
          <StaffButton
            variant="secondary"
            size="sm"
            requires="artwork_location.move"
            icon={<MapPin aria-hidden />}
            onClick={() => setMoving(true)}
            {...(locations ? {} : { disabledReason: "The list of locations did not load" })}
          >
            Move…
          </StaffButton>
        }
      >
        <div className="flex flex-col gap-4">
          <KeyValueList
            items={[
              {
                label: "Now at",
                value: current ? (
                  <span className="font-medium text-staff-fg">{location.label}</span>
                ) : (
                  <span className="text-staff-muted">{location.label}</span>
                ),
              },
              ...(current
                ? [
                    {
                      label: "Moved",
                      value: (
                        <span>
                          <StaffDate value={current.movedAt} withTime /> by{" "}
                          {moverName(current.movedByName)}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <div className="flex flex-col gap-2">
            <h3 className="text-staff-sm font-medium text-staff-fg">Moves</h3>
            <Timeline label="Location history" events={history} empty="No moves recorded yet." />
            {location.moreMoves ? (
              <p className="text-staff-xs text-staff-muted">{moreMovesNote(history.length)}</p>
            ) : null}
          </div>
        </div>
      </Section>
      {moving && locations ? (
        <MoveArtworksDialog
          registerIds={[registerId]}
          subject={title}
          locations={locations}
          currentLocationId={current?.location.id ?? null}
          currentLabel={location.label}
          onClose={() => setMoving(false)}
        />
      ) : null}
    </>
  );
}
