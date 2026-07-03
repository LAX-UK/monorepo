import { formatDateTime } from "@/lib/ui/format";
import type { OnsiteEventCheckInResult } from "@auction/types";

export function resultTone(status: OnsiteEventCheckInResult["status"]): string {
  switch (status) {
    case "VALID":
    case "DRY_RUN_VALID":
      return "border-emerald-500 bg-emerald-50 text-emerald-950";
    case "ALREADY_CHECKED_IN":
      return "border-amber-500 bg-amber-50 text-amber-950";
    default:
      return "border-red-500 bg-red-50 text-red-950";
  }
}

export function resultTitle(result: OnsiteEventCheckInResult): string {
  switch (result.status) {
    case "VALID":
      return "Admit — checked in";
    case "DRY_RUN_VALID":
      return "Admit — dry run (not recorded)";
    case "ALREADY_CHECKED_IN":
      return "Already checked in";
    case "INVALID":
      return "Pass not recognised";
    case "WRONG_EVENT":
      return "Wrong event";
    case "EVENT_CLOSED":
      return "Check-in closed";
  }
}

type Props = {
  result: OnsiteEventCheckInResult;
};

export function CheckInResultBanner({ result }: Props) {
  return (
    <output
      aria-live="assertive"
      className={`block rounded-xl border-2 p-5 ${resultTone(result.status)}`}
    >
      <p className="font-display text-xl">{resultTitle(result)}</p>
      {"guest" in result ? (
        <div className="mt-3 space-y-1 font-body text-sm">
          <p className="text-lg font-medium">{result.guest.name}</p>
          <p>{result.guest.attendanceSegmentLabel}</p>
          <p>
            Party of {result.guest.partySize}
            {result.guest.plusOneGuestName ? ` — ${result.guest.plusOneGuestName}` : ""}
          </p>
          {result.guest.checkedInAt ? (
            <p>
              Checked in {formatDateTime(result.guest.checkedInAt)}
              {result.guest.checkedInByName ? ` by ${result.guest.checkedInByName}` : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 font-body text-sm">
          Try manual search or ask the guest to open their pass link.
        </p>
      )}
    </output>
  );
}
