"use client";

import { Button, EmptyState, PresetCards, StatusBadge, ToggleRow } from "@auction/ui/lax";
import { useState } from "react";
import { SheetSection } from "./sheet-frame";

type AlertStyle = "everything" | "closing" | "quiet";

function AlertPresets() {
  const [value, setValue] = useState<AlertStyle>("closing");
  return (
    <PresetCards<AlertStyle>
      value={value}
      onValueChange={setValue}
      label="Alert style"
      options={[
        { value: "everything", label: "Everything", description: "Outbid, wins and payments." },
        {
          value: "closing",
          label: "Closing reminders",
          description: "Adds an alert an hour before a lot you bid on closes.",
          tag: <StatusBadge tone="info">Recommended</StatusBadge>,
        },
        { value: "quiet", label: "Quiet", disabledReason: "Available once you have bid" },
      ]}
    />
  );
}

export function SheetPresets() {
  return (
    <SheetSection
      id="presets"
      title="Selectable preset cards"
      description="A radio group shown as cards, for choose-one settings. The chosen card has a 2px ink edge and a filled radio, so the choice reads in both themes without colour; a disabled card says why."
    >
      {() => <AlertPresets />}
    </SheetSection>
  );
}

function Toggles() {
  const [closing, setClosing] = useState(true);
  const [payout, setPayout] = useState(false);
  return (
    <div className="divide-y divide-lax-line-subtle">
      <ToggleRow
        label="Lot closing soon"
        description="An hour before a lot you bid on closes."
        checked={closing}
        onCheckedChange={setClosing}
      />
      <ToggleRow
        label="Payout sent"
        description="When a payout leaves us."
        checked={payout}
        onCheckedChange={setPayout}
      />
      <ToggleRow
        label="Outbid"
        description="As soon as someone bids over you."
        checked
        onCheckedChange={() => undefined}
        lockedReason="Required while you're bidding"
      />
      <ToggleRow
        label="WhatsApp"
        description="Available when the app launches."
        checked={false}
        onCheckedChange={() => undefined}
        disabled
      />
      <ToggleRow
        label="New works by artists you follow"
        description="When one of them has a new work in a sale."
        checked
        onCheckedChange={() => undefined}
        saving
      />
      <ToggleRow
        label="Weekly summary"
        checked={false}
        onCheckedChange={() => undefined}
        error="Couldn't save. Try again."
      />
    </div>
  );
}

export function SheetToggles() {
  return (
    <SheetSection
      id="toggles"
      title="Toggle rows and the locked switch"
      description="Label and description on the left, the switch on the right, the whole row at least 64px. A locked switch keeps a lock in its thumb on an outlined track, and its reason is written out and read as its description."
    >
      {() => <Toggles />}
    </SheetSection>
  );
}

export function SheetEmptyStates() {
  return (
    <SheetSection
      id="empty"
      title="Empty state"
      description="One drawing from the existing LAX set per page, on the warm-paper plate. A sentence says what and why, and the one action follows."
    >
      {() => (
        <div className="flex flex-col gap-4">
          <div className="rounded-lax-card border border-lax-line bg-lax-surface">
            <EmptyState
              illustration="easel"
              title="No consignments yet"
              description="Send us a work to sell. You can follow it here from review to sale, and see what it made."
              actions={
                <>
                  <Button variant="primary">Sell a work</Button>
                  <Button variant="ghost">How selling works</Button>
                </>
              }
            />
          </div>
          <div className="rounded-lax-card border border-lax-line bg-lax-surface">
            <EmptyState
              illustration="search"
              headingLevel="h3"
              title="No results"
              description="Nothing matches these filters. Clear one to see more."
              actions={<Button>Clear filters</Button>}
            />
          </div>
        </div>
      )}
    </SheetSection>
  );
}
