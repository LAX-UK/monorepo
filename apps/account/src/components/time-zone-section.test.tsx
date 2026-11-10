// @vitest-environment jsdom
// This device is in London.
process.env.TZ = "Europe/London";

import { textOf } from "@/test/text-of";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const saveTimeZoneAction = vi.fn();
const reportDeviceZoneAction = vi.fn();
const assign = vi.fn();

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
    it("says it is checking the device until the browser has reported its zone", () => {
      const html = textOf(
        renderToStaticMarkup(<TimeZoneSection {...props({ mode: "automatic", zone: null })} />),
      );
      expect(html).toContain("Automatic");
      expect(html).toContain("Checking this device…");
    });
  });

  describe("A1 automatic", () => {
    it("shows the device zone detected on the last visit", async () => {
      render(<TimeZoneSection {...props({ mode: "automatic", zone: "Europe/London" })} />);
      await settle();
      expect(screen.getByText("Automatic")).toBeTruthy();
      expect(screen.getByText("London (GMT)")).toBeTruthy();
      expect(screen.getByText("Detected from your device on your last visit.")).toBeTruthy();
    });

    it("says so when no zone has been detected yet", async () => {
      render(<TimeZoneSection {...props({ mode: "automatic", zone: null })} />);
      await settle();
      expect(screen.getByText("Not detected yet")).toBeTruthy();
      expect(screen.getByText("We haven't detected this device's time zone yet.")).toBeTruthy();
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
      expect(screen.getByText("London (GMT)")).toBeTruthy();
    });

    it("does not report a zone that is already stored", async () => {
      render(<TimeZoneSection {...props({ mode: "automatic", zone: "Europe/London" })} />);
      await settle();
      expect(reportDeviceZoneAction).not.toHaveBeenCalled();
    });
  });

  describe("A2 fixed city", () => {
    it("shows the chosen city and never reports the device over it", async () => {
      render(<TimeZoneSection {...props({ mode: "fixed", zone: "Europe/London" })} />);
      await settle();
      expect(screen.getByText("Always use")).toBeTruthy();
      expect(screen.getByText("London (GMT)")).toBeTruthy();
      expect(reportDeviceZoneAction).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Switch to Automatic" })).toBeNull();
    });
  });

  describe("A4 signed in from a device in another zone", () => {
    it("offers to switch to Automatic, naming both zones", async () => {
      render(<TimeZoneSection {...props({ mode: "fixed", zone: "Asia/Tokyo" })} />);
      await settle();
      expect(screen.getByText(/This device is in London \(GMT\)/)).toBeTruthy();
      expect(screen.getByText(/your emails and dates use Tokyo \(GMT\+9\)/)).toBeTruthy();
    });

    it("switches to Automatic with this device's zone and says so", async () => {
      saveTimeZoneAction.mockResolvedValue({
        status: "ok",
        mode: "automatic",
        zone: "Europe/London",
      });
      render(<TimeZoneSection {...props({ mode: "fixed", zone: "Asia/Tokyo" })} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: "Switch to Automatic" }));
      await settle();
      expect(saveTimeZoneAction).toHaveBeenCalledWith({ mode: "automatic", zone: "Europe/London" });
      expect(refresh).toHaveBeenCalled();
      expect(text(screen.getByRole("status"))).toContain(
        "Saved. Your emails and dates now use London time.",
      );
      expect(screen.queryByRole("button", { name: "Switch to Automatic" })).toBeNull();
    });
  });

  describe("A3 saving and errors", () => {
    it("says a failed switch inline and keeps the offer", async () => {
      saveTimeZoneAction.mockResolvedValue({ status: "error", message: "No." });
      render(<TimeZoneSection {...props({ mode: "fixed", zone: "Asia/Tokyo" })} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: "Switch to Automatic" }));
      await settle();
      expect(text(screen.getByRole("alert"))).toContain("We couldn't save your time zone.");
      expect(screen.getByRole("button", { name: "Switch to Automatic" })).toBeTruthy();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("sends a person whose sign-in has ended to sign in again", async () => {
      saveTimeZoneAction.mockResolvedValue({ status: "reauth_required" });
      render(<TimeZoneSection {...props({ mode: "fixed", zone: "Asia/Tokyo" })} />);
      await settle();
      fireEvent.click(screen.getByRole("button", { name: "Switch to Automatic" }));
      await settle();
      expect(String(assign.mock.calls[0]?.[0])).toContain("/api/auth/login?");
    });

    it("says it could not load the zone when the issuer did not answer", () => {
      render(<TimeZoneSection {...props(null)} />);
      expect(text(screen.getByRole("alert"))).toContain("We couldn't load your time zone");
      expect(screen.queryByRole("button", { name: /Change/ })).toBeNull();
    });
  });

  describe("the picker", () => {
    async function openPicker() {
      render(<TimeZoneSection {...props({ mode: "automatic", zone: "Europe/London" })} />);
      await settle();
      fireEvent.click(
        screen.getByRole("button", { name: "Change time zone for emails and dates" }),
      );
      await settle();
      return screen.getByRole("dialog", { name: "Time zone" });
    }

    it("opens the shared zone dialog with Automatic selected and the Account wording", async () => {
      const dialog = await openPicker();
      expect(
        (within(dialog).getByRole("radio", { name: /Automatic/ }) as HTMLInputElement).checked,
      ).toBe(true);
      expect(text(dialog)).toContain("for your emails and for the times LAX Bid shows you");
      expect(text(dialog)).not.toContain("Sale times");
      expect(text(dialog)).toContain("Saved to your LAX Account.");
    });

    it("says there is no match for a search with no city", async () => {
      const dialog = await openPicker();
      fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "zzzzqq" } });
      expect(within(dialog).getByText(/No city matches “zzzzqq”/)).toBeTruthy();
    });

    it("saves a picked city to Account, closes, and shows it", async () => {
      saveTimeZoneAction.mockResolvedValue({
        status: "ok",
        mode: "fixed",
        zone: "Australia/Sydney",
      });
      const dialog = await openPicker();
      fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "Sydney" } });
      fireEvent.click(within(dialog).getByRole("radio", { name: /Sydney/ }));
      await act(async () => {
        fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
      });
      expect(saveTimeZoneAction).toHaveBeenCalledWith({ mode: "fixed", zone: "Australia/Sydney" });
      expect(refresh).toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByText("Always use")).toBeTruthy();
      expect(screen.getByText("Sydney (GMT+11)")).toBeTruthy();
      expect(text(screen.getByRole("status"))).toContain(
        "Saved. Your emails and dates now use Sydney time.",
      );
    });

    it("says a failed save inline in the dialog and keeps it open", async () => {
      saveTimeZoneAction.mockResolvedValue({ status: "error", message: "No." });
      const dialog = await openPicker();
      fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "Sydney" } });
      fireEvent.click(within(dialog).getByRole("radio", { name: /Sydney/ }));
      await act(async () => {
        fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
      });
      expect(text(within(dialog).getByRole("alert"))).toContain(
        "We couldn’t save your time zone. Try again.",
      );
      expect(screen.getByRole("dialog", { name: "Time zone" })).toBeTruthy();
    });
  });
});
