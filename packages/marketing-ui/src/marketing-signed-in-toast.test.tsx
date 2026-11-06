/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MarketingSignedInToast,
  SIGNED_IN_TOAST_MS,
  signedInFirstName,
} from "./marketing-signed-in-toast.js";

describe("signedInFirstName", () => {
  it("is the first name, or the start of the email without a name", () => {
    expect(signedInFirstName("Alex Member", "alex@example.com")).toBe("Alex");
    expect(signedInFirstName("  ", "sam.lee@example.com")).toBe("sam.lee");
    expect(signedInFirstName(null, "sam@example.com")).toBe("sam");
  });
});

describe("MarketingSignedInToast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const setup = (over: Partial<Parameters<typeof MarketingSignedInToast>[0]> = {}) => {
    const onNotYou = vi.fn();
    const onDismiss = vi.fn();
    render(
      <MarketingSignedInToast
        open
        firstName="Alex"
        onNotYou={onNotYou}
        onDismiss={onDismiss}
        {...over}
      />,
    );
    return { onNotYou, onDismiss };
  };

  it("says who is signed in, in a polite live region, and is not a dialog", () => {
    setup();
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("Signed in as Alex·Not you?");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("leaves after about six seconds", () => {
    const { onDismiss } = setup();
    act(() => vi.advanceTimersByTime(SIGNED_IN_TOAST_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("signs out from 'Not you?', a plain button in the tab order", () => {
    const { onNotYou } = setup();
    const button = screen.getByRole("button", { name: "Not you?" });
    expect(button.getAttribute("tabindex")).toBeNull();
    fireEvent.click(button);
    expect(onNotYou).toHaveBeenCalledTimes(1);
  });

  it("sits above the docked bottom tab bar on a phone", () => {
    setup();
    expect(screen.getByRole("status").className).toContain("--lax-bottom-bar-space");
  });

  it("takes no focus by itself", () => {
    setup();
    expect(document.activeElement).toBe(document.body);
  });

  it("waits while the button has focus, then leaves after the full time", () => {
    const { onDismiss } = setup();
    const button = screen.getByRole("button", { name: "Not you?" });
    fireEvent.focus(button);
    act(() => vi.advanceTimersByTime(SIGNED_IN_TOAST_MS * 3));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.blur(button);
    act(() => vi.advanceTimersByTime(SIGNED_IN_TOAST_MS));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape from inside it", () => {
    const { onDismiss } = setup();
    fireEvent.keyDown(screen.getByRole("button", { name: "Not you?" }), { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps the live region but shows nothing while closed, and never times out", () => {
    const { onDismiss } = setup({ open: false });
    expect(screen.getByRole("status").textContent).toBe("");
    act(() => vi.advanceTimersByTime(SIGNED_IN_TOAST_MS * 2));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("disables 'Not you?' while signing out", () => {
    setup({ pending: true });
    expect((screen.getByRole("button", { name: "Not you?" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
