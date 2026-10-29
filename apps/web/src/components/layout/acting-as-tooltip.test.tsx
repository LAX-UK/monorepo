import { setSignInNoticeActive } from "@/lib/ui/first-visit-overlays";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActingAsTooltip } from "./acting-as-tooltip";

const consent = vi.hoisted(() => ({ showBanner: false }));
const viewport = vi.hoisted(() => ({ wide: true }));
const dismiss = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics/consent/context", () => ({
  useConsent: () => ({ showBanner: consent.showBanner }),
}));
vi.mock("@/lib/legal-entity/acting-context.actions", () => ({
  dismissActingContextTooltip: dismiss,
}));
vi.mock("@/hooks/use-is-lg", () => ({ useIsLg: () => viewport.wide }));

function renderHint() {
  return render(
    <div data-testid="sidebar" style={{ overflow: "hidden" }}>
      <ActingAsTooltip initiallyVisible>
        <button type="button">Account: Northbank Gallery</button>
      </ActingAsTooltip>
    </div>,
  );
}

describe("ActingAsTooltip", () => {
  afterEach(() => {
    consent.showBanner = false;
    viewport.wide = true;
    dismiss.mockClear();
    setSignInNoticeActive(false);
  });

  it("shows the hint when nothing else is on screen, outside the sidebar that would clip it", () => {
    renderHint();
    const hint = screen.getByTestId("account-switcher-hint");
    expect(hint).toHaveTextContent("Switch between your accounts");
    // Rendered in a portal on the body, not inside the sidebar's overflow.
    expect(screen.getByTestId("sidebar")).not.toContainElement(hint);
    expect(screen.getByRole("dialog", { name: "Switch between your accounts" })).toBe(hint);
  });

  it("keeps the switcher it points at in place", () => {
    renderHint();
    expect(screen.getByTestId("sidebar")).toContainElement(
      screen.getByRole("button", { name: "Account: Northbank Gallery" }),
    );
  });

  it("never takes focus from the page when it appears", () => {
    renderHint();
    expect(screen.getByTestId("account-switcher-hint")).not.toContainElement(
      document.activeElement as HTMLElement,
    );
  });

  it("is dismissed for good with Got it", () => {
    renderHint();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByTestId("account-switcher-hint")).toBeNull();
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("stays away on phones, where the switcher heads the menu sheet", () => {
    viewport.wide = false;
    renderHint();
    expect(screen.queryByTestId("account-switcher-hint")).toBeNull();
    expect(screen.getByRole("button", { name: "Account: Northbank Gallery" })).toBeVisible();
  });

  it("waits while the cookie banner is showing", () => {
    consent.showBanner = true;
    renderHint();
    expect(screen.queryByText("Switch between your accounts")).toBeNull();
  });

  it("waits for the sign-in notice, then appears once it is answered", () => {
    setSignInNoticeActive(true);
    renderHint();
    expect(screen.queryByText("Switch between your accounts")).toBeNull();
    act(() => setSignInNoticeActive(false));
    expect(screen.getByText("Switch between your accounts")).toBeInTheDocument();
  });
});
