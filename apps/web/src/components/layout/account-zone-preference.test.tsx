// The device is in London unless a test says otherwise.
process.env.TZ = "Europe/London";

import {
  ViewerZoneProvider,
  type ZonePreferencePort,
  clearAccountViewerZone,
  useViewerZone,
  useZonePreference,
} from "@auction/ui/time";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountZonePreference } from "./account-zone-preference";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const client = vi.hoisted(() => ({
  saveAccountFixedZone: vi.fn(),
  saveAccountAutomaticZone: vi.fn(),
  reportDeviceZone: vi.fn(),
}));
vi.mock("@/lib/data/http/account-time-zone.client", () => client);

const device = vi.hoisted(() => ({ zone: "Europe/London" as string | null }));
vi.mock("@auction/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/datetime")>()),
  deviceTimeZone: () => device.zone,
}));

let port: ZonePreferencePort;
let seen: ReturnType<typeof useViewerZone>;
function Probe() {
  port = useZonePreference();
  seen = useViewerZone();
  return null;
}

describe("AccountZonePreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAccountViewerZone();
    window.sessionStorage.clear();
    device.zone = "Europe/London";
    document.cookie = "lax_tz=; path=/; max-age=0";
    client.saveAccountFixedZone.mockResolvedValue(true);
    client.saveAccountAutomaticZone.mockResolvedValue(true);
    client.reportDeviceZone.mockResolvedValue(true);
  });

  function renderProbe(timeZone: { mode: "automatic" | "fixed"; zone: string | null } | null) {
    render(
      <AccountZonePreference timeZone={timeZone}>
        <Probe />
      </AccountZonePreference>,
    );
  }

  describe("signed in", () => {
    it("saves a chosen city to LAX Account, not to the cookie, and refreshes the page", async () => {
      renderProbe({ mode: "automatic", zone: "Europe/London" });
      await act(async () => {
        await port.save("Asia/Tokyo");
      });
      expect(client.saveAccountFixedZone).toHaveBeenCalledWith("Asia/Tokyo");
      expect(document.cookie).not.toContain("lax_tz=fixed");
      expect(refresh).toHaveBeenCalledOnce();
    });

    it("shows a saved city at once, before the server has caught up with it", async () => {
      render(
        <ViewerZoneProvider initial={{ zone: "Europe/London", source: "account" }}>
          <AccountZonePreference timeZone={{ mode: "fixed", zone: "Europe/London" }}>
            <Probe />
          </AccountZonePreference>
        </ViewerZoneProvider>,
      );
      expect(seen).toEqual({ zone: "Europe/London", source: "account" });
      await act(async () => {
        await port.save("Asia/Tokyo");
      });
      // The server still hands over the old zone (the refresh does not change it).
      expect(seen).toEqual({ zone: "Asia/Tokyo", source: "account" });
    });

    it("shows the device's zone at once when going back to Automatic", async () => {
      device.zone = "America/New_York";
      render(
        <ViewerZoneProvider initial={{ zone: "Asia/Tokyo", source: "account" }}>
          <AccountZonePreference timeZone={{ mode: "fixed", zone: "Asia/Tokyo" }}>
            <Probe />
          </AccountZonePreference>
        </ViewerZoneProvider>,
      );
      await act(async () => {
        await port.followDevice();
      });
      expect(seen).toEqual({ zone: "America/New_York", source: "device" });
    });

    it("keeps the shown zone when LAX Account refuses the save", async () => {
      client.saveAccountFixedZone.mockResolvedValue(false);
      render(
        <ViewerZoneProvider initial={{ zone: "Asia/Tokyo", source: "account" }}>
          <AccountZonePreference timeZone={{ mode: "fixed", zone: "Asia/Tokyo" }}>
            <Probe />
          </AccountZonePreference>
        </ViewerZoneProvider>,
      );
      await expect(port.save("Europe/Paris")).rejects.toThrow();
      expect(seen).toEqual({ zone: "Asia/Tokyo", source: "account" });
    });

    it("fails the save when LAX Account does not accept it, so the sheet says so inline", async () => {
      client.saveAccountFixedZone.mockResolvedValue(false);
      renderProbe({ mode: "fixed", zone: "Asia/Tokyo" });
      await expect(port.save("Europe/Paris")).rejects.toThrow();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("follows the device by saving automatic with the device's zone", async () => {
      device.zone = "America/New_York";
      renderProbe({ mode: "fixed", zone: "Asia/Tokyo" });
      await act(async () => {
        await port.followDevice();
      });
      expect(client.saveAccountAutomaticZone).toHaveBeenCalledWith("America/New_York");
      expect(document.cookie).toContain("lax_tz=America%2FNew_York");
      expect(refresh).toHaveBeenCalledOnce();
    });

    it("says it saves to the Account", () => {
      renderProbe({ mode: "fixed", zone: "Asia/Tokyo" });
      expect(port.savedNote).toBe("Saved to your LAX Account, so your emails use it too.");
    });

    it("tells Account the device's zone on a visit while automatic and it differs", () => {
      device.zone = "Asia/Tokyo";
      renderProbe({ mode: "automatic", zone: "Europe/London" });
      expect(client.reportDeviceZone).toHaveBeenCalledWith("Asia/Tokyo");
    });

    it("reports a device zone once per session, not again on the next full load", () => {
      device.zone = "Asia/Tokyo";
      const first = render(
        <AccountZonePreference timeZone={{ mode: "automatic", zone: "Europe/London" }}>
          <Probe />
        </AccountZonePreference>,
      );
      first.unmount();
      renderProbe({ mode: "automatic", zone: "Europe/London" });
      expect(client.reportDeviceZone).toHaveBeenCalledTimes(1);
    });

    it("reports again when the device is somewhere else than it was last reported", () => {
      device.zone = "Asia/Tokyo";
      renderProbe({ mode: "automatic", zone: "Europe/London" });
      device.zone = "Asia/Dubai";
      renderProbe({ mode: "automatic", zone: "Europe/London" });
      expect(client.reportDeviceZone).toHaveBeenCalledTimes(2);
    });

    it("hands the chip back to the server's copy once it says the same as the saved zone", async () => {
      const view = (timeZone: { mode: "fixed"; zone: string }) => (
        <ViewerZoneProvider initial={{ zone: timeZone.zone, source: "account" }}>
          <AccountZonePreference timeZone={timeZone}>
            <Probe />
          </AccountZonePreference>
        </ViewerZoneProvider>
      );
      const { rerender } = render(view({ mode: "fixed", zone: "Europe/London" }));
      await act(async () => {
        await port.save("Asia/Tokyo");
      });
      expect(seen).toEqual({ zone: "Asia/Tokyo", source: "account" });
      // The server's copy catches up with the save.
      rerender(view({ mode: "fixed", zone: "Asia/Tokyo" }));
      // A later change made elsewhere is no longer hidden by the old override.
      rerender(view({ mode: "fixed", zone: "Europe/Paris" }));
      expect(seen).toEqual({ zone: "Europe/Paris", source: "account" });
    });

    it("forgets a saved zone when the person signs out", async () => {
      const view = (timeZone: { mode: "fixed"; zone: string } | null) => (
        <ViewerZoneProvider initial={{ zone: "Europe/London", source: "device" }}>
          <AccountZonePreference timeZone={timeZone}>
            <Probe />
          </AccountZonePreference>
        </ViewerZoneProvider>
      );
      const { rerender } = render(view({ mode: "fixed", zone: "Europe/London" }));
      await act(async () => {
        await port.save("Asia/Tokyo");
      });
      rerender(view(null));
      expect(seen).toEqual({ zone: "Europe/London", source: "device" });
    });

    it("does not report when the stored zone is already the device's", () => {
      renderProbe({ mode: "automatic", zone: "Europe/London" });
      expect(client.reportDeviceZone).not.toHaveBeenCalled();
    });

    it("never reports over a city the person fixed", () => {
      device.zone = "Asia/Tokyo";
      renderProbe({ mode: "fixed", zone: "Europe/London" });
      expect(client.reportDeviceZone).not.toHaveBeenCalled();
    });

    it("does not report when the device has no usable zone", () => {
      device.zone = null;
      renderProbe({ mode: "automatic", zone: "Europe/London" });
      expect(client.reportDeviceZone).not.toHaveBeenCalled();
    });
  });

  describe("signed out", () => {
    it("saves a chosen city to the lax_tz cookie and never calls LAX Account", async () => {
      renderProbe(null);
      await act(async () => {
        await port.save("Asia/Tokyo");
      });
      expect(document.cookie).toContain("lax_tz=fixed%3AAsia%2FTokyo");
      expect(client.saveAccountFixedZone).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("follows the device through the cookie only", async () => {
      renderProbe(null);
      await act(async () => {
        await port.followDevice();
      });
      expect(client.saveAccountAutomaticZone).not.toHaveBeenCalled();
      expect(document.cookie).toContain("lax_tz=Europe%2FLondon");
    });

    it("says it saves on this device, and reports nothing", () => {
      renderProbe(null);
      expect(port.savedNote).toMatch(/this device/);
      expect(client.reportDeviceZone).not.toHaveBeenCalled();
    });
  });
});
