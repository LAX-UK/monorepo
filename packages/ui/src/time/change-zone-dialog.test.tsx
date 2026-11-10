// The device is in London for these tests; a visitor elsewhere has chosen their zone.
process.env.TZ = "Europe/London";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeZoneDialog } from "./change-zone-dialog.js";
import { type ZonePreferencePort, ZonePreferenceProvider } from "./zone-preference.js";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const AT = new Date("2026-11-12T18:00:00Z");

function port(overrides: Partial<ZonePreferencePort> = {}): ZonePreferencePort {
  return {
    save: vi.fn(),
    followDevice: vi.fn(),
    savedNote: "Saved on this device.",
    ...overrides,
  };
}

function renderDialog(
  current: { zone: string; source: "device" | "chosen" | "account" },
  zonePort: ZonePreferencePort = port(),
  extra?: ReactNode,
) {
  render(
    <ZonePreferenceProvider port={zonePort}>
      <ChangeZoneDialog
        open
        onOpenChange={() => {}}
        current={current}
        officialZone="Europe/London"
        at={AT}
      />
      {extra}
    </ZonePreferenceProvider>,
  );
  return screen.getByRole("dialog", { name: "Time zone" });
}

const saveButton = () => screen.getByRole("button", { name: "Save" });

describe("ChangeZoneDialog", () => {
  beforeEach(() => toastSuccess.mockClear());
  afterEach(() => vi.restoreAllMocks());

  it("offers Automatic, naming the device's city and offset, and Always use", () => {
    const dialog = renderDialog({ zone: "Africa/Cairo", source: "device" });
    const automatic = within(dialog).getByRole("radio", { name: /Automatic/ });
    expect(automatic).toBeChecked();
    expect(dialog).toHaveTextContent("Use this device’s time zone: London (GMT)");
    expect(within(dialog).getByRole("radio", { name: "Always use" })).not.toBeChecked();
  });

  it("starts with Automatic selected and focused for a device reading, with Save off", () => {
    const dialog = renderDialog({ zone: "Africa/Cairo", source: "device" });
    expect(within(dialog).getByRole("radio", { name: /Automatic/ })).toHaveFocus();
    expect(saveButton()).toBeDisabled();
  });

  it("puts a chosen zone first in the list, checked and focused", () => {
    const dialog = renderDialog({ zone: "Asia/Tokyo", source: "chosen" });
    const cities = within(dialog).getByRole("group", { name: "Cities" });
    const first = within(cities).getAllByRole("radio")[0];
    expect(first).toHaveAccessibleName(/Tokyo/);
    expect(first).toBeChecked();
    expect(first).toHaveFocus();
    expect(within(dialog).getByRole("radio", { name: "Always use" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /Automatic/ })).not.toBeChecked();
  });

  it("keeps the saved zone in the list while its name is searched", () => {
    const dialog = renderDialog({ zone: "Asia/Tokyo", source: "account" });
    fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "Tok" } });
    expect(within(dialog).getByRole("radio", { name: /Tokyo/ })).toBeChecked();
  });

  it("keeps Save off until the choice differs from what is in use", () => {
    const dialog = renderDialog({ zone: "Asia/Tokyo", source: "chosen" });
    expect(saveButton()).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("radio", { name: /Automatic/ }));
    expect(saveButton()).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Always use" }));
    expect(saveButton()).toBeDisabled();
  });

  it("keeps Save off for Always use until a city is picked", () => {
    const dialog = renderDialog({ zone: "Africa/Cairo", source: "device" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Always use" }));
    expect(saveButton()).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "Cairo" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Cairo/ }));
    expect(saveButton()).toBeEnabled();
  });

  it("saves Automatic through the port, not as a pinned zone, and says so", async () => {
    const zonePort = port();
    const dialog = renderDialog({ zone: "Asia/Tokyo", source: "chosen" }, zonePort);
    fireEvent.click(within(dialog).getByRole("radio", { name: /Automatic/ }));
    await act(async () => {
      fireEvent.click(saveButton());
    });
    expect(zonePort.followDevice).toHaveBeenCalledTimes(1);
    expect(zonePort.save).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Saved. Times now show London time.");
  });

  it("saves a picked city through the port and names it in the toast", async () => {
    const zonePort = port();
    const dialog = renderDialog({ zone: "Africa/Cairo", source: "device" }, zonePort);
    fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "Sydney" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Sydney/ }));
    await act(async () => {
      fireEvent.click(saveButton());
    });
    expect(zonePort.save).toHaveBeenCalledWith("Australia/Sydney");
    expect(zonePort.followDevice).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Saved. Times now show Sydney time.");
  });

  it("says a failed save inline and keeps the choice", async () => {
    const zonePort = port({
      followDevice: vi.fn().mockRejectedValue(new Error("offline")),
    });
    const dialog = renderDialog({ zone: "Asia/Tokyo", source: "account" }, zonePort);
    fireEvent.click(within(dialog).getByRole("radio", { name: /Automatic/ }));
    await act(async () => {
      fireEvent.click(saveButton());
    });
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn’t save your time zone.");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(saveButton()).toBeEnabled();
  });

  it("makes Save the primary (ink) button", () => {
    renderDialog({ zone: "Asia/Tokyo", source: "chosen" });
    expect(saveButton().className).toContain("bg-lax-ink");
  });
});
