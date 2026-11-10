import { type MomentDescription, type ViewerZoneSource, cityName } from "@auction/datetime";
import { cn } from "../lib/utils.js";

const SOURCE_NOTE: Readonly<Record<ViewerZoneSource, string>> = {
  device: "from this device",
  chosen: "chosen on this device",
  account: "your choice in LAX Account",
};

const DAY_TAG = { next: "Next day", previous: "Previous day" } as const;

export type TimeChipPanelProps = {
  id: string;
  moment: MomentDescription;
  officialZone: string;
  source: ViewerZoneSource;
  /** Open towards the left when the chip sits too near the right edge for a 300px panel. */
  alignEnd?: boolean;
  /** The device's own zone when it is not the one in use (a chosen city while travelling). */
  deviceZone?: string | null;
  onChangeZone: () => void;
};

/**
 * Both clocks in full, so nothing is left to work out: the visitor's own time with the day said
 * in words, the sale's official time, and the way to change the zone.
 */
export function TimeChipPanel({
  id,
  moment,
  officialZone,
  source,
  alignEnd = false,
  deviceZone = null,
  onChangeZone,
}: TimeChipPanelProps) {
  const local = moment.local;
  if (!local) return null;
  const tag = moment.dayRelation === "same" ? null : DAY_TAG[moment.dayRelation];
  return (
    <dialog
      open
      id={id}
      aria-label="Your time"
      className={cn(
        "m-0 p-0 absolute top-[calc(100%+8px)] z-[var(--z-floating,70)] grid w-[300px] max-w-[calc(100vw-32px)] gap-2.5 rounded-lax-card border border-lax-line bg-lax-raised pt-3.5 text-left font-lax text-lax-13 leading-5 font-normal text-lax-fg shadow-lax-md",
        alignEnd ? "right-0 left-auto" : "left-0",
      )}
    >
      <p className="m-0 px-4 font-lax-display text-lax-14 leading-5 font-semibold">Your time</p>
      <div className="px-4">
        <p className="m-0 text-lax-12 leading-4 text-lax-muted">
          {local.city} · {SOURCE_NOTE[source]}
        </p>
        <p className="m-0 flex flex-wrap items-center gap-2 text-lax-14 leading-5 font-medium tabular-nums">
          <time dateTime={moment.iso}>
            {local.day}, {local.time}
          </time>
          {tag ? (
            <span className="rounded-lax-badge bg-lax-info-bg px-2 text-lax-12 leading-5 font-medium text-lax-info-fg">
              {tag}
            </span>
          ) : null}
        </p>
      </div>
      {deviceZone ? (
        <p className="m-0 px-4 text-lax-12 leading-4 text-lax-muted">
          This device is on {cityName(deviceZone)} time.
        </p>
      ) : null}
      <div className="px-4">
        <p className="m-0 text-lax-12 leading-4 text-lax-muted">
          Official sale time · {cityName(officialZone)}
        </p>
        <p className="m-0 text-lax-14 leading-5 font-medium tabular-nums">
          <time dateTime={moment.iso}>{moment.official}</time>
        </p>
      </div>
      <div className="border-t border-lax-line-subtle px-4">
        <button
          type="button"
          onClick={onChangeZone}
          className="lax-focus inline-flex min-h-11 items-center rounded-lax-badge text-lax-13 font-medium text-lax-fg underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          Change time zone
        </button>
      </div>
    </dialog>
  );
}
