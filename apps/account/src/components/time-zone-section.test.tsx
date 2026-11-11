// @vitest-environment jsdom
// This device is in London.
process.env.TZ = "Europe/London";

import { textOf } from "@/test/text-of";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const saveTimeZoneAction = vi.fn();
const reportDeviceZoneAction = vi.fn();
const assign = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({ toast: { success: (message: string) => toastSuccess(message) } }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  saveTimeZoneAction: (input: unknown) => saveTimeZoneAction(input),
  reportDeviceZoneAction: (zone: unknown) => reportDeviceZoneAction(zone),
}));

const { TimeZoneSection } = await import("./time-zone-section.client");

const AT = "2026-11-12T12:00:00.000Z";
const props = (initial: { mode: "automatic" | "fixed"; zone: string | null } | null) => ({
  initial,
  at: AT,
  returnTo: "/account/profile",
});

const text = (element: HTMLElement) => element.textContent ?? "";

async function settle() {
  await act(async () => {});
}

describe("TimeZoneSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportDeviceZoneAction.mockResolvedValue({ status: "error", message: "unavailable" });
    Object.defineProperty(window, "location", { value: { assign }, configurable: true });
  });
  afterEach(cleanup);

  describe("loading", () => {
    it("draws the skeleton for the value and detail until the browser has read the device", () => {
      const html = renderToStaticMarkup(
        <TimeZoneSection {...props({ mode: "automatic", zone: null })} />,
      );
      expect(textOf(html)).toContain("Time zone for emails and dates");
      expect(textOf(html)).not.toContain("Checking this device");
      expect(html).toContain("animate-");
      expect(textOf(html)).not.toContain("Automatic");
    });
  });

  describe("A1 automatic", () => {
    it("shows the zone in use and where it came from", async () => {
      render(<TimeZoneSection {...props({ mode: "automatic", zone: "Europe/London" })} />);
      await settle();
      expect(screen.getByText("Automatic · London (GMT)")).toBeTruthy();
      expect(
        screen.getByText(
          "Taken from this device. Sale times stay in London time, with yours next to them.",
        ),
      ).toBeTruthy();
    });

    it("says what happens when no zone has been detected yet", async () => {
      render(<TimeZoneSection {...props({ mode: "automatic", zone: null })} />);
      await settle();
      expect(screen.getByText("Automatic")).toBeTruthy();
      expect(
        screen.getByText("We’ll use this device’s time zone the next time you visit."),
      ).toBeTruthy();
    });

    it("stores this device's zone on a visit when it differs, and shows the stored one", async () => {
      reportDeviceZoneAction.mockResolvedValue({
        status: "ok",
        mode: "automatic",
        zone: "Europe/London",
      });
      render(<TimeZoneSection {...props({ mode: "automatic", zone: "Asia/Tokyo" })} />);
      await settle();
      expect(reportDeviceZoneAction).toHaveBeenCalledWith("Europe/London");
      expect(reportDeviceZoneAction).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Automatic · London (GMT)")).toBeTruthy();
    });

    it("does not report a zone that is already stored", async () => {
      render(<TimeZoneSection {...props({ mode: "automatic", zone: "Europe/London" })} />);
      await settle();
      expect(reportDeviceZoneAction).not.toHaveBeenCalled();
    });
  });

  describe("fixed", () => {
    it("shows the chosen city alone, and never reports the device over it", async () => {
      render(<TimeZoneSection {...props({ mode: "fixed", zone: "Europe/London" })} />);
      await settle();
      expect(screen.getByText("London (GMT)")).toBeTruthy();
      expect(screen.queryByText(/This device is on/)).toBeNull();
      expect(reportDeviceZoneAction).not.toHaveBeenCalled();
    });

    it("notes a device somewhere else in one line, with nothing to press", async () => {
      render(<TimeZoneSection {...props({ mode: "fixed", zone: "Asia/Tokyo" })} />);
      await settle();
      expect(screen.getByText("Tokyo (GMT+9)")).toBeTruthy();
      expect(
        screen.getByText("This device is on London time. We still use Tokyo, as you chose."),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Switch/ })).toBeNull();
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });
  });

  it("says it could not load the zone when the issuer did not answer", () => {
    render(<TimeZoneSection {...props(null)} />);
    expect(text(screen.getByRole("alert"))).toContain("We couldn't load your time zone");
    expect(screen.queryByRole("button", { name: /Change/ })).toBeNull();
  });

  describe("changing it in place", () => {
    async function startEditing(
      initial: { mode: "automatic" | "fixed"; zone: string | null } = {
        mode: "automatic",
        zone: "Europe/London",
      },
    ) {
      render(<TimeZoneSection {...props(initial)} />);
      await settle();
      fireEvent.click(
        screen.getByRole("button", { name: "Change: Time zone for emails and dates" }),
      );
      await settle();
    }

    async function pickSydney() {
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Sydney" } });
      fireEvent.click(screen.getByRole("radio", { name: /Sydney/ }));
    }

    it("opens the choice inside the row, with no dialog", async () => {
      await startEditing();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect((screen.getByRole("radio", { name: /Automatic/ }) as HTMLInputElement).checked).toBe(
        true,
      );
      expect(screen.getByText("Use this device’s time zone: London (GMT)")).toBeTruthy();
      expect(screen.getByRole("group", { name: "Time zone for emails and dates" })).toBeTruthy();
    });

    it("keeps Save off until the choice differs from what is in use", async () => {
      await startEditing();
      expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
      await pickSydney();
      expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", false);
    });

    it("says there is no match for a search with no city", async () => {
      await startEditing();
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzzqq" } });
      expect(screen.getByText(/No city matches “zzzzqq”/)).toBeTruthy();
    });

    it("saves a picked city, closes the editor, and confirms with one toast only", async () => {
      saveTimeZoneAction.mockResolvedValue({
        status: "ok",
        mode: "fixed",
        zone: "Australia/Sydney",
      });
      await startEditing();
      await pickSydney();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });
      expect(saveTimeZoneAction).toHaveBeenCalledWith({ mode: "fixed", zone: "Australia/Sydney" });
      expect(refresh).toHaveBeenCalled();
      expect(screen.getByText("Sydney (GMT+11)")).toBeTruthy();
      expect(screen.queryByRole("radio")).toBeNull();
      expect(toastSuccess).toHaveBeenCalledTimes(1);
      expect(toastSuccess).toHaveBeenCalledWith("Saved. Times now show Sydney time.");
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("goes back to Automatic with this device's zone", async () => {
      saveTimeZoneAction.mockResolvedValue({
        status: "ok",
        mode: "automatic",
        zone: "Europe/London",
      });
      await startEditing({ mode: "fixed", zone: "Asia/Tokyo" });
      fireEvent.click(screen.getByRole("radio", { name: /Automatic/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });
      expect(saveTimeZoneAction).toHaveBeenCalledWith({ mode: "automatic", zone: "Europe/London" });
      expect(toastSuccess).toHaveBeenCalledWith("Saved. Times now show London time.");
      expect(screen.getByText("Automatic · London (GMT)")).toBeTruthy();
    });

    it("says a failed save inline, keeps the choice and sends no toast", async () => {
      saveTimeZoneAction.mockResolvedValue({ status: "error", message: "No." });
      await startEditing();
      await pickSydney();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });
      expect(text(screen.getByRole("alert"))).toContain(
        "We couldn’t save your time zone. Try again.",
      );
      expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", false);
      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("sends a person whose sign-in has ended to sign in again", async () => {
      saveTimeZoneAction.mockResolvedValue({ status: "reauth_required" });
      await startEditing();
      await pickSydney();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });
      expect(String(assign.mock.calls[0]?.[0])).toContain("/api/auth/login?");
    });

    it("cancels without saving and shows the row as it was", async () => {
      await startEditing();
      await pickSydney();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(saveTimeZoneAction).not.toHaveBeenCalled();
      expect(screen.getByText("Automatic · London (GMT)")).toBeTruthy();
    });
  });
});
