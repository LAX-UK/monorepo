import type { DevicesSectionVm } from "@/server/domain/account-devices-section.vm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SignedInDevicesSection } from "./signed-in-devices-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  signOutDeviceAction: vi.fn(),
  signOutOtherDevicesAction: vi.fn(),
}));

const current = {
  id: "mac",
  deviceLabel: "Chrome on macOS",
  detail: "Active now · Signed in 5 minutes ago",
  isCurrent: true,
};
const phone = {
  id: "phone",
  deviceLabel: "Safari on iPhone",
  detail: "Last active 2 hours ago · Signed in 3 days ago",
  isCurrent: false,
};

const render = (section: DevicesSectionVm) =>
  renderToStaticMarkup(
    <SignedInDevicesSection
      section={section}
      pagePath="/account/security"
      reauthHref="/api/auth/login?returnTo=%2Faccount%2Fsecurity&intent=reauth"
    />,
  );

describe("SignedInDevicesSection", () => {
  it("labels this device, offers Sign out per other device and for all of them", () => {
    const html = render({ status: "list", sessions: { current, others: [phone] } });
    expect(html).toContain('id="signed-in-devices"');
    expect(html).toContain("Where you&#x27;re signed in");
    expect(html).toContain("Chrome on macOS");
    expect(html).toContain("This device");
    expect(html).toContain('aria-label="Sign out Safari on iPhone"');
    expect(html).not.toContain('aria-label="Sign out Chrome on macOS"');
    expect(html).toContain("Sign out everywhere else");
  });

  it("says so, and offers no bulk sign-out, when this is the only device", () => {
    const html = render({ status: "list", sessions: { current, others: [] } });
    expect(html).toContain("You&#x27;re not signed in on any other device.");
    expect(html).not.toContain("Sign out everywhere else");
  });

  it("asks to sign in again when the issuer no longer knows this sign-in", () => {
    const html = render({ status: "reauth_required" });
    expect(html).toContain("Sign in again to see your devices");
    expect(html).toContain(
      'href="/api/auth/login?returnTo=%2Faccount%2Fsecurity&amp;intent=reauth"',
    );
    expect(html).not.toContain("Sign out everywhere else");
  });

  it("reports an unavailable list as a temporary problem with a retry, never as empty", () => {
    const html = render({ status: "unavailable" });
    expect(html).toContain("We can&#x27;t show your devices right now");
    expect(html).toContain('href="/account/security"');
    expect(html).not.toContain("not signed in on any other device");
  });
});
