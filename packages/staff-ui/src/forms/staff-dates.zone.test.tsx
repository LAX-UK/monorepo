import { Field } from "@auction/ui/lax";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateTimeInput } from "./date-input.js";
import { isoToWallTime, nextExistingWallTime, wallTimeToIso } from "./staff-dates.js";

afterEach(cleanup);

describe("wall time in any zone", () => {
  it.each([
    ["Europe/London", "2030-11-12", "18:00", "2030-11-12T18:00:00.000Z"],
    ["Europe/Paris", "2030-11-12", "18:00", "2030-11-12T17:00:00.000Z"],
    ["America/New_York", "2030-11-12", "18:00", "2030-11-12T23:00:00.000Z"],
    ["Asia/Kolkata", "2030-11-12", "18:00", "2030-11-12T12:30:00.000Z"],
    ["Pacific/Chatham", "2030-11-12", "18:00", "2030-11-12T04:15:00.000Z"],
    ["Australia/Sydney", "2030-07-01", "09:00", "2030-06-30T23:00:00.000Z"],
  ])("%s %s %s is %s", (zone, day, time, iso) => {
    expect(wallTimeToIso(day, time, zone)).toBe(iso);
    expect(isoToWallTime(iso, zone)).toEqual({ day, time });
  });

  it("finds no such time in the hour the clocks skip, and the first that exists", () => {
    expect(wallTimeToIso("2031-03-30", "01:30", "Europe/London")).toBeNull();
    expect(wallTimeToIso("2031-03-30", "01:30", "Asia/Dubai")).not.toBeNull();
    expect(nextExistingWallTime("2031-03-30", "01:30", "Europe/London")).toBe("02:00");
    expect(nextExistingWallTime("2031-03-30", "12:00", "Europe/London")).toBe("12:00");
  });

  it("uses the earlier of a repeated time", () => {
    expect(wallTimeToIso("2030-10-27", "01:30", "Europe/London")).toBe("2030-10-27T00:30:00.000Z");
  });
});

describe("DateTimeInput in a sale's zone", () => {
  function Harness({ zone }: { zone: string }) {
    const [value, setValue] = React.useState<string | null>("2030-11-12T18:00:00.000Z");
    return (
      <Field label="Closes">
        <DateTimeInput value={value} onValueChange={setValue} timeZone={zone} />
      </Field>
    );
  }

  it("names the zone beside the fields and shows the instant on that clock", () => {
    render(<Harness zone="Europe/Paris" />);
    expect(screen.getByText("Europe/Paris (CET)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("19:00")).toBeInTheDocument();
  });

  it("emits the instant of a typed time in the zone", () => {
    const onValueChange = vi.fn();
    render(
      <Field label="Closes">
        <DateTimeInput value={null} onValueChange={onValueChange} timeZone="Asia/Dubai" />
      </Field>,
    );
    fireEvent.change(screen.getByLabelText("Closes"), { target: { value: "12 Nov 2030" } });
    fireEvent.change(screen.getByLabelText("Time, 24-hour clock"), { target: { value: "18:00" } });
    expect(onValueChange).toHaveBeenLastCalledWith("2030-11-12T14:00:00.000Z");
  });

  it("keeps what was typed when the zone changes", () => {
    // The parent reads the same wall time in the new zone, so the instant moves an hour earlier.
    const Reread = () => {
      const [zone, setZone] = React.useState("Europe/London");
      const instant =
        zone === "Europe/London" ? "2030-11-12T18:00:00.000Z" : "2030-11-12T17:00:00.000Z";
      return (
        <>
          <button type="button" onClick={() => setZone("Europe/Paris")}>
            move
          </button>
          <Field label="Opens">
            <DateTimeInput value={instant} onValueChange={vi.fn()} timeZone={zone} />
          </Field>
        </>
      );
    };
    render(<Reread />);
    expect(screen.getByDisplayValue("18:00")).toBeInTheDocument();
    fireEvent.click(screen.getByText("move"));
    expect(screen.getByDisplayValue("18:00")).toBeInTheDocument();
    expect(screen.getByText("Europe/Paris (CET)")).toBeInTheDocument();
  });

  it("names the clock change in the zone's own terms", () => {
    render(
      <Field label="Closes">
        <DateTimeInput
          value="2031-03-30T09:00:00.000Z"
          onValueChange={vi.fn()}
          timeZone="Europe/Paris"
        />
      </Field>,
    );
    expect(
      screen.getByText(
        "Clocks go forward an hour on this day (CET to CEST): there is no 02:00 to 02:59.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps a typed time in the skipped hour on screen, and reports it as typed", () => {
    const onWallChange = vi.fn();
    render(
      <Field label="Opens">
        <DateTimeInput
          value={null}
          wall={{ day: "2031-03-09", time: "02:30" }}
          onWallChange={onWallChange}
          onValueChange={vi.fn()}
          timeZone="America/New_York"
        />
      </Field>,
    );
    expect(screen.getByDisplayValue("02:30")).toBeInTheDocument();
    expect(screen.getByText(/there is no 02:00 to 02:59/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Time, 24-hour clock"), { target: { value: "02:45" } });
    expect(onWallChange).toHaveBeenLastCalledWith({ day: "2031-03-09", time: "02:45" });
  });
});
