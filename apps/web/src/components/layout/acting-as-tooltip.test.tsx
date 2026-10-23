import { setSignInNoticeActive } from "@/lib/ui/first-visit-overlays";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActingAsTooltip } from "./acting-as-tooltip";

const consent = vi.hoisted(() => ({ showBanner: false }));

vi.mock("@/lib/analytics/consent/context", () => ({
  useConsent: () => ({ showBanner: consent.showBanner }),
}));
vi.mock("@/lib/legal-entity/acting-context.actions", () => ({
  dismissActingContextTooltip: vi.fn(),
}));

describe("ActingAsTooltip", () => {
  afterEach(() => {
    consent.showBanner = false;
    setSignInNoticeActive(false);
  });

  it("shows the hint when nothing else is on screen", () => {
    render(<ActingAsTooltip initiallyVisible />);
    expect(screen.getByText("Switch between your accounts")).toBeInTheDocument();
  });

  it("waits while the cookie banner is showing", () => {
    consent.showBanner = true;
    render(<ActingAsTooltip initiallyVisible />);
    expect(screen.queryByText("Switch between your accounts")).toBeNull();
  });

  it("waits for the sign-in notice, then appears once it is answered", () => {
    setSignInNoticeActive(true);
    render(<ActingAsTooltip initiallyVisible />);
    expect(screen.queryByText("Switch between your accounts")).toBeNull();
    act(() => setSignInNoticeActive(false));
    expect(screen.getByText("Switch between your accounts")).toBeInTheDocument();
  });
});
