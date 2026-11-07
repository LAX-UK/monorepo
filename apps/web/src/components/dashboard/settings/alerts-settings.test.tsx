import { DEFAULT_NOTIFICATION_PREFERENCES_FORM_VALUES } from "@/lib/notifications/notification-preferences-registry";
import type { NotificationPreference } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertsSettings } from "./alerts-settings";

vi.mock("@/lib/actions/user-notification-preferences", () => ({
  updateNotificationPreferencesFromValuesAction: vi.fn(),
}));
vi.mock("@/lib/data/http/alerts.client", () => ({ setAlertTopic: vi.fn() }));
vi.mock("./device-push-row", () => ({ DevicePushRow: () => null }));
vi.mock("@/lib/ui/notify", () => ({ notify: { error: vi.fn(), success: vi.fn() } }));

const prefs = {
  ...DEFAULT_NOTIFICATION_PREFERENCES_FORM_VALUES,
  quietStart: null,
  quietEnd: null,
  quietTimeZone: "Europe/London",
} as unknown as NotificationPreference;

const engine = {
  subscribed: { "bid.new_sales": true, "bid.artists": true, "bid.searches": true },
  email: { "bid.new_sales": true, "bid.artists": false, "bid.searches": true },
};

describe("AlertsSettings engine rows", () => {
  it("holds App off, focusable and disabled, while the email is off", () => {
    render(<AlertsSettings initial={prefs} initialEngine={engine} />);
    const held = screen.getByRole("switch", { name: "Artists you follow by app" });
    expect(held).toHaveAttribute("aria-checked", "false");
    expect(held).toHaveAttribute("aria-disabled", "true");
    expect(held).toHaveAttribute("tabindex", "0");
    expect(held).toHaveAccessibleDescription("Comes with the email");
  });

  it("leaves App changeable once the email is on", () => {
    render(<AlertsSettings initial={prefs} initialEngine={engine} />);
    const open = screen.getByRole("switch", { name: "Saved searches by app" });
    expect(open).not.toHaveAttribute("aria-disabled", "true");
  });
});
