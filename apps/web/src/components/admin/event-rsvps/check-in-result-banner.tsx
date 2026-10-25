import { Notice, formatStaffDateTime } from "@auction/staff-ui";
import type { OnsiteEventCheckInResult } from "@auction/types";

type NoticeTone = "success" | "warning" | "danger";

/** Admitted guests read as success, a repeat as a warning, anything else as a refusal. */
export function resultTone(status: OnsiteEventCheckInResult["status"]): NoticeTone {
  switch (status) {
    case "VALID":
    case "DRY_RUN_VALID":
      return "success";
    case "ALREADY_CHECKED_IN":
      return "warning";
    default:
      return "danger";
  }
}

export function resultTitle(result: OnsiteEventCheckInResult): string {
  switch (result.status) {
    case "VALID":
      return "Admit: checked in";
    case "DRY_RUN_VALID":
      return "Admit: dry run, not recorded";
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

/** The outcome of the last scan or search check-in, announced at once. */
export function CheckInResultBanner({ result }: Props) {
  const tone = resultTone(result.status);
  return (
    <Notice tone={tone} alert={tone !== "success"} title={resultTitle(result)}>
      {"guest" in result ? (
        <ul className="flex flex-col gap-0.5">
          <li className="font-semibold">{result.guest.name}</li>
          <li>{result.guest.attendanceSegmentLabel}</li>
          <li>
            Party of {result.guest.partySize}
            {result.guest.plusOneGuestName ? `, with ${result.guest.plusOneGuestName}` : ""}
          </li>
          {result.guest.checkedInAt ? (
            <li>
              Checked in {formatStaffDateTime(result.guest.checkedInAt, { zoneLabel: true })}
              {result.guest.checkedInByName ? ` by ${result.guest.checkedInByName}` : ""}
            </li>
          ) : null}
        </ul>
      ) : (
        "Search for the guest by name, or ask them to open their pass link."
      )}
    </Notice>
  );
}
