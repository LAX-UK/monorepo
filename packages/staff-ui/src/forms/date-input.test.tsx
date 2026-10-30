import { Field } from "@auction/ui/lax";
import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { DateInput, DateTimeInput } from "./date-input.js";
import {
  isoToLondonWallTime,
  londonClockChange,
  londonWallTimeToIso,
  parseStaffDay,
  parseStaffTime,
} from "./staff-dates.js";

describe("parseStaffDay", () => {
  it.each([
    ["24 Oct 2026", "2026-10-24"],
    ["24 october 2026", "2026-10-24"],
    ["24/10/2026", "2026-10-24"],
    ["24-10-2026", "2026-10-24"],
    ["24.10.2026", "2026-10-24"],
    ["24 10 2026", "2026-10-24"],
    ["2026-10-24", "2026-10-24"],
    ["1 Mar 2028", "2028-03-01"],
  ])("reads %s, day before month", (text, day) => {
    expect(parseStaffDay(text)).toEqual({ ok: true, day });
  });

  it.each([["31 Feb 2026"], ["10/24/2026"], ["24 Oct"], ["tomorrow"]])(
    "refuses %s rather than guessing",
    (text) => {
      expect(parseStaffDay(text)).toEqual({ ok: false, reason: "invalid" });
    },
  );

  it("tells empty apart from unreadable", () => {
    expect(parseStaffDay("  ")).toEqual({ ok: false, reason: "empty" });
  });
});

describe("London wall time", () => {
  it("converts a summer and a winter time to UTC", () => {
    expect(londonWallTimeToIso("2026-10-24", "14:05")).toBe("2026-10-24T13:05:00.000Z");
    expect(londonWallTimeToIso("2026-11-02", "09:00")).toBe("2026-11-02T09:00:00.000Z");
    expect(isoToLondonWallTime("2026-10-24T13:05:00.000Z")).toEqual({
      day: "2026-10-24",
      time: "14:05",
    });
  });

  it("knows the days the clocks change, and the hour that does not exist", () => {
    expect(londonClockChange("2026-03-29")).toBe("forward");
    expect(londonClockChange("2026-10-25")).toBe("back");
    expect(londonClockChange("2026-10-24")).toBeNull();
    expect(londonWallTimeToIso("2026-03-29", "01:30")).toBeNull();
    expect(londonWallTimeToIso("2026-10-25", "01:30")).toBe("2026-10-25T00:30:00.000Z");
  });

  it("reads times on a 24-hour clock", () => {
    expect(parseStaffTime("14:05")).toBe("14:05");
    expect(parseStaffTime("1405")).toBe("14:05");
    expect(parseStaffTime("9:30")).toBe("09:30");
    expect(parseStaffTime("24:00")).toBeNull();
  });
});

describe("DateInput", () => {
  it("keeps the typed text while focused, hands over the day, and tidies it on blur", () => {
    const onValueChange = vi.fn();
    function Harness() {
      const [day, setDay] = React.useState<string | null>(null);
      return (
        <Field label="Closes on">
          <DateInput
            value={day}
            onValueChange={(next) => {
              onValueChange(next);
              setDay(next);
            }}
          />
        </Field>
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText("Closes on");
    fireEvent.change(input, { target: { value: "24/10/2026" } });
    expect(input).toHaveValue("24/10/2026");
    expect(onValueChange).toHaveBeenLastCalledWith("2026-10-24");
    fireEvent.blur(input);
    expect(input).toHaveValue("24 Oct 2026");
    fireEvent.change(input, { target: { value: "31 Feb 2026" } });
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("offers the calendar as a second route, never the only one", () => {
    render(
      <Field label="Closes on">
        <DateInput value="2026-10-24" onValueChange={() => {}} />
      </Field>,
    );
    expect(screen.getByLabelText("Closes on")).toHaveValue("24 Oct 2026");
    expect(screen.getByRole("button", { name: "Choose from a calendar" })).toBeInTheDocument();
  });
});

describe("DateTimeInput", () => {
  it("shows the zone, and stores the moment as UTC", () => {
    const onValueChange = vi.fn();
    render(
      <Field label="Lot closes">
        <DateTimeInput value="2026-10-24T13:05:00.000Z" onValueChange={onValueChange} />
      </Field>,
    );
    expect(screen.getByText("Europe/London (BST)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Time, 24-hour clock"), { target: { value: "15:30" } });
    expect(onValueChange).toHaveBeenLastCalledWith("2026-10-24T14:30:00.000Z");
  });

  it("warns on the day the clocks go back", () => {
    render(
      <Field label="Lot closes">
        <DateTimeInput value="2026-10-25T12:00:00.000Z" onValueChange={() => {}} />
      </Field>,
    );
    expect(screen.getByText(/Clocks go back an hour on this day/)).toBeInTheDocument();
    expect(screen.getByText("Europe/London (GMT)")).toBeInTheDocument();
  });
});
